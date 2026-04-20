from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


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
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"]
    )

    # Redis — accepts a full URL (docker-compose style) or falls back to host/port
    REDIS_URL: str = "redis://localhost:6379/0"

    from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


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
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"]
    )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── ADD THESE LINES ──────────────────────────────────
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"
    KAFKA_CONSUMER_GROUP: str = "nexusflow-backend"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    API_KEY: str = "nexusflow-dev-key"

    # Debug
    DEBUG: bool = True
    # ─────────────────────────────────────────────────────


settings = Settings()
