"""MY-OS MVP — сервер.

FastAPI піднімає веб-сервер (для Render і вебхука Telegram),
aiogram обробляє повідомлення бота.

Команди:
  /start                      — реєстрація + привіт
  /today                      — зведення дня
  /stats                      — RPG-стати
  /water                      — вода (+2 XP Здоров'я при досягненні цілі)
  /addritual <назва>          — додати ритуал
  /rituals                    — список ритуалів, відмітка ✅/⬜
  /addtask <назва>            — додати завдання
  /tasks                      — список завдань
  /addfood <назва> [гр] <ккал> — їжа: /addfood Рис 100г 180
  /food                       — харчування за день
  /journal [текст] [1-5]      — щоденник (без аргументів — архів)
  /sleep <ЗЗ:ХХ> <ПП:ХХ>    — сон
  /workout <активність> [хв]  — тренування
  /spend <сума> [категорія]   — витрати
  /finance                    — витрати за день
  /weight [кг]                — вага
  /balance                    — колесо балансу
  /goals / /addgoal / /goalsdone — цілі
  /idea [текст]               — ідеї
  /meetings / /addmeeting     — зустрічі
  /inbox                      — невідсортовані повідомлення
  /digest                     — дайджест за 7 днів
"""

import re
import secrets
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
    BALANCE_FIELDS,
    BALANCE_LABELS,
    add_diary_entry,
    add_food,
    add_goal,
    add_idea,
    add_inbox,
    add_meeting,
    add_ritual,
    add_task,
    add_transaction,
    add_water,
    add_workout,
    add_xp,
    clear_inbox_item,
    complete_goal,
    complete_task,
    detect_workout_type,
    ensure_user,
    get_diary_entries,
    get_diary_entries_by_date,
    get_food_today,
    get_goals,
    get_ideas,
    get_inbox,
    get_last_weights,
    get_ritual_streaks,
    get_rituals,
    get_rituals_done_today,
    get_sleep_today,
    get_tasks,
    get_tasks_done_today,
    get_transactions_today,
    get_upcoming_meetings,
    get_user_stats,
    get_water_today,
    get_week_digest,
    log_sleep,
    log_weight,
    ritual_streak_7,
    save_balance,
    toggle_ritual,
)

bot = Bot(token=settings.bot_token)
dp = Dispatcher()

# Секрет вебхука — окреме значення, не похідне від токена
WEBHOOK_SECRET = settings.webhook_secret or secrets.token_hex(32)
WEBHOOK_PATH = "/webhook"


# --- Помічники відображення ---------------------------------------------------

# Тимчасове сховище оцінок колеса балансу (user_id → {field: score})
_balance_sessions: dict[int, dict] = {}


MAIN_KEYBOARD = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="📅 Сьогодні"), KeyboardButton(text="⚔️ Стати")],
        [KeyboardButton(text="💧 Вода"), KeyboardButton(text="🔥 Ритуали")],
        [KeyboardButton(text="✅ Завдання"), KeyboardButton(text="🍽 Харчування")],
    ],
    resize_keyboard=True,
)


def progress_bar(value: int, goal: int, width: int = 10) -> str:
    goal = goal or 1
    filled = min(width, int(width * value / goal))
    return "▰" * filled + "▱" * (width - filled)


def water_view(total: int, goal: int) -> str:
    return f"💧 Вода сьогодні: {total} / {goal} мл\n{progress_bar(total, goal)}"


def water_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="+250", callback_data="water:250"),
            InlineKeyboardButton(text="+500", callback_data="water:500"),
            InlineKeyboardButton(text="+1000", callback_data="water:1000"),
        ]]
    )


def rituals_view(rituals: list[dict], done: set, streaks: dict) -> str:
    lines = ["🔥 Ритуали сьогодні:\n"]
    for r in rituals:
        mark = "✅" if r["id"] in done else "⬜"
        icon = f"{r['icon']} " if r.get("icon") else ""
        streak = streaks.get(r["id"], 0)
        lines.append(f"{mark} {icon}{r['title']}  ·  {streak}/7")
    lines.append("\nНатисни кнопку, щоб відмітити/зняти.\nДодати: /addritual Назва")
    return "\n".join(lines)


def rituals_keyboard(rituals: list[dict], done: set) -> InlineKeyboardMarkup:
    rows = []
    for r in rituals:
        mark = "✅" if r["id"] in done else "⬜"
        rows.append([
            InlineKeyboardButton(
                text=f"{mark} {r['title']}", callback_data=f"ritual:{r['id']}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _ritual_state(user_id: str, rituals: list[dict]) -> tuple[set, dict]:
    if not rituals:
        return set(), {}
    done = get_rituals_done_today(user_id)
    streaks = get_ritual_streaks(user_id)
    return done, streaks


def tasks_view(tasks: list[dict]) -> str:
    if not tasks:
        return "📋 Немає активних завдань.\nДодай: /addtask Назва"
    lines = ["📋 Завдання:\n"]
    for t in tasks:
        lines.append(f"⬜ {t['title']}")
    lines.append("\nНатисни кнопку, щоб відмітити виконаним.")
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


def _sum_kcal(entries: list[dict]) -> int:
    """Сума ккал; None-значення пропускаємо, 0 — рахуємо."""
    return int(sum(e["kcal"] for e in entries if e.get("kcal") is not None))


# --- Парсер їжі ---------------------------------------------------------------

def _parse_addfood(args_str: str) -> tuple[str, int | None, int] | None:
    """Парсить 'Назва [Xг] ккал'. Повертає (food_name, grams, kcal) або None.

    Підтримувані формати:
      Гречка 250
      Рис 100г 180
      Рис 100 180       ← грами без суфікса якщо передостанній токен — число
    """
    parts = args_str.split()
    if len(parts) < 2:
        return None
    if not parts[-1].lstrip("-").isdigit():
        return None

    kcal = int(parts[-1])
    if kcal <= 0:
        return None  # від'ємні та нульові ккал не приймаємо

    rest = parts[:-1]

    grams: int | None = None
    if len(rest) >= 2:
        g_token = rest[-1].rstrip("гgG")
        if g_token.isdigit():
            grams = int(g_token)
            rest = rest[:-1]

    food_name = " ".join(rest).strip()
    if not food_name:
        return None  # не дозволяємо порожню назву

    return food_name, grams, kcal


# --- Обробники бота (catch-all завжди останнім) --------------------------------

@dp.message(CommandStart())
async def on_start(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    await message.answer(
        f"MY-OS на зв'язку 👋\nПривіт, {user['name']}!",
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
    if before < goal <= total:
        add_xp(user["id"], "health", 2, "water")
        note = "\n\n🎉 Ціль по воді виконана! +2 XP до Здоров'я"

    await callback.message.edit_text(
        water_view(total, goal) + note, reply_markup=water_keyboard()
    )
    await callback.answer(f"+{amount} мл")


@dp.message(Command("addritual"))
async def cmd_addritual(message: types.Message, command: CommandObject):
    title = (command.args or "").strip()
    if not title:
        await message.answer("Напиши назву після команди:\n/addritual Медитація")
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_ritual(user["id"], title)
    rituals = get_rituals(user["id"])
    done, streaks = _ritual_state(user["id"], rituals)
    await message.answer(
        f"Додано ритуал: {title}\n\n" + rituals_view(rituals, done, streaks),
        reply_markup=rituals_keyboard(rituals, done),
    )


@dp.message(Command("rituals"))
async def cmd_rituals(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    rituals = get_rituals(user["id"])
    if not rituals:
        await message.answer("Ритуалів поки немає.\nДодай перший: /addritual Медитація")
        return
    done, streaks = _ritual_state(user["id"], rituals)
    await message.answer(rituals_view(rituals, done, streaks), reply_markup=rituals_keyboard(rituals, done))


@dp.callback_query(F.data.startswith("ritual:"))
async def cb_ritual(callback: types.CallbackQuery):
    ritual_id = callback.data.split(":", 1)[1]
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)

    now_done = toggle_ritual(ritual_id, user["id"])
    if now_done:
        add_xp(user["id"], "discipline", 2, "rituals")

    rituals = get_rituals(user["id"])
    done, streaks = _ritual_state(user["id"], rituals)
    await callback.message.edit_text(
        rituals_view(rituals, done, streaks), reply_markup=rituals_keyboard(rituals, done)
    )
    await callback.answer("Відмічено ✅ (+2 XP)" if now_done else "Знято")


STAT_LABELS = {
    "strength":   "💪 Сила",
    "endurance":  "🏃 Витривалість",
    "nutrition":  "🥗 Харчування",
    "discipline": "🔥 Дисципліна",
    "reflection": "🧘 Рефлексія",
    "health":     "❤️ Здоров'я",
    "finance":    "💰 Фінанси",
    "intellect":  "🧠 Інтелект",
}


@dp.message(Command("today"))
async def cmd_today(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    uid = user["id"]

    water = get_water_today(uid)
    goal = user["water_goal"]
    rituals = get_rituals(uid)
    done_set = get_rituals_done_today(uid)
    rituals_done = sum(1 for r in rituals if r["id"] in done_set)
    tasks_done = get_tasks_done_today(uid)
    food = get_food_today(uid)
    kcal = _sum_kcal(food)
    stats = get_user_stats(uid)

    lines = [
        f"📅 Зведення за сьогодні  •  Рівень {stats['level']}\n",
        f"💧 Вода: {water} / {goal} мл  {progress_bar(water, goal, 8)}",
        f"🔥 Ритуали: {rituals_done} / {len(rituals)}",
        f"✅ Завдань виконано: {tasks_done}",
        f"🍽 Калорії: {kcal} ккал ({len(food)} записів)",
    ]
    await message.answer("\n".join(lines))


@dp.message(Command("stats"))
async def cmd_stats(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    st = get_user_stats(user["id"])
    lines = [f"⚔️ RPG-стати  •  Рівень {st['level']}\n"]
    for key in STATS:
        xp = st[key]
        lvl = xp // 100
        bar = progress_bar(xp % 100, 100, 8)
        lines.append(f"{STAT_LABELS[key]}: {xp} XP (lv{lvl})  {bar}")
    await message.answer("\n".join(lines))


@dp.message(Command("addfood"))
async def cmd_addfood(message: types.Message, command: CommandObject):
    parsed = _parse_addfood((command.args or "").strip())
    if not parsed:
        await message.answer(
            "Формат: /addfood Назва [грами] ккал\n"
            "Приклади:\n/addfood Гречка 250\n/addfood Рис 100г 180"
        )
        return
    food_name, grams, kcal = parsed
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_food(user["id"], food_name, kcal, grams)
    add_xp(user["id"], "nutrition", 2, "food")

    entries = get_food_today(user["id"])
    total_kcal = _sum_kcal(entries)
    grams_str = f" {grams}г" if grams else ""
    await message.answer(
        f"🍽 Записано: {food_name}{grams_str} — {kcal} ккал  +2 XP до Харчування\n\n"
        f"Всього сьогодні: {total_kcal} ккал ({len(entries)} записів)"
    )


@dp.message(Command("food"))
async def cmd_food(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    entries = get_food_today(user["id"])
    if not entries:
        await message.answer("🍽 Сьогодні ще нічого не записано.\nДодай: /addfood Гречка 250")
        return
    lines = ["🍽 Харчування сьогодні:\n"]
    for e in entries:
        grams_str = f" {int(e['grams'])}г" if e.get("grams") is not None else ""
        lines.append(f"• {e['food_name']}{grams_str} — {int(e['kcal'])} ккал")
    lines.append(f"\n📊 Всього: {_sum_kcal(entries)} ккал")
    await message.answer("\n".join(lines))


@dp.message(Command("addtask"))
async def cmd_addtask(message: types.Message, command: CommandObject):
    title = (command.args or "").strip()
    if not title:
        await message.answer("Напиши назву після команди:\n/addtask Купити молоко")
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_task(user["id"], title)
    tasks = get_tasks(user["id"])
    await message.answer(
        f"Завдання додано: {title}\n\n" + tasks_view(tasks),
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
    await callback.answer("Виконано! +3 XP до Дисципліни" if done else "Вже виконано")


def _balance_keyboard(field: str) -> InlineKeyboardMarkup:
    row = [InlineKeyboardButton(text=str(i), callback_data=f"bal:{field}:{i}") for i in range(1, 11)]
    return InlineKeyboardMarkup(inline_keyboard=[row])


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    _balance_sessions[message.from_user.id] = {}
    field = BALANCE_FIELDS[0]
    await message.answer(
        f"🎡 Колесо балансу\nОціни кожну сферу від 1 до 10.\n\n"
        f"1/{len(BALANCE_FIELDS)}  {BALANCE_LABELS[field]}:",
        reply_markup=_balance_keyboard(field),
    )


@dp.callback_query(F.data.startswith("bal:"))
async def cb_balance(callback: types.CallbackQuery):
    parts = callback.data.split(":", 2)
    if len(parts) != 3 or parts[1] not in BALANCE_FIELDS:
        await callback.answer("Застаріла кнопка. Запусти /balance знову.")
        return
    _, field, score_str = parts
    score = int(score_str)
    uid = callback.from_user.id
    user = ensure_user(uid, callback.from_user.full_name)

    session = _balance_sessions.get(uid)
    if session is None:
        await callback.message.edit_text(
            "🎡 Сесія застаріла після перезапуску. Запусти /balance знову."
        )
        await callback.answer("Сесія закінчилась")
        return

    session[field] = score

    fields = list(BALANCE_FIELDS)
    idx = fields.index(field)
    next_idx = idx + 1

    if next_idx < len(fields):
        nfield = fields[next_idx]
        await callback.message.edit_text(
            f"🎡 Колесо балансу\n\n"
            f"{next_idx + 1}/{len(fields)}  {BALANCE_LABELS[nfield]}:",
            reply_markup=_balance_keyboard(nfield),
        )
        await callback.answer(f"{BALANCE_LABELS[field]}: {score}/10")
    else:
        all_filled = all(f in session for f in fields)
        if not all_filled:
            await callback.message.edit_text(
                "⚠️ Не всі сфери оцінені. Запусти /balance знову."
            )
            _balance_sessions.pop(uid, None)
            await callback.answer("Неповна сесія")
            return

        save_balance(user["id"], session)
        add_xp(user["id"], "reflection", 3, "balance")
        _balance_sessions.pop(uid, None)

        lines = ["🎡 Колесо балансу збережено  +3 XP до Рефлексії\n"]
        for f in fields:
            bar = "█" * session[f] + "░" * (10 - session[f])
            lines.append(f"{BALANCE_LABELS[f][:10]:10} {bar} {session[f]}")
        await callback.message.edit_text("\n".join(lines))
        await callback.answer("Готово!")


@dp.message(Command("inbox"))
async def cmd_inbox(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    items = get_inbox(user["id"])
    if not items:
        await message.answer("📥 Inbox порожній.\nБудь-яке повідомлення без команди потрапляє сюди.")
        return
    lines = [f"📥 Inbox ({len(items)} шт.):\n"]
    rows = []
    for item in items:
        lines.append(f"• {item['text']}")
        rows.append([InlineKeyboardButton(text=f"✅ {item['text'][:40]}", callback_data=f"inbox:{item['id']}")])
    lines.append("\nНатисни щоб відмітити опрацьованим:")
    await message.answer("\n".join(lines), reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("inbox:"))
async def cb_inbox(callback: types.CallbackQuery):
    item_id = callback.data.split(":", 1)[1]
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)
    clear_inbox_item(item_id, user["id"])
    items = get_inbox(user["id"])
    if not items:
        await callback.message.edit_text("📥 Inbox порожній.")
        await callback.answer("Опрацьовано")
        return
    lines = [f"📥 Inbox ({len(items)} шт.):\n"]
    rows = []
    for item in items:
        lines.append(f"• {item['text']}")
        rows.append([InlineKeyboardButton(text=f"✅ {item['text'][:40]}", callback_data=f"inbox:{item['id']}")])
    lines.append("\nНатисни щоб відмітити опрацьованим:")
    await callback.message.edit_text("\n".join(lines), reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))
    await callback.answer("Опрацьовано")


@dp.message(Command("digest"))
async def cmd_digest(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    d = get_week_digest(user["id"])
    await message.answer(
        "📊 Дайджест за 7 днів\n\n"
        f"💧 Вода: {d['water_total']} мл ({d['water_days']} днів)\n"
        f"🔥 Ритуалів виконано: {d['rituals_done']}\n"
        f"✅ Завдань виконано: {d['tasks_done']}\n"
        f"🍽 Середнє ккал/день: {d['kcal_avg']}\n"
        f"😴 Середній сон: {d['sleep_avg_h']:.0f}г\n"
        f"🏋️ Тренувань: {d['workouts']}\n"
        f"💸 Витрачено: {d['spend_total']}\n"
        f"⚡ XP зароблено: {d['xp_earned']}"
    )


@dp.message(Command("addmeeting"))
async def cmd_addmeeting(message: types.Message, command: CommandObject):
    args = (command.args or "").strip()
    if not args:
        await message.answer(
            "Формат: /addmeeting Назва РРРР-ММ-ДД [ГГ:ХХ]\n"
            "Приклад: /addmeeting Зустріч з лікарем 2026-06-20 14:00"
        )
        return
    parts = args.split()
    meeting_date = None
    meeting_time = None
    title_parts = []
    for p in parts:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", p):
            meeting_date = p
        elif re.match(r"^\d{2}:\d{2}$", p):
            meeting_time = p
        else:
            title_parts.append(p)
    if not meeting_date:
        await message.answer("Вкажи дату у форматі РРРР-ММ-ДД.\nПриклад: /addmeeting Зустріч 2026-06-20 14:00")
        return
    title = " ".join(title_parts) or "Зустріч"
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_meeting(user["id"], title, meeting_date, meeting_time)
    time_str = f" о {meeting_time}" if meeting_time else ""
    await message.answer(f"📅 Зустріч додана: {title}\n{meeting_date}{time_str}")


@dp.message(Command("meetings"))
async def cmd_meetings(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    meetings = get_upcoming_meetings(user["id"])
    if not meetings:
        await message.answer("📅 Майбутніх зустрічей немає.\nДодай: /addmeeting Назва 2026-06-20 14:00")
        return
    lines = ["📅 Майбутні зустрічі:\n"]
    for m in meetings:
        time_str = f" {m['time'][:5]}" if m.get("time") else ""
        lines.append(f"• {m['date']}{time_str} — {m['title']}")
    await message.answer("\n".join(lines))


@dp.message(Command("workout"))
async def cmd_workout(message: types.Message, command: CommandObject):
    args = (command.args or "").strip()
    if not args:
        await message.answer(
            "Формат: /workout активність [хвилини]\n"
            "Приклади:\n/workout Біг 30\n/workout Силове тренування 60\n/workout Йога"
        )
        return
    parts = args.rsplit(maxsplit=1)
    duration = None
    activity = args
    if len(parts) == 2 and parts[1].isdigit():
        duration = int(parts[1])
        activity = parts[0]

    workout_type = detect_workout_type(activity)
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_workout(user["id"], activity, duration, workout_type)

    xp_stat = {"cardio": "endurance", "strength": "strength", "flexibility": "health"}.get(workout_type, "discipline")
    xp_label = {"cardio": "Витривалість", "strength": "Сила", "flexibility": "Здоров'я"}.get(workout_type, "Дисципліна")
    add_xp(user["id"], xp_stat, 5, "workout")

    dur_str = f"  ⏱ {duration} хв" if duration else ""
    type_emoji = {"cardio": "🏃", "strength": "💪", "flexibility": "🧘"}.get(workout_type, "🏋️")
    await message.answer(
        f"{type_emoji} Тренування записано: {activity}{dur_str}\n+5 XP до {xp_label}"
    )


@dp.message(Command("addgoal"))
async def cmd_addgoal(message: types.Message, command: CommandObject):
    args = (command.args or "").strip()
    if not args:
        await message.answer("Формат: /addgoal Назва [РРРР-ММ-ДД]\nПриклад: /addgoal Вивчити іспанську 2026-12-31")
        return
    parts = args.rsplit(maxsplit=1)
    deadline = None
    title = args
    if len(parts) == 2:
        try:
            from datetime import datetime
            datetime.strptime(parts[1], "%Y-%m-%d")
            deadline = parts[1]
            title = parts[0]
        except ValueError:
            pass
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_goal(user["id"], title, deadline)
    dl_str = f"  📅 до {deadline}" if deadline else ""
    await message.answer(f"🎯 Ціль додана: {title}{dl_str}")


@dp.message(Command("goals"))
async def cmd_goals(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    goals = get_goals(user["id"])
    if not goals:
        await message.answer("🎯 Цілей немає.\nДодай: /addgoal Назва")
        return
    lines = ["🎯 Активні цілі:\n"]
    for g in goals:
        dl = f"  (до {g['deadline']})" if g.get("deadline") else ""
        lines.append(f"• {g['title']}{dl}")
    lines.append("\nВиконати: /goalsdone")
    await message.answer("\n".join(lines))


@dp.message(Command("goalsdone"))
async def cmd_goalsdone(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    goals = get_goals(user["id"])
    if not goals:
        await message.answer("Немає активних цілей.")
        return
    rows = []
    for g in goals:
        rows.append([InlineKeyboardButton(text=f"✅ {g['title']}", callback_data=f"goal:{g['id']}")])
    await message.answer("Обери виконану ціль:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


@dp.callback_query(F.data.startswith("goal:"))
async def cb_goal(callback: types.CallbackQuery):
    goal_id = callback.data.split(":", 1)[1]
    user = ensure_user(callback.from_user.id, callback.from_user.full_name)
    done = complete_goal(goal_id, user["id"])
    if done:
        add_xp(user["id"], "discipline", 10, "goals")
        add_xp(user["id"], "reflection", 5, "goals")
    await callback.message.delete()
    await callback.answer("🏆 Ціль виконана! +10 XP Дисципліна +5 XP Рефлексія" if done else "Вже виконана")


@dp.message(Command("idea"))
async def cmd_idea(message: types.Message, command: CommandObject):
    text = (command.args or "").strip()
    if not text:
        user = ensure_user(message.from_user.id, message.from_user.full_name)
        ideas = get_ideas(user["id"])
        if not ideas:
            await message.answer("💡 Ідей немає.\nДодай: /idea текст")
            return
        lines = ["💡 Ідеї:\n"]
        for i, idea in enumerate(ideas, 1):
            lines.append(f"{i}. {idea['text']}")
        await message.answer("\n".join(lines))
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_idea(user["id"], text)
    await message.answer("💡 Ідею збережено!")


@dp.message(Command("weight"))
async def cmd_weight(message: types.Message, command: CommandObject):
    arg = (command.args or "").strip().replace(",", ".")
    if not arg:
        user = ensure_user(message.from_user.id, message.from_user.full_name)
        entries = get_last_weights(user["id"])
        if not entries:
            await message.answer("⚖️ Замірів немає.\nДодай: /weight 80.5")
            return
        lines = ["⚖️ Останні заміри:\n"]
        for e in entries:
            lines.append(f"• {e['date']} — {e['weight']} кг")
        await message.answer("\n".join(lines))
        return
    try:
        weight = float(arg)
    except ValueError:
        await message.answer("Невірний формат. Приклад: /weight 80.5")
        return
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    log_weight(user["id"], weight)
    add_xp(user["id"], "reflection", 1, "body")
    await message.answer(f"⚖️ Вагу записано: {weight} кг  +1 XP до Рефлексії")


MOOD_EMOJI = {1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄"}


@dp.message(Command("journal"))
async def cmd_journal(message: types.Message, command: CommandObject):
    text = (command.args or "").strip()
    user = ensure_user(message.from_user.id, message.from_user.full_name)

    if not text:
        entries = get_diary_entries(user["id"], limit=10)
        if not entries:
            await message.answer(
                "📓 Щоденник порожній.\n\n"
                "Додати запис: /journal текст [настрій 1-5]\n"
                "Приклад: /journal Гарний день 4\n\n"
                "Архів за датою: /journal 2026-06-15"
            )
            return
        lines = ["📓 Щоденник (останні записи):\n"]
        for e in entries:
            mood_str = f"  {MOOD_EMOJI[e['mood']]}" if e.get("mood") else ""
            lines.append(f"📅 {e['date']}{mood_str}\n{e['text']}\n")
        await message.answer("\n".join(lines))
        return

    # Архів по даті: /journal РРРР-ММ-ДД
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        entries = get_diary_entries_by_date(user["id"], text)
        if not entries:
            await message.answer(f"📓 Записів за {text} немає.")
            return
        lines = [f"📓 Щоденник за {text}:\n"]
        for e in entries:
            mood_str = f"  {MOOD_EMOJI[e['mood']]}" if e.get("mood") else ""
            lines.append(f"{e['text']}{mood_str}\n")
        await message.answer("\n".join(lines))
        return

    # Новий запис: /journal текст [1-5]
    parts = text.rsplit(maxsplit=1)
    mood = None
    if len(parts) == 2 and parts[1].isdigit() and 1 <= int(parts[1]) <= 5:
        mood = int(parts[1])
        text = parts[0]

    add_diary_entry(user["id"], text, mood)
    add_xp(user["id"], "reflection", 2, "journal")

    mood_str = f"  Настрій: {MOOD_EMOJI[mood]}" if mood else ""
    await message.answer(f"📓 Записано в щоденник  +2 XP до Рефлексії{mood_str}")


@dp.message(Command("spend"))
async def cmd_spend(message: types.Message, command: CommandObject):
    parts = (command.args or "").strip().split(maxsplit=1)
    try:
        amount = float(parts[0]) if parts else None
        if amount is None or amount <= 0:
            raise ValueError
    except (ValueError, IndexError):
        await message.answer("Формат: /spend сума категорія\nПриклад: /spend 500 їжа")
        return
    category = parts[1].strip() if len(parts) > 1 else "інше"
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    add_transaction(user["id"], amount, category)
    add_xp(user["id"], "finance", 1, "finance")

    entries = get_transactions_today(user["id"])
    total = sum(e["amount"] for e in entries)
    await message.answer(
        f"💸 Записано: {amount:.0f} — {category}  +1 XP до Фінансів\n"
        f"Всього сьогодні: {total:.0f}"
    )


@dp.message(Command("finance"))
async def cmd_finance(message: types.Message):
    user = ensure_user(message.from_user.id, message.from_user.full_name)
    entries = get_transactions_today(user["id"])
    if not entries:
        await message.answer("💰 Сьогодні витрат немає.\nДодай: /spend 500 їжа")
        return
    lines = ["💰 Витрати сьогодні:\n"]
    for e in entries:
        lines.append(f"• {e['category']} — {e['amount']:.0f}")
    lines.append(f"\n📊 Всього: {sum(e['amount'] for e in entries):.0f}")
    await message.answer("\n".join(lines))


@dp.message(Command("sleep"))
async def cmd_sleep(message: types.Message, command: CommandObject):
    parts = (command.args or "").strip().split()
    if len(parts) != 2:
        await message.answer(
            "Формат: /sleep ГГ:ХХ ГГ:ХХ\nПриклад: /sleep 23:30 7:15\n(засинання → пробудження)"
        )
        return

    def parse_time(s: str) -> int:
        h, m = map(int, s.split(":"))
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError(f"Invalid time: {s}")
        return h * 60 + m

    try:
        sleep_min = parse_time(parts[0])
        wake_min = parse_time(parts[1])
    except ValueError:
        await message.answer("Невірний формат часу. Приклад: /sleep 23:30 7:15")
        return

    duration = wake_min - sleep_min
    if duration <= 0:
        duration += 24 * 60

    hours = duration // 60
    mins = duration % 60

    user = ensure_user(message.from_user.id, message.from_user.full_name)
    log_sleep(user["id"], parts[0], parts[1], duration)

    xp_note = ""
    if 7 * 60 <= duration <= 9 * 60:
        add_xp(user["id"], "health", 3, "sleep")
        xp_note = "  +3 XP до Здоров'я 🎉"

    await message.answer(
        f"😴 Сон записано: {parts[0]} → {parts[1]}\n"
        f"⏱ Тривалість: {hours}г {mins}хв{xp_note}"
    )


# --- Reply keyboard shortcuts -------------------------------------------------

@dp.message(F.text == "📅 Сьогодні")
async def kb_today(message: types.Message):
    await cmd_today(message)


@dp.message(F.text == "⚔️ Стати")
async def kb_stats(message: types.Message):
    await cmd_stats(message)


@dp.message(F.text == "💧 Вода")
async def kb_water(message: types.Message):
    await cmd_water(message)


@dp.message(F.text == "🔥 Ритуали")
async def kb_rituals(message: types.Message):
    await cmd_rituals(message)


@dp.message(F.text == "✅ Завдання")
async def kb_tasks(message: types.Message):
    await cmd_tasks(message)


@dp.message(F.text == "🍽 Харчування")
async def kb_food(message: types.Message):
    await cmd_food(message)


# Catch-all — ЗАВЖДИ ОСТАННІМ
@dp.message()
async def on_any(message: types.Message):
    if not message.from_user:
        return
    text = message.text or ""
    if text:
        try:
            user = ensure_user(message.from_user.id, message.from_user.full_name)
            add_inbox(user["id"], text)
            await message.answer("📥 Збережено в Inbox.\n/inbox — перегляд", reply_markup=MAIN_KEYBOARD)
        except Exception:
            await message.answer("Використовуй кнопки внизу.", reply_markup=MAIN_KEYBOARD)
    else:
        await message.answer("Використовуй кнопки внизу.", reply_markup=MAIN_KEYBOARD)


# --- Веб-сервер ---------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.webhook_base_url:
        base = settings.webhook_base_url.rstrip("/")
        webhook_url = f"{base}{WEBHOOK_PATH}"
        await bot.set_webhook(
            webhook_url, secret_token=WEBHOOK_SECRET, drop_pending_updates=True
        )
        print(f"[startup] webhook set to {webhook_url}", flush=True)
    else:
        print("[startup] WEBHOOK_BASE_URL порожній — вебхук НЕ встановлено", flush=True)
    yield
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
