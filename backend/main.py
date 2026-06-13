"""MY-OS MVP — сервер.

FastAPI поднимает веб-сервер (для Render и вебхука Telegram),
aiogram обрабатывает сообщения бота.

Команды:
  /start  — регистрация + привет
  /water  — вода за день: кнопки +250/+500/+1000, +2 XP к Питанию при достижении цели
"""

import re
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Update
from fastapi import FastAPI, Header, Request, Response

from config import settings
from db import add_water, add_xp, ensure_user, get_water_today

bot = Bot(token=settings.bot_token)
dp = Dispatcher()

# Секрет для вебхука (из токена) — чтобы чужой не слал фейковые апдейты.
WEBHOOK_SECRET = re.sub(r"[^A-Za-z0-9_-]", "", settings.bot_token)[:128]
WEBHOOK_PATH = "/webhook"


# --- Помощники отображения ---------------------------------------------------

def progress_bar(value: int, goal: int, width: int = 10) -> str:
    """Текстовый прогресс-бар: ▰▰▰▱▱▱▱▱▱▱"""
    goal = goal or 1
    filled = min(width, int(width * value / goal))
    return "▰" * filled + "▱" * (width - filled)


def water_view(total: int, goal: int) -> str:
    return f"💧 Вода сегодня: {total} / {goal} мл\n{progress_bar(total, goal)}"


def water_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="+250", callback_data="water:250"),
            InlineKeyboardButton(text="+500", callback_data="water:500"),
            InlineKeyboardButton(text="+1000", callback_data="water:1000"),
        ]]
    )


# --- Обработчики бота (порядок важен: catch-all всегда последним) -------------

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    await message.answer(
        f"MY-OS на связи 👋\nПривет, {user['name']}!\n\n"
        "Команда /water — отметить воду за день."
    )


@dp.message(Command("water"))
async def cmd_water(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    total = get_water_today(user["id"])
    await message.answer(
        water_view(total, user["water_goal"]), reply_markup=water_keyboard()
    )


@dp.callback_query(F.data.startswith("water:"))
async def cb_water(callback: types.CallbackQuery):
    amount = int(callback.data.split(":")[1])
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)
    goal = user["water_goal"]

    before = get_water_today(user["id"])
    total = add_water(user["id"], amount)

    note = ""
    if before < goal <= total:  # цель достигнута впервые за сегодня
        add_xp(user["id"], "nutrition", 2, "water")
        note = "\n\n🎉 Цель по воде выполнена! +2 XP к Питанию"

    await callback.message.edit_text(
        water_view(total, goal) + note, reply_markup=water_keyboard()
    )
    await callback.answer(f"+{amount} мл")


@dp.message()
async def on_any(message: types.Message):
    await message.answer("Пока умею /water. Скоро добавим задачи и остальное 🙂")


# --- Веб-сервер --------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.webhook_base_url:
        base = settings.webhook_base_url.rstrip("/")  # защита от слэша в конце
        webhook_url = f"{base}{WEBHOOK_PATH}"
        await bot.set_webhook(
            webhook_url, secret_token=WEBHOOK_SECRET, drop_pending_updates=True
        )
        print(f"[startup] webhook set to {webhook_url}", flush=True)
    else:
        print("[startup] WEBHOOK_BASE_URL пустой — вебхук НЕ установлен", flush=True)
    yield
    # Вебхук НЕ удаляем: на free-хостинге сервис часто перезапускается.
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
    if x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
        return Response(status_code=403)
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}
