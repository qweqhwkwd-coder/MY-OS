# MY-OS

Личная ОС в виде Telegram-бота + Mini App. Подробный актуальный статус —
`docs/claude/current-state.md`.

## Что внутри
- Бот покрывает 12+ модулей (задачи, ритуалы+вода, питание, дневник, цели,
  идеи, встречи, сон, тренировки, финансы, замеры, inbox, колесо баланса,
  дайджест) + RPG (8 статов, уровень, ранги, HP, стрик).
- Mini App (React, `miniapp/`) — 5 экранов ядра + общий профиль, задеплоен
  на GitHub Pages.

## Стек
- Backend: FastAPI + aiogram 3 (один сервер, вебхук) + Supabase (PostgreSQL)
- Mini App: React 19 + Vite + Tailwind v4, статика
- Деплой: Render (backend, Docker, free tier) + GitHub Pages (Mini App)

## Файлы
- `backend/main.py` — сервер: /health + вебхук + хендлеры бота
- `backend/api_routes.py` — REST API для Mini App (`/api/*`)
- `backend/config.py` — настройки из .env
- `backend/db.py` — подключение к Supabase + все функции данных
- `db/migrations/` — миграции, по одному файлу за раз через SQL Editor (см. `docs/claude/database.md`)
- `miniapp/` — Mini App
- `Dockerfile` — сборка backend для Render

## Запуск (кратко)
1. Прогнать миграции из `db/migrations/` по порядку в Supabase SQL Editor (по одному файлу за раз).
2. Задеплоить backend на Render как Docker Web Service, прописать переменные из `.env.example`.
3. Открыть `/health` → должно вернуть `{"status":"ok"}`.
4. Написать боту `/start`.
