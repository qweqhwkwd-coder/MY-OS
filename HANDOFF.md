# MY-OS — Технический отчёт для передачи (handoff)

> Дата среза: текущее состояние репозитория `my-os-mvp`.
> Это **bot-first MVP** проекта MY-OS (личная «ОС для жизни»): Telegram-бот +
> FastAPI-бэкенд + Supabase (PostgreSQL), задеплоено на Render (free tier).
> Mini App (React-фронтенд) пока НЕ создан — это следующая фаза.

---

## 1. Файловая структура

```
my-os-mvp/
├── .env.example              # шаблон переменных окружения (без значений)
├── .gitignore                # игнорирует .env, __pycache__ и т.д.
├── Dockerfile                # сборка для Render (Docker runtime)
├── README.md                 # краткое описание
├── ROADMAP_v2.md             # рабочий план (MVP-first), лог решений, отложенное
├── HANDOFF.md                # этот отчёт
├── backend/
│   ├── config.py             # конфиг через pydantic-settings (чтение .env)
│   ├── db.py                 # клиент Supabase + все функции работы с данными
│   ├── main.py               # FastAPI + aiogram: вебхук, /health, обработчики бота
│   └── requirements.txt      # python-зависимости
└── db/
    └── migrations/
        ├── 001_mvp_schema.sql   # создание 8 таблиц + RLS
        └── 002_add_stats.sql    # +3 колонки в user_stats (health/finance/intellect)
```

Фронтенда нет: `package.json`, `node_modules`, React/Vite — отсутствуют.

---

## 2. Стек и зависимости

**Язык/рантайм:** Python 3.12

**Backend (`backend/requirements.txt`):**
```
fastapi>=0.115
uvicorn[standard]>=0.30
gunicorn>=22.0
aiogram>=3.10
pydantic-settings>=2.4
supabase>=2.7
```

**Архитектура процесса:** один процесс — FastAPI (веб-сервер) + aiogram 3 (бот через вебхук) в одном приложении. Telegram шлёт апдейты на `POST /webhook`, FastAPI передаёт их в диспетчер aiogram.

**База данных:** Supabase (управляемый PostgreSQL). Доступ из Python через `supabase-py` (СИНХРОННЫЙ клиент, вызывается внутри async-обработчиков — см. «Известные проблемы»).

**Хостинг:** Render, Docker Web Service, free tier (512MB RAM, 1 worker).

**AI:** НЕ подключён (Gemini/Groq/whisper запланированы на будущую фазу, кода нет).

**Фронтенд:** отсутствует.

---

## 3. Состояние по модулям

Легенда: ✅ реализовано · 🟡 частично/заглушка · ❌ нет кода.

| Модуль | Статус | Детали |
|---|---|---|
| **Регистрация (/start)** | ✅ | `ensure_user` создаёт пользователя + строку статов |
| **Вода** | ✅ | `/water`: inline-кнопки +250/+500/+1000, прогресс-бар, +2 XP в Здоровье при достижении цели |
| **Ритуалы** | ✅ | `/addritual <название>`, `/rituals` (список, отметка ✅/⬜, стрик x/7), +2 XP в Дисциплину при отметке |
| **RPG-статы** | 🟡 | 8 характеристик хранятся, XP начисляется, уровень пересчитывается. НЕТ команды показа статов (`/stats`), нет паутинки, нет системы рангов |
| **Задачи** | 🟡 | таблица `tasks` создана, обработчиков НЕТ |
| **Питание** | 🟡 | таблица `food_logs` создана, обработчиков НЕТ |
| **Дашборд (/today)** | ❌ | не реализован |
| **Постоянные кнопки (Reply Keyboard)** | ❌ | не реализованы |
| **Встречи / Дневник / Цели / Идеи / Сон / Финансы / Замеры / Inbox / Колесо баланса / Дайджест / Настройки / Онбординг** | ❌ | нет таблиц (кроме общих) и кода |
| **Уведомления / планировщик** | ❌ | отложено (на free-хостинге APScheduler ненадёжен, см. ROADMAP_v2 §4) |
| **AI-слой (фото→КБЖУ, голос→интент, AI-тренер)** | ❌ | не подключён |
| **Mini App (React)** | ❌ | не создан |
| **Мультипользователь** | ❌ | спроектировано на одного; нет моста авторизации initData→JWT |

**Реализованные обработчики (`backend/main.py`):**
- `@dp.message(CommandStart())` → `on_start`
- `@dp.message(Command("water"))` → `cmd_water`
- `@dp.callback_query(F.data.startswith("water:"))` → `cb_water`
- `@dp.message(Command("addritual"))` → `cmd_addritual`
- `@dp.message(Command("rituals"))` → `cmd_rituals`
- `@dp.callback_query(F.data.startswith("ritual:"))` → `cb_ritual`
- `@dp.message()` → `on_any` (заглушка-эхо, ДОЛЖНА быть последней по порядку регистрации)
- `@app.get("/health")` → `health`
- `@app.post("/webhook")` → `telegram_webhook` (проверка секрета через заголовок `X-Telegram-Bot-Api-Secret-Token`)

**Функции данных (`backend/db.py`):**
`get_user_by_tg`, `ensure_user`, `add_xp`, `get_water_today`, `add_water`, `get_rituals`, `add_ritual`, `is_ritual_done_today`, `toggle_ritual`, `ritual_streak_7`.

**Схема БД — таблицы (`001_mvp_schema.sql`):**
`users`, `user_stats`, `xp_events`, `tasks`, `rituals`, `ritual_logs`, `water_logs`, `food_logs`.
RLS включён на всех таблицах (политики `user_id = auth.uid()`), но бэкенд ходит под `service_role`, который RLS обходит — то есть политики сейчас «спят».

**Миграция `002_add_stats.sql`:** добавляет в `user_stats` колонки `health`, `finance`, `intellect` (int, default 0).

**RPG-характеристики (8), переменная `STATS` в `db.py`:**
`strength` (Сила), `endurance` (Выносливость), `nutrition` (Питание), `discipline` (Дисциплина), `reflection` (Рефлексия), `health` (Здоровье), `finance` (Финансы), `intellect` (Интеллект).
Уровень = `floor(среднее_XP_по_8_статам / 100)`.
Текущие источники XP: вода → `health` (+2 при достижении дневной цели), ритуал → `discipline` (+2 при отметке).

---

## 4. Переменные окружения (только названия)

Из `backend/config.py` и `.env.example`:

| Переменная | Обязательна | Назначение |
|---|---|---|
| `BOT_TOKEN` | да | токен бота от @BotFather |
| `SUPABASE_URL` | да | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | да | секретный ключ (`sb_secret_...`), обходит RLS — бэкенд работает под ним |
| `SUPABASE_ANON_KEY` | нет (default "") | публичный ключ (`sb_publishable_...`), пока НЕ используется в коде |
| `WEBHOOK_BASE_URL` | нет (default "") | публичный адрес сервиса на Render; если пусто — вебхук на старте НЕ ставится |
| `PORT` | нет (default 8000) | порт; на Render подставляется автоматически |

Значения нигде в репозитории не хранятся; `.env` в `.gitignore`.

---

## 5. Запуск

**Продакшен (Render, через Docker):**
- Render Web Service, Runtime = Docker, Plan = Free, Region = Frankfurt.
- Сборка по `Dockerfile`. Команда запуска (из Dockerfile):
  ```
  gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120
  ```
- Все переменные окружения задаются в Render → Environment.
- На старте приложение само вызывает `bot.set_webhook(WEBHOOK_BASE_URL + "/webhook", secret_token=...)`. Вебхук на остановке НЕ удаляется (намеренно — иначе спящий free-сервис терял бы связь).
- Проверка живости: `GET https://<service>.onrender.com/health` → `{"status":"ok"}`.
- Диагностика вебхука: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

**Миграции БД (вручную):**
- Supabase → SQL Editor → выполнить файлы по порядку, КАЖДЫЙ отдельным запуском:
  1. `db/migrations/001_mvp_schema.sql`
  2. `db/migrations/002_add_stats.sql`
- Supabase CLI / Alembic НЕ настроены; версионирования миграций нет.

**Локальный запуск (с оговоркой):**
- `cp .env.example .env` и заполнить значениями.
- `pip install -r backend/requirements.txt`
- `cd backend && uvicorn main:app --reload`
- ВНИМАНИЕ: приложение работает ТОЛЬКО через вебхук. Локально без публичного URL бот не получит апдейты. Для локальной разработки нужен туннель (ngrok) с установкой `WEBHOOK_BASE_URL`, либо добавить режим long-polling (сейчас его нет).

---

## 6. Известные проблемы / TODO

1. **Авторизация только под одного пользователя.** Бэкенд использует `service_role`, обходя RLS. Политики RLS созданы, но не действуют. Для мультипользователя нужен мост `initData → Supabase JWT` (с `sub = user_id`) — НЕ реализован.
2. **Синхронный `supabase-py` в async-обработчиках.** Блокирует event loop. Для одного пользователя ок; при росте нагрузки переводить на async (run_in_executor / httpx).
3. **«Фарм» XP на ритуалах.** `toggle_ritual` при снятии удаляет лог; повторная отметка снова даёт +2 XP. Нет защиты «один раз в день». Допустимо для одиночного режима, требует guard позже.
4. **Нет отмены воды.** `add_water` только прибавляет; убавить нельзя. XP за воду начисляется один раз за день при первом пересечении цели (guard `before < goal <= total`).
5. **Нет планировщика / уведомлений / дайджеста.** Отложено: на Render free сервис засыпает (15 мин), APScheduler в процессе ненадёжен. План — внешний cron, дёргающий эндпоинт (ROADMAP_v2 §4).
6. **Холодный старт Render free** (~30–60 c после простоя). Первое сообщение после сна может прийти с задержкой (Telegram повторяет доставку вебхука). Вебхук намеренно не удаляется на shutdown.
7. **Нет автотестов.** Проверка кода — только `python -m py_compile` (синтаксис).
8. **Нет таблицы `stats_history`** в MVP → нет графиков динамики статов.
9. **Миграции применяются вручную** через SQL Editor; запускать строго по одной, не склеивая со старыми (повторный `create table` падает с `relation already exists`). На этапе настройки была путаница; существовал также более полный черновик схемы на 27 таблиц (в отдельном, заброшенном каталоге) — реальное состояние боевой БД стоит сверить с `001_mvp_schema.sql` + `002_add_stats.sql`.
10. **`tasks` и `food_logs` созданы, но без кода** (запланированы следующие этапы: Задачи, Питание).
11. **Секрет вебхука выводится из токена бота** (санитайз → первые 128 символов A–Z/a–z/0–9/_/-). При ротации токена секрет меняется автоматически и переустанавливается на старте — отдельной переменной нет.
12. **Заглушка catch-all** (`on_any`) отвечает текстом-подсказкой на любое нераспознанное сообщение.
13. **Жёстко зашитые строки на русском**, без i18n; язык интерфейса фиксирован (RU).
14. **Система рангов из продуктового документа НЕ реализована** в коде (есть только уровень = среднее/100).

---

## 7. Что дальше по плану (из ROADMAP_v2.md)

- Этап 3 · Задачи (XP → Дисциплина)
- Этап 4 · Питание (ручной ввод КБЖУ, XP → Питание)
- Этап 5 · Дашборд `/today` + `/stats`
- Этап 6 · Постоянные кнопки бота (Reply Keyboard)
- Фаза 2 · Mini App (React) поверх готовых данных; тогда же решается мост авторизации
