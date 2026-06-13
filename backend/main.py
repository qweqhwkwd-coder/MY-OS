"""MY-OS MVP — сервер.

Что тут происходит:
- FastAPI поднимает веб-сервер (нужен Render и для вебхука Telegram).
- aiogram обрабатывает сообщения бота.
- На старте сервер сам прописывает вебхук в Telegram.
- /health — простая проверка "сервер жив".
- /start в боте — создаёт тебя в базе и здоровается (проверка, что БД работает).
"""

import re
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import Update
from fastapi import FastAPI, Header, Request, Response

from config import settings
from db import ensure_user

bot = Bot(token=settings.bot_token)
dp = Dispatcher()

# Секрет для вебхука: берём из токена (буквы/цифры) — чтобы чужой не слал фейк.
WEBHOOK_SECRET = re.sub(r"[^A-Za-z0-9_-]", "", settings.bot_token)[:128]
WEBHOOK_PATH = "/webhook"


# --- Обработчики бота --------------------------------------------------------

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    await message.answer(
        f"MY-OS на связи 👋\nПривет, {user['name']}! Ты записан в базу."
    )


@dp.message()
async def on_any(message: types.Message):
    # Заглушка: пока просто отвечаем. Логику модулей добавим позже.
    await message.answer("Принял. Модули скоро появятся 🙂")


# --- Веб-сервер --------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # При запуске сервера прописываем вебхук в Telegram.
    if settings.webhook_base_url:
        await bot.set_webhook(
            f"{settings.webhook_base_url}{WEBHOOK_PATH}",
            secret_token=WEBHOOK_SECRET,
            drop_pending_updates=True,
        )
    yield
    # При остановке — убираем вебхук и закрываем сессию.
    await bot.delete_webhook()
    await bot.session.close()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post(WEBHOOK_PATH)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=""),
):
    # Проверяем, что запрос реально от Telegram, а не подделка.
    if x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
        return Response(status_code=403)

    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}
