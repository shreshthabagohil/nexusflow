"""
Async Redis connection singleton.

Uses redis.asyncio (built into the `redis` package v4+).
A single connection pool is shared across all FastAPI requests.
Connection is lazy — first actual Redis call triggers the handshake.
"""

from __future__ import annotations

import logging

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return (or lazily create) the shared Redis client."""
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        logger.info("Redis client initialised — URL: %s", settings.REDIS_URL)
    return _pool


async def close_redis() -> None:
    """Gracefully close the pool on application shutdown."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        logger.info("Redis connection closed.")
