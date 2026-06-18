"""Подключение к базе Supabase и помощники для работы с данными.

На MVP пользователь один, поэтому бэкенд ходит в базу под service_role
(полный доступ) — сложная авторизация не нужна.
"""

DEFAULT_WATER_GOAL = 2000

from datetime import date, datetime, timedelta, timezone

from supabase import Client, create_client

from config import settings

supabase: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)

# Восемь RPG-характеристик
STATS = (
    "strength",    # Сила — силовые
    "endurance",   # Выносливость — кардио
    "nutrition",   # Питание — еда (КБЖУ)
    "discipline",  # Дисциплина — ритуалы, задачи
    "reflection",  # Рефлексия — дневник, цели
    "health",      # Здоровье — вода, сон
    "finance",     # Финансы — расходы, бюджет
    "intellect",   # Интеллект — обучение, чтение
)


# --- Пользователь -------------------------------------------------------------

def get_user_by_tg(telegram_id: int) -> dict | None:
    res = supabase.table("users").select("*").eq("telegram_id", telegram_id).execute()
    return res.data[0] if res.data else None


def ensure_user(telegram_id: int, name: str) -> dict:
    """Находит пользователя или создаёт нового вместе со стартовыми статами."""
    found = get_user_by_tg(telegram_id)
    if found:
        return found
    created = (
        supabase.table("users")
        .insert({"telegram_id": telegram_id, "name": name})
        .execute()
    )
    user = created.data[0]
    supabase.table("user_stats").insert({"user_id": user["id"]}).execute()
    return user


# --- RPG ----------------------------------------------------------------------

def add_xp(user_id: str, stat: str, amount: int, source: str) -> None:
    """Начисляет XP в характеристику, логирует событие и пересчитывает уровень."""
    supabase.table("xp_events").insert(
        {
            "user_id": user_id,
            "source_module": source,
            "stat_affected": stat,
            "xp_amount": amount,
        }
    ).execute()

    rows = supabase.table("user_stats").select("*").eq("user_id", user_id).execute().data
    if not rows:
        try:
            supabase.table("user_stats").insert({"user_id": user_id}).execute()
        except Exception:
            pass  # concurrent insert already created the row
        rows = supabase.table("user_stats").select("*").eq("user_id", user_id).execute().data
    stats = rows[0]
    new_val = stats[stat] + amount

    total = sum(stats[s] for s in STATS) - stats[stat] + new_val
    level = total // 100

    supabase.table("user_stats").update(
        {stat: new_val, "level": level}
    ).eq("user_id", user_id).execute()


# --- Вода ---------------------------------------------------------------------

def get_water_today(user_id: str) -> int:
    """Сколько мл воды уже выпито сегодня (0 если записей нет)."""
    today = date.today().isoformat()
    res = (
        supabase.table("water_logs")
        .select("amount_ml")
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )
    return res.data[0]["amount_ml"] if res.data else 0


def add_water(user_id: str, amount_ml: int) -> int:
    """Добавляет воду к сегодняшней сумме, возвращает новый итог за день."""
    today = date.today().isoformat()
    new_total = get_water_today(user_id) + amount_ml
    supabase.table("water_logs").upsert(
        {"user_id": user_id, "date": today, "amount_ml": new_total},
        on_conflict="user_id,date",
    ).execute()
    return new_total


# --- Ритуалы ------------------------------------------------------------------

def get_rituals(user_id: str) -> list[dict]:
    """Активные ритуалы пользователя, по порядку создания."""
    return (
        supabase.table("rituals")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("created_at")
        .execute()
        .data
    )


def add_ritual(user_id: str, title: str, icon: str | None = None) -> dict:
    return (
        supabase.table("rituals")
        .insert({"user_id": user_id, "title": title, "icon": icon})
        .execute()
        .data[0]
    )


def is_ritual_done_today(ritual_id: str, user_id: str) -> bool:
    today = date.today().isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("is_done")
        .eq("ritual_id", ritual_id)
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )
    return bool(res.data and res.data[0]["is_done"])


def get_rituals_done_today(user_id: str) -> set:
    """Возвращает множество ritual_id, выполненных сегодня — один запрос вместо N."""
    today = date.today().isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("ritual_id")
        .eq("user_id", user_id)
        .eq("date", today)
        .eq("is_done", True)
        .execute()
    )
    return {r["ritual_id"] for r in res.data}


def get_ritual_streaks(user_id: str) -> dict:
    """Возвращает {ritual_id: count} за последние 7 дней — один запрос вместо N."""
    start = (date.today() - timedelta(days=6)).isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("ritual_id,is_done")
        .eq("user_id", user_id)
        .gte("date", start)
        .execute()
    )
    counts: dict = {}
    for row in res.data:
        if row["is_done"]:
            counts[row["ritual_id"]] = counts.get(row["ritual_id"], 0) + 1
    return counts


def toggle_ritual(ritual_id: str, user_id: str) -> tuple[bool, bool]:
    """Переключает отметку за сегодня.
    Returns (new_done, xp_eligible).
    xp_eligible=True только при первой отметке за день (защита от XP-фарма).
    """
    today = date.today().isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("is_done")
        .eq("ritual_id", ritual_id)
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )
    existing = res.data[0] if res.data else None

    if existing is None:
        # Первый раз сегодня — вставляем и даём XP
        supabase.table("ritual_logs").insert(
            {"ritual_id": ritual_id, "user_id": user_id, "date": today, "is_done": True}
        ).execute()
        return True, True

    if existing["is_done"]:
        # Снимаем отметку — обновляем is_done=False, XP не трогаем
        supabase.table("ritual_logs").update({"is_done": False}).eq(
            "ritual_id", ritual_id
        ).eq("user_id", user_id).eq("date", today).execute()
        return False, False

    # Ставим отметку повторно — XP уже выдан ранее
    supabase.table("ritual_logs").update({"is_done": True}).eq(
        "ritual_id", ritual_id
    ).eq("user_id", user_id).eq("date", today).execute()
    return True, False


# --- Колесо баланса ----------------------------------------------------------

BALANCE_FIELDS = ("health", "work", "relations", "finance", "growth", "leisure", "creativity", "purpose")
BALANCE_LABELS = {
    "health": "Здоров'я",
    "work": "Робота",
    "relations": "Стосунки",
    "finance": "Фінанси",
    "growth": "Розвиток",
    "leisure": "Відпочинок",
    "creativity": "Творчість",
    "purpose": "Сенс",
}


def save_balance(user_id: str, scores: dict) -> dict:
    safe = {k: v for k, v in scores.items() if k in BALANCE_FIELDS}
    res = (
        supabase.table("life_balance")
        .upsert({"user_id": user_id, "date": date.today().isoformat(), **safe}, on_conflict="user_id,date")
        .execute()
    )
    return res.data[0] if res.data else {}


# --- Inbox -------------------------------------------------------------------

def add_inbox(user_id: str, text: str) -> dict:
    return (
        supabase.table("inbox_items")
        .insert({"user_id": user_id, "text": text})
        .execute()
        .data[0]
    )


def get_inbox(user_id: str) -> list[dict]:
    return (
        supabase.table("inbox_items")
        .select("id,text,created_at")
        .eq("user_id", user_id)
        .eq("is_handled", False)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    )


def clear_inbox_item(item_id: str, user_id: str) -> None:
    supabase.table("inbox_items").update({"is_handled": True}).eq("id", item_id).eq("user_id", user_id).execute()


# --- Дайджест ----------------------------------------------------------------

def get_week_digest(user_id: str) -> dict:
    today = date.today()
    week_start = (today - timedelta(days=6)).isoformat()

    water = (
        supabase.table("water_logs").select("amount_ml").eq("user_id", user_id)
        .gte("date", week_start).execute().data
    )
    rituals_done = (
        supabase.table("ritual_logs").select("id").eq("user_id", user_id)
        .eq("is_done", True).gte("date", week_start).execute().data
    )
    tasks_done = (
        supabase.table("tasks").select("id").eq("user_id", user_id)
        .eq("is_completed", True).gte("completed_at", week_start).execute().data
    )
    food = (
        supabase.table("food_logs").select("kcal").eq("user_id", user_id)
        .gte("date", week_start).execute().data
    )
    sleep = (
        supabase.table("sleep_logs").select("duration_min").eq("user_id", user_id)
        .gte("date", week_start).execute().data
    )
    workouts = (
        supabase.table("workouts").select("id").eq("user_id", user_id)
        .gte("date", week_start).execute().data
    )
    spends = (
        supabase.table("transactions").select("amount").eq("user_id", user_id)
        .gte("date", week_start).execute().data
    )
    xp_events = (
        supabase.table("xp_events").select("xp_amount").eq("user_id", user_id)
        .gte("created_at", week_start).execute().data
    )

    avg_sleep = (sum(s["duration_min"] for s in sleep) / len(sleep) / 60) if sleep else 0
    food_kcal = [f["kcal"] for f in food if f.get("kcal") is not None]
    kcal_avg = int(sum(food_kcal) / len(food_kcal)) if food_kcal else 0
    return {
        "water_total": sum(w["amount_ml"] for w in water),
        "water_days": len(water),
        "rituals_done": len(rituals_done),
        "tasks_done": len(tasks_done),
        "kcal_avg": kcal_avg,
        "sleep_avg_h": avg_sleep,
        "workouts": len(workouts),
        "spend_total": int(sum(s["amount"] for s in spends)),
        "xp_earned": sum(e["xp_amount"] for e in xp_events),
    }


# --- Встречи -----------------------------------------------------------------

def add_meeting(user_id: str, title: str, meeting_date: str, meeting_time: str | None = None) -> dict:
    return (
        supabase.table("meetings")
        .insert({"user_id": user_id, "title": title, "date": meeting_date, "time": meeting_time})
        .execute()
        .data[0]
    )


def get_upcoming_meetings(user_id: str) -> list[dict]:
    today = date.today().isoformat()
    return (
        supabase.table("meetings")
        .select("title,date,time")
        .eq("user_id", user_id)
        .gte("date", today)
        .order("date")
        .order("time")
        .limit(10)
        .execute()
        .data
    )


# --- Тренировки --------------------------------------------------------------

CARDIO_KEYWORDS = {
    # українська
    "біг", "кардіо", "велосипед", "плавання", "стрибки", "ходьба", "скакалка", "еліпс",
    # російська (зворотна сумісність)
    "бег", "кардио", "плавание", "прыжки", "эллипс",
}
STRENGTH_KEYWORDS = {
    # українська
    "силове", "жим", "присід", "тяга", "штанга", "гантелі", "турнік", "віджимання", "підтягування",
    # російська
    "силовая", "присед", "гантели", "турник", "отжимания",
}
FLEX_KEYWORDS = {
    "йога", "розтяжка", "стретчинг", "пілатес",
    "растяжка", "пилатес",
}


def detect_workout_type(activity: str) -> str:
    low = activity.lower()
    for kw in CARDIO_KEYWORDS:
        if kw in low:
            return "cardio"
    for kw in STRENGTH_KEYWORDS:
        if kw in low:
            return "strength"
    for kw in FLEX_KEYWORDS:
        if kw in low:
            return "flexibility"
    return "other"


def get_workouts_recent(user_id: str, limit: int = 10) -> list[dict]:
    return (
        supabase.table("workouts")
        .select("date,activity,duration_min,type")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def add_workout(user_id: str, activity: str, duration_min: int | None, workout_type: str) -> dict:
    return (
        supabase.table("workouts")
        .insert({
            "user_id": user_id,
            "date": date.today().isoformat(),
            "activity": activity,
            "duration_min": duration_min,
            "type": workout_type,
        })
        .execute()
        .data[0]
    )


# --- Цели --------------------------------------------------------------------

def add_goal(user_id: str, title: str, deadline: str | None = None) -> dict:
    return (
        supabase.table("goals")
        .insert({"user_id": user_id, "title": title, "deadline": deadline})
        .execute()
        .data[0]
    )


def get_goals(user_id: str) -> list[dict]:
    return (
        supabase.table("goals")
        .select("id,title,deadline,is_done")
        .eq("user_id", user_id)
        .eq("is_done", False)
        .order("created_at")
        .execute()
        .data
    )


def complete_goal(goal_id: str, user_id: str) -> bool:
    res = (
        supabase.table("goals")
        .update({"is_done": True, "done_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .eq("is_done", False)
        .execute()
    )
    return bool(res.data)


# --- Идеи --------------------------------------------------------------------

def add_idea(user_id: str, text: str) -> dict:
    return (
        supabase.table("ideas")
        .insert({"user_id": user_id, "text": text})
        .execute()
        .data[0]
    )


def get_ideas(user_id: str) -> list[dict]:
    return (
        supabase.table("ideas")
        .select("id,text,status,created_at")
        .eq("user_id", user_id)
        .eq("status", "raw")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    )


# --- Замеры тела --------------------------------------------------------------

def log_weight(user_id: str, weight: float) -> dict:
    return (
        supabase.table("body_measurements")
        .upsert(
            {"user_id": user_id, "date": date.today().isoformat(), "weight": weight},
            on_conflict="user_id,date",
        )
        .execute()
        .data[0]
    )


def get_last_weights(user_id: str, limit: int = 5) -> list[dict]:
    return (
        supabase.table("body_measurements")
        .select("date,weight")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(limit)
        .execute()
        .data
    )


# --- Дневник ------------------------------------------------------------------

def delete_ritual(ritual_id: str, user_id: str) -> bool:
    res = (
        supabase.table("rituals")
        .update({"is_active": False})
        .eq("id", ritual_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def get_diary_entries(user_id: str, limit: int = 10) -> list[dict]:
    return (
        supabase.table("diary_entries")
        .select("date,text,mood")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_diary_entries_by_date(user_id: str, entry_date: str) -> list[dict]:
    return (
        supabase.table("diary_entries")
        .select("text,mood,created_at")
        .eq("user_id", user_id)
        .eq("date", entry_date)
        .order("created_at")
        .execute()
        .data
    )


def add_diary_entry(user_id: str, text: str, mood: int | None = None) -> dict:
    return (
        supabase.table("diary_entries")
        .insert({"user_id": user_id, "date": date.today().isoformat(), "text": text, "mood": mood})
        .execute()
        .data[0]
    )


# --- Финансы ------------------------------------------------------------------

def add_transaction(user_id: str, amount: float, category: str, note: str | None = None) -> dict:
    return (
        supabase.table("transactions")
        .insert({"user_id": user_id, "date": date.today().isoformat(), "amount": amount, "category": category, "note": note})
        .execute()
        .data[0]
    )


def get_transactions_week(user_id: str) -> list[dict]:
    week_start = (date.today() - timedelta(days=6)).isoformat()
    return (
        supabase.table("transactions")
        .select("date,amount,category,note")
        .eq("user_id", user_id)
        .gte("date", week_start)
        .order("date", desc=True)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def delete_ritual_by_title(user_id: str, title: str) -> bool:
    res = (
        supabase.table("rituals")
        .update({"is_active": False})
        .eq("user_id", user_id)
        .ilike("title", title)
        .eq("is_active", True)
        .execute()
    )
    return bool(res.data)


def delete_task_by_title(user_id: str, title: str) -> bool:
    res = (
        supabase.table("tasks")
        .delete()
        .eq("user_id", user_id)
        .ilike("title", title)
        .eq("is_completed", False)
        .execute()
    )
    return bool(res.data)


def get_transactions_today(user_id: str) -> list[dict]:
    return (
        supabase.table("transactions")
        .select("amount,category,note")
        .eq("user_id", user_id)
        .eq("date", date.today().isoformat())
        .order("created_at")
        .execute()
        .data
    )


# --- Сон ----------------------------------------------------------------------

def log_sleep(user_id: str, sleep_time: str, wake_time: str, duration_min: int) -> dict:
    today = date.today().isoformat()
    return (
        supabase.table("sleep_logs")
        .upsert(
            {
                "user_id": user_id,
                "date": today,
                "sleep_time": sleep_time,
                "wake_time": wake_time,
                "duration_min": duration_min,
            },
            on_conflict="user_id,date",
        )
        .execute()
        .data[0]
    )


def get_sleep_history(user_id: str, limit: int = 7) -> list[dict]:
    return (
        supabase.table("sleep_logs")
        .select("date,sleep_time,wake_time,duration_min")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_sleep_today(user_id: str) -> dict | None:
    today = date.today().isoformat()
    res = (
        supabase.table("sleep_logs")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )
    return res.data[0] if res.data else None


# --- Дашборд / статы ----------------------------------------------------------

def get_user_stats(user_id: str) -> dict:
    rows = (
        supabase.table("user_stats")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not rows:
        supabase.table("user_stats").insert({"user_id": user_id}).execute()
        rows = supabase.table("user_stats").select("*").eq("user_id", user_id).execute().data
    return rows[0]


def get_tasks_done_today(user_id: str) -> int:
    today = date.today().isoformat()
    res = (
        supabase.table("tasks")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_completed", True)
        .gte("completed_at", today)
        .execute()
    )
    return len(res.data)


# --- Питание ------------------------------------------------------------------

def get_food_today(user_id: str) -> list[dict]:
    today = date.today().isoformat()
    return (
        supabase.table("food_logs")
        .select("id,food_name,grams,kcal,created_at")
        .eq("user_id", user_id)
        .eq("date", today)
        .order("created_at")
        .execute()
        .data
    )


def delete_food(food_id: str, user_id: str) -> bool:
    res = (
        supabase.table("food_logs")
        .delete()
        .eq("id", food_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def add_food(user_id: str, food_name: str, kcal: int, grams: int | None = None) -> dict:
    today = date.today().isoformat()
    return (
        supabase.table("food_logs")
        .insert({"user_id": user_id, "date": today, "food_name": food_name, "kcal": kcal, "grams": grams})
        .execute()
        .data[0]
    )


# --- Задачи -------------------------------------------------------------------

def get_tasks(user_id: str) -> list[dict]:
    """Незавершённые задачи пользователя, по дате создания."""
    return (
        supabase.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_completed", False)
        .order("created_at")
        .execute()
        .data
    )


def add_task(user_id: str, title: str) -> dict:
    return (
        supabase.table("tasks")
        .insert({"user_id": user_id, "title": title})
        .execute()
        .data[0]
    )


def delete_task(task_id: str, user_id: str) -> bool:
    res = (
        supabase.table("tasks")
        .delete()
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(res.data)


def complete_task(task_id: str, user_id: str) -> bool:
    """Помечает задачу выполненной. Возвращает True если задача найдена и обновлена."""
    res = (
        supabase.table("tasks")
        .update({"is_completed": True, "completed_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .eq("is_completed", False)
        .execute()
    )
    return bool(res.data)