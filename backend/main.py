"""MY-OS MVP — сервер.

FastAPI поднимает веб-сервер (для Render и вебхука Telegram),
aiogram обрабатывает сообщения бота.

Команды:
  /start                 — регистрация + привет
  /water                 — вода за день (+2 XP к Питанию при достижении цели)
  /addritual <название>  — создать ритуал
  /rituals               — ритуалы дня, отметка ✅/⬜, стрик x/7 (+2 XP к Дисциплине)
"""

import re
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Update
from fastapi import FastAPI, Header, Request, Response

from config import settings
from db import (
    add_ritual,
    add_water,
    add_xp,
    ensure_user,
    get_rituals,
    get_water_today,
    is_ritual_done_today,
    ritual_streak_7,
    toggle_ritual,
)

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


def rituals_view(rituals: list[dict]) -> str:
    lines = ["🔥 Ритуалы сегодня:\n"]
    for r in rituals:
        mark = "✅" if is_ritual_done_today(r["id"]) else "⬜"
        icon = f"{r['icon']} " if r.get("icon") else ""
        streak = ritual_streak_7(r["id"])
        lines.append(f"{mark} {icon}{r['title']}  ·  {streak}/7")
    lines.append("\nЖми кнопку, чтобы отметить/снять.\nДобавить: /addritual Название")
    return "\n".join(lines)


def rituals_keyboard(rituals: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for r in rituals:
        mark = "✅" if is_ritual_done_today(r["id"]) else "⬜"
        rows.append([
            InlineKeyboardButton(
                text=f"{mark} {r['title']}", callback_data=f"ritual:{r['id']}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# --- Обработчики бота (порядок важен: catch-all всегда последним) -------------

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    await message.answer(
        f"MY-OS на связи 👋\nПривет, {user['name']}!\n\n"
        "Команды:\n/water — вода\n/rituals — ритуалы\n/addritual Название — новый ритуал"
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
        add_xp(user["id"], "health", 2, "water")
        note = "\n\n🎉 Цель по воде выполнена! +2 XP к Здоровью"

    await callback.message.edit_text(
        water_view(total, goal) + note, reply_markup=water_keyboard()
    )
    await callback.answer(f"+{amount} мл")


@dp.message(Command("addritual"))
async def cmd_addritual(message: types.Message, command: CommandObject):
    title = (command.args or "").strip()
    if not title:
        await message.answer("Напиши название после команды:\n/addritual Медитация")
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_ritual(user["id"], title)
    rituals = get_rituals(user["id"])
    await message.answer(
        f"Добавлен ритуал: {title}\n\n" + rituals_view(rituals),
        reply_markup=rituals_keyboard(rituals),
    )


@dp.message(Command("rituals"))
async def cmd_rituals(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    rituals = get_rituals(user["id"])
    if not rituals:
        await message.answer("Ритуалов пока нет.\nДобавь первый: /addritual Медитация")
        return
    await message.answer(rituals_view(rituals), reply_markup=rituals_keyboard(rituals))


@dp.callback_query(F.data.startswith("ritual:"))
async def cb_ritual(callback: types.CallbackQuery):
    ritual_id = callback.data.split(":", 1)[1]
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)

    now_done = toggle_ritual(ritual_id, user["id"])
    if now_done:  # отметили выполненным — начисляем XP
        add_xp(user["id"], "discipline", 2, "rituals")

    rituals = get_rituals(user["id"])
    await callback.message.edit_text(
        rituals_view(rituals), reply_markup=rituals_keyboard(rituals)
    )
    await callback.answer("Отмечено ✅ (+2 XP)" if now_done else "Снято")


@dp.message()
async def on_any(message: types.Message):
    await message.answer("Команды: /water, /rituals, /addritual. Скоро добавим задачи 🙂")


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
