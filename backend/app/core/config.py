from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    VERSION: str = "1.0.0"

    # Redis — accepts a full URL (docker-compose style) or falls back to host/port
    # ALLOWED_ORIGINS is intentionally NOT here — pydantic-settings v2 cannot
    # parse comma-separated env strings as list[str] without env_list_delimiter.
    # The CORS origin list is hardcoded in main.py where it belongs.
    REDIS_URL: str = "redis://redis:6379/0"


settings = Settings()
