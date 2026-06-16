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
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    Update,
)
from fastapi import FastAPI, Header, Request, Response

from config import settings
from db import (
    STATS,
    add_food,
    add_ritual,
    add_task,
    add_water,
    add_xp,
    complete_task,
    ensure_user,
    get_food_today,
    get_rituals,
    get_tasks,
    get_tasks_done_today,
    get_user_stats,
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

MAIN_KEYBOARD = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="📅 Сегодня"), KeyboardButton(text="⚔️ Статы")],
        [KeyboardButton(text="💧 Вода"), KeyboardButton(text="🔥 Ритуалы")],
        [KeyboardButton(text="✅ Задачи"), KeyboardButton(text="🍽 Питание")],
    ],
    resize_keyboard=True,
)


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


def tasks_view(tasks: list[dict]) -> str:
    if not tasks:
        return "📋 Нет активных задач.\nДобавь: /addtask Название"
    lines = ["📋 Задачи:\n"]
    for t in tasks:
        lines.append(f"⬜ {t['title']}")
    lines.append("\nЖми кнопку, чтобы отметить выполненной.")
    return "\n".join(lines)


def tasks_keyboard(tasks: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for t in tasks:
        rows.append([
            InlineKeyboardButton(
                text=f"✅ {t['title']}", callback_data=f"task:{t['id']}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# --- Обработчики бота (порядок важен: catch-all всегда последним) -------------

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    await message.answer(
        f"MY-OS на связи 👋\nПривет, {user['name']}!",
        reply_markup=MAIN_KEYBOARD,
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


STAT_LABELS = {
    "strength":   "💪 Сила",
    "endurance":  "🏃 Выносливость",
    "nutrition":  "🥗 Питание",
    "discipline": "🔥 Дисциплина",
    "reflection": "🧘 Рефлексия",
    "health":     "❤️ Здоровье",
    "finance":    "💰 Финансы",
    "intellect":  "🧠 Интеллект",
}


@dp.message(Command("today"))
async def cmd_today(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    uid = user["id"]

    water = get_water_today(uid)
    goal = user["water_goal"]
    rituals = get_rituals(uid)
    rituals_done = sum(1 for r in rituals if is_ritual_done_today(r["id"]))
    tasks_done = get_tasks_done_today(uid)
    food = get_food_today(uid)
    kcal = int(sum(e["kcal"] for e in food))
    stats = get_user_stats(uid)

    lines = [
        f"📅 Сводка за сегодня  •  Уровень {stats['level']}\n",
        f"💧 Вода: {water} / {goal} мл  {progress_bar(water, goal, 8)}",
        f"🔥 Ритуалы: {rituals_done} / {len(rituals)}",
        f"✅ Задачи выполнено: {tasks_done}",
        f"🍽 Калории: {kcal} ккал ({len(food)} записей)",
    ]
    await message.answer("\n".join(lines))


@dp.message(Command("stats"))
async def cmd_stats(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    st = get_user_stats(user["id"])
    lines = [f"⚔️ RPG-статы  •  Уровень {st['level']}\n"]
    for key in STATS:
        xp = st[key]
        lvl = xp // 100
        bar = progress_bar(xp % 100, 100, 8)
        lines.append(f"{STAT_LABELS[key]}: {xp} XP (lv{lvl})  {bar}")
    await message.answer("\n".join(lines))


@dp.message(Command("addfood"))
async def cmd_addfood(message: types.Message, command: CommandObject):
    args = (command.args or "").strip().split()
    # последний аргумент — ккал (число), остальное — название
    if len(args) < 2 or not args[-1].lstrip("-").isdigit():
        await message.answer(
            "Формат: /addfood Название ккал\nПример: /addfood Гречка 250"
        )
        return
    kcal = int(args[-1])
    food_name = " ".join(args[:-1])
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_food(user["id"], food_name, kcal)
    add_xp(user["id"], "nutrition", 2, "food")

    entries = get_food_today(user["id"])
    total_kcal = sum(e["kcal"] for e in entries)
    await message.answer(
        f"🍽 Записано: {food_name} — {kcal} ккал  +2 XP к Питанию\n\n"
        f"Итого сегодня: {total_kcal} ккал ({len(entries)} записей)"
    )


@dp.message(Command("food"))
async def cmd_food(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    entries = get_food_today(user["id"])
    if not entries:
        await message.answer("🍽 Сегодня ещё ничего не записано.\nДобавь: /addfood Гречка 250")
        return
    lines = ["🍽 Питание сегодня:\n"]
    for e in entries:
        lines.append(f"• {e['food_name']} — {int(e['kcal'])} ккал")
    total = sum(e["kcal"] for e in entries)
    lines.append(f"\n📊 Итого: {int(total)} ккал")
    await message.answer("\n".join(lines))


@dp.message(Command("addtask"))
async def cmd_addtask(message: types.Message, command: CommandObject):
    title = (command.args or "").strip()
    if not title:
        await message.answer("Напиши название после команды:\n/addtask Купить молоко")
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_task(user["id"], title)
    tasks = get_tasks(user["id"])
    await message.answer(
        f"Задача добавлена: {title}\n\n" + tasks_view(tasks),
        reply_markup=tasks_keyboard(tasks) if tasks else None,
    )


@dp.message(Command("tasks"))
async def cmd_tasks(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    tasks = get_tasks(user["id"])
    await message.answer(
        tasks_view(tasks),
        reply_markup=tasks_keyboard(tasks) if tasks else None,
    )


@dp.callback_query(F.data.startswith("task:"))
async def cb_task(callback: types.CallbackQuery):
    task_id = callback.data.split(":", 1)[1]
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)

    done = complete_task(task_id, user["id"])
    if done:
        add_xp(user["id"], "discipline", 3, "tasks")

    tasks = get_tasks(user["id"])
    await callback.message.edit_text(
        tasks_view(tasks),
        reply_markup=tasks_keyboard(tasks) if tasks else None,
    )
    await callback.answer("Выполнено! +3 XP к Дисциплине" if done else "Уже выполнено")


@dp.message(F.text == "📅 Сегодня")
async def kb_today(message: types.Message):
    await cmd_today(message)


@dp.message(F.text == "⚔️ Статы")
async def kb_stats(message: types.Message):
    await cmd_stats(message)


@dp.message(F.text == "💧 Вода")
async def kb_water(message: types.Message):
    await cmd_water(message)


@dp.message(F.text == "🔥 Ритуалы")
async def kb_rituals(message: types.Message):
    await cmd_rituals(message)


@dp.message(F.text == "✅ Задачи")
async def kb_tasks(message: types.Message):
    await cmd_tasks(message)


@dp.message(F.text == "🍽 Питание")
async def kb_food(message: types.Message):
    await cmd_food(message)


@dp.message()
async def on_any(message: types.Message):
    await message.answer(
        "Используй кнопки внизу или команды:\n/addritual · /addfood · /addtask",
        reply_markup=MAIN_KEYBOARD,
    )


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
