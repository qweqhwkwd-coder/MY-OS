"""Подключение к базе Supabase и пара простых помощников.

На MVP пользователь один, поэтому бэкенд ходит в базу под service_role
(полный доступ) — никакой сложной авторизации не нужно.
"""

from supabase import create_client, Client

from config import settings

supabase: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)


def ensure_user(telegram_id: int, name: str) -> dict:
    """Находит пользователя по telegram_id, а если его нет — создаёт.

    При создании сразу заводит строку со стартовыми RPG-статами (все 0).
    """
    found = supabase.table("users").select("*").eq("telegram_id", telegram_id).execute()
    if found.data:
        return found.data[0]

    created = (
        supabase.table("users")
        .insert({"telegram_id": telegram_id, "name": name})
        .execute()
    )
    user = created.data[0]
    supabase.table("user_stats").insert({"user_id": user["id"]}).execute()
    return user
