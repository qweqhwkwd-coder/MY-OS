"""Подключение к базе Supabase и помощники для работы с данными.

На MVP пользователь один, поэтому бэкенд ходит в базу под service_role
(полный доступ) — сложная авторизация не нужна.
"""

from datetime import date

from supabase import Client, create_client

from config import settings

supabase: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)

# Пять RPG-характеристик
STATS = ("strength", "endurance", "nutrition", "discipline", "reflection")


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


# --- RPG ----------------------------------------------------------------------

def add_xp(user_id: str, stat: str, amount: int, source: str) -> None:
    """Начисляет XP в характеристику, логирует событие и пересчитывает уровень."""
    # лог события (откуда пришёл XP)
    supabase.table("xp_events").insert(
        {
            "user_id": user_id,
            "source_module": source,
            "stat_affected": stat,
            "xp_amount": amount,
        }
    ).execute()

    # увеличиваем нужный стат
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
