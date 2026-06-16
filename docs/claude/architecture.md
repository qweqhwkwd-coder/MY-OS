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

**Целевой стек (по продукту, ещё не внедрён):** React+Vite+TS Mini App, TanStack Query, Zustand, shadcn/ui, Recharts, Gemini/Groq AI, faster-whisper. См. `ai-layer.md` и `roadmap.md`.

## Файловая структура

```
my-os-mvp/
├── .env.example          # шаблон переменных (без значений)
├── Dockerfile            # сборка для Render
├── backend/
│   ├── config.py         # pydantic-settings, чтение .env
│   ├── db.py             # клиент Supabase + ВСЕ функции данных
│   ├── main.py           # FastAPI + aiogram: вебхук, /health, хендлеры
│   └── requirements.txt
└── db/migrations/
    ├── 001_mvp_schema.sql   # 8 таблиц + RLS
    └── 002_add_stats.sql    # +health/finance/intellect в user_stats
```

Фронтенда нет: ни `package.json`, ни React/Vite.

## Точки входа (backend/main.py)

| Хендлер | Триггер |
|---|---|
| `on_start` | `/start` → `ensure_user` |
| `cmd_water` / `cb_water` | `/water` + callback `water:*` |
| `cmd_addritual` | `/addritual <название>` |
| `cmd_rituals` / `cb_ritual` | `/rituals` + callback `ritual:*` |
| `on_any` | `@dp.message()` catch-all эхо — **регистрируется ПОСЛЕДНИМ** |
| `health` | `GET /health` → `{"status":"ok"}` |
| `telegram_webhook` | `POST /webhook` (проверка `X-Telegram-Bot-Api-Secret-Token`) |

## Вебхук

- На старте приложение само вызывает `bot.set_webhook(WEBHOOK_BASE_URL + "/webhook", secret_token=...)`.
- Секрет вебхука **выводится из токена бота** (санитайз → первые 128 символов `A-Za-z0-9_-`). Отдельной env-переменной нет; при ротации токена секрет меняется и переустанавливается на старте автоматически.
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
| `PORT` | нет (default 8000) | на Render подставляется автоматически |

## Известные архитектурные ограничения

- **Синхронный supabase-py в async-хендлерах** блокирует event loop. Для одного юзера ок; при росте — `run_in_executor` или httpx.
- **Только вебхук, нет long-polling** → локально без туннеля (ngrok + `WEBHOOK_BASE_URL`) бот не получает апдейты.
- **Планировщик в процессе ненадёжен** на free Render (сервис спит). Решение для Фазы 5 — внешний cron дёргает эндпоинт.
