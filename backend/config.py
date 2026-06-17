"""Конфиг: читает значения из файла .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    bot_token: str                     # токен от @BotFather
    supabase_url: str                  # https://...supabase.co
    supabase_service_role_key: str     # секретный ключ sb_secret_...
    supabase_anon_key: str = ""        # публичный, пока не используется
    webhook_base_url: str = ""         # публичный адрес сервиса на Render
    webhook_secret: str = ""           # окремий секрет вебхука (не токен!)
    port: int = 8000


settings = Settings()
