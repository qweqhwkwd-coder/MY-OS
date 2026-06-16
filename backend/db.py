"""Подключение к базе Supabase и помощники для работы с данными.

На MVP пользователь один, поэтому бэкенд ходит в базу под service_role
(полный доступ) — сложная авторизация не нужна.
"""

from datetime import date, timedelta

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

    stats = (
        supabase.table("user_stats").select("*").eq("user_id", user_id).execute().data[0]
    )
    new_val = stats[stat] + amount

    # уровень = среднее XP по 5 статам / 100 (как в правилах RPG)
    total = sum(stats[s] for s in STATS) - stats[stat] + new_val
    level = int((total / len(STATS)) // 100)

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


def is_ritual_done_today(ritual_id: str) -> bool:
    today = date.today().isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("is_done")
        .eq("ritual_id", ritual_id)
        .eq("date", today)
        .execute()
    )
    return bool(res.data and res.data[0]["is_done"])


def toggle_ritual(ritual_id: str, user_id: str) -> bool:
    """Переключает отметку за сегодня. Возвращает новое состояние (True = выполнен)."""
    today = date.today().isoformat()
    if is_ritual_done_today(ritual_id):
        supabase.table("ritual_logs").delete().eq("ritual_id", ritual_id).eq(
            "date", today
        ).execute()
        return False
    supabase.table("ritual_logs").upsert(
        {"ritual_id": ritual_id, "user_id": user_id, "date": today, "is_done": True},
        on_conflict="ritual_id,date",
    ).execute()
    return True


def ritual_streak_7(ritual_id: str) -> int:
    """Сколько из последних 7 дней ритуал был выполнен."""
    start = (date.today() - timedelta(days=6)).isoformat()
    res = (
        supabase.table("ritual_logs")
        .select("is_done")
        .eq("ritual_id", ritual_id)
        .gte("date", start)
        .execute()
    )
    return sum(1 for r in res.data if r["is_done"])


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
    from datetime import datetime
    res = (
        supabase.table("goals")
        .update({"is_done": True, "done_at": datetime.utcnow().isoformat()})
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
    return (
        supabase.table("user_stats")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data[0]
    )


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
        .select("food_name,kcal,created_at")
        .eq("user_id", user_id)
        .eq("date", today)
        .order("created_at")
        .execute()
        .data
    )


def add_food(user_id: str, food_name: str, kcal: int) -> dict:
    today = date.today().isoformat()
    return (
        supabase.table("food_logs")
        .insert({"user_id": user_id, "date": today, "food_name": food_name, "kcal": kcal})
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


def complete_task(task_id: str, user_id: str) -> bool:
    """Помечает задачу выполненной. Возвращает True если задача найдена и обновлена."""
    from datetime import datetime
    res = (
        supabase.table("tasks")
        .update({"is_completed": True, "completed_at": datetime.utcnow().isoformat()})
        .eq("id", task_id)
        .eq("user_id", user_id)
        .eq("is_completed", False)
        .execute()
    )
    return bool(res.data)