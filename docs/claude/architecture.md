# Архитектура

> Назад: [CLAUDE.md](../../CLAUDE.md)

## Общая схема

```
[Telegram] → POST /webhook → aiogram dispatcher → handlers
                                    ↓
                         FastAPI (один процесс)
                                    ↓
                         supabase-py (синхронный)
                                    ↓
                         Supabase (PostgreSQL + RLS + Storage)
```

Один процесс совмещает веб-сервер (FastAPI) и бота (aiogram 3 через вебхук). Telegram шлёт апдейты на `POST /webhook`, FastAPI отдаёт их диспетчеру aiogram.

## Стек (текущий MVP)

| Слой | Технология |
|---|---|
| Язык | Python 3.12 |
| Веб | FastAPI + uvicorn + gunicorn |
| Бот | aiogram 3 (вебхук, НЕ long-polling) |
| Конфиг | pydantic-settings (читает `.env`) |
| БД-клиент | supabase-py (синхронный) |
| БД | Supabase (managed PostgreSQL) |
| Хостинг | Render, Docker Web Service, free tier (512MB, 1 worker) |

**Mini App (уже есть, `miniapp/`):** React 19 + Vite + Tailwind v4, задеплоен
статикой на GitHub Pages, открывается кнопкой бота. Использует обычный
`useState`/`useEffect`, без TanStack Query/Zustand/shadcn/ui/Recharts — это
по-прежнему целевой стек из продукта, не внедрённый. AI (Gemini/Groq,
faster-whisper) — не внедрён. См. `ai-layer.md`, `current-state.md`, `roadmap.md`.

## Файловая структура

```
my-os-mvp/
├── .env.example          # шаблон переменных (без значений)
├── Dockerfile            # сборка для Render
├── backend/
│   ├── config.py         # pydantic-settings, чтение .env
│   ├── db.py             # клиент Supabase + ВСЕ функции данных
│   ├── main.py           # FastAPI + aiogram: вебхук, /health, хендлеры бота
│   ├── api_routes.py     # REST API для Mini App (/api/*), проверка initData
│   └── requirements.txt
├── miniapp/               # React 19 + Vite + Tailwind, статика на GitHub Pages
└── db/migrations/
    ├── 001_mvp_schema.sql
    ├── 002_add_stats.sql    # +health/finance/intellect/hp (восстановлен, см. database.md)
    ├── 003..013_*.sql       # по одному модулю на файл
    └── 014_atomic_xp_increment.sql
```

## Точки входа

**Бот (`backend/main.py`)** — порядка 30 команд (см. docstring файла и
`current-state.md`); ключевые инфраструктурные хендлеры:

| Хендлер | Триггер |
|---|---|
| `on_start` | `/start` → `ensure_user` |
| `on_any` | `@dp.message()` catch-all → Inbox — **регистрируется ПОСЛЕДНИМ** |
| `health` | `GET /health` → `{"status":"ok"}` |
| `telegram_webhook` | `POST /webhook` (проверка `X-Telegram-Bot-Api-Secret-Token`) |

**REST API (`backend/api_routes.py`, префикс `/api`)** — для Mini App, каждый
эндпоинт проверяет HMAC-подпись Telegram initData через `get_current_user`:
`/today`, `/stats`, `/water` (GET/POST), `/rituals` (+`/toggle`), `/tasks`
(+`/complete`), `/food`, `/digest`, `/profile`, `/inbox`.

## Вебхук

- На старте приложение само вызывает `bot.set_webhook(WEBHOOK_BASE_URL + "/webhook", secret_token=...)`.
- Секрет вебхука — **отдельное значение** (`WEBHOOK_SECRET`), НЕ выводится из
  токена бота (раньше так и было документировано — больше не так). Если
  `WEBHOOK_SECRET` не задан в окружении, генерируется случайно
  (`secrets.token_hex(32)`) при каждом старте процесса; webhook у Telegram
  переустанавливается с этим же значением, так что они остаются синхронны.
- Вебхук **намеренно НЕ удаляется** на shutdown — иначе спящий free-сервис терял бы связь.
- Диагностика: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

## Деплой (Render)

- Web Service, Runtime = Docker, Plan = Free, Region = Frankfurt.
- Команда запуска (из Dockerfile):
  ```
  gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120
  ```
- Env-переменные → Render → Environment.
- Холодный старт ~30–60с после простоя (засыпает через 15 мин). Первое сообщение после сна может прийти с задержкой — Telegram ретраит вебхук.
- Anti-sleep (по плану): внешний пинг `/health` каждые 5 мин (Uptime Robot).

## Переменные окружения

| Переменная | Обязательна | Назначение |
|---|---|---|
| `BOT_TOKEN` | да | токен от @BotFather |
| `SUPABASE_URL` | да | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | да | секретный ключ, обходит RLS — бэкенд работает под ним |
| `SUPABASE_ANON_KEY` | нет (default "") | публичный ключ, пока НЕ используется |
| `WEBHOOK_BASE_URL` | нет (default "") | адрес сервиса; пусто → вебхук на старте НЕ ставится |
| `WEBHOOK_SECRET` | нет (default "") | секрет вебхука; если пусто — генерируется случайно при каждом старте (`secrets.token_hex(32)`) |
| `PORT` | нет (default 8000) | на Render подставляется автоматически |

## Известные архитектурные ограничения

- **Синхронный supabase-py в async-хендлерах** блокирует event loop. Для одного юзера ок; при росте — `run_in_executor` или httpx.
- **Только вебхук, нет long-polling** → локально без туннеля (ngrok + `WEBHOOK_BASE_URL`) бот не получает апдейты.
- **Планировщик в процессе ненадёжен** на free Render (сервис спит). Решение для Фазы 5 — внешний cron дёргает эндпоинт.
