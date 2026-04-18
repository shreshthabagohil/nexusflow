import logging
import logging.config
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

# ── Structured logging ────────────────────────────────────────────────────────
LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(asctime)s [%(name)s] %(message)s",
            "use_colors": None,
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "structured",
        },
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "uvicorn.error": {"level": "INFO", "propagate": False, "handlers": ["console"]},
        "uvicorn.access": {"level": "INFO", "propagate": False, "handlers": ["console"]},
        "nexusflow": {"level": "INFO", "propagate": False, "handlers": ["console"]},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("nexusflow")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NexusFlow backend (env=%s)", settings.APP_ENV)
    client: aioredis.Redis = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
    )
    try:
        await client.ping()
        app.state.redis = client
        logger.info("Redis connected — %s", settings.REDIS_URL)
    except Exception as exc:
        app.state.redis = None
        logger.warning("Redis unavailable at startup: %s", exc)

    yield

    if app.state.redis is not None:
        await app.state.redis.aclose()
        logger.info("Redis connection closed")


# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="NexusFlow Supply Chain Platform",
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["ops"])
async def health() -> dict:
    redis_status = "disconnected"
    redis_client: aioredis.Redis | None = getattr(app.state, "redis", None)
    if redis_client is not None:
        try:
            if await redis_client.ping():
                redis_status = "connected"
        except Exception as exc:
            logger.error("Redis health-check failed: %s", exc)

    return {
        "status": "ok",
        "version": settings.VERSION,
        "redis": redis_status,
    }


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.APP_ENV == "development",
        log_config=LOGGING_CONFIG,
    )
