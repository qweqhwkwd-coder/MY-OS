# MY-OS (MVP)

Личная ОС в виде Telegram-бота + Mini App. Минимальная первая версия.

## Что внутри (MVP)
- Дашборд, Задачи, Ритуалы + вода, Питание (ручной ввод), простой RPG.

## Стек
- FastAPI + aiogram 3 (один сервер, вебхук)
- Supabase (PostgreSQL)
- Деплой: Render (Docker, free tier)

## Файлы
- `backend/main.py` — сервер: /health + вебхук бота
- `backend/config.py` — настройки из .env
- `backend/db.py` — подключение к Supabase
- `db/migrations/001_mvp_schema.sql` — схема базы
- `Dockerfile` — сборка для Render

## Запуск (кратко)
1. Прогнать `db/migrations/001_mvp_schema.sql` в Supabase SQL Editor.
2. Задеплоить на Render как Docker Web Service, прописать переменные из `.env.example`.
3. Открыть `/health` → должно вернуть `{"status":"ok"}`.
4. Написать боту `/start`.
