from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # silently skip any .env keys not listed here
    )

    # App
    APP_ENV: str = "development"
    VERSION: str = "1.0.0"

    # Redis — full URL injected by docker-compose env_file
    REDIS_URL: str = "redis://localhost:6379/0"

    # NOTE: ALLOWED_ORIGINS is intentionally NOT defined here.
    # CORS origins are hardcoded in app/main.py.
    # Defining it here caused pydantic-settings v2 to fail parsing the
    # comma-separated / JSON-array string from the env source before
    # any field_validator could intercept it.


settings = Settings()
