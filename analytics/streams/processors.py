"""
Faust Stream Processors — NexusFlow real-time enrichment worker.

⚠️  THIS FILE IS NEVER IMPORTED BY THE FASTAPI APP (main.py).
    It is a standalone Faust worker process.

How to run (inside the backend container or locally):
    faust -A app.streams.processors worker --loglevel=info

Topics consumed:
  weather-events   → { "port_id": str, "severity": float, "weather_type": str, "timestamp": str }
  port-congestion  → { "port_id": str, "congestion_score": float, "timestamp": str }
  carrier-events   → { "carrier": str, "ontime_rate": float, "timestamp": str }

Redis keys written:
  weather:{port_id}              → severity (float 0-1)
  congestion:{port_id}           → congestion_score (float 0-1)
  carrier:{carrier}:ontime_rate  → ontime_rate (float 0-1)

Why isolated from FastAPI:
  Faust is a long-running asyncio process that owns its own event loop and
  Kafka consumer group. Mixing it into a FastAPI/uvicorn process causes
  event loop conflicts and makes both services fragile. Keeping them separate
  is the correct production pattern.
"""

from __future__ import annotations

import logging
import os

import faust
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# ─── Configuration ─────────────────────────────────────────────────────────────
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka://kafka:29092")
REDIS_URL    = os.getenv("REDIS_URL",    "redis://redis:6379/0")

# ─── Faust app ────────────────────────────────────────────────────────────────
app = faust.App(
    "nexusflow-processors",
    broker=KAFKA_BROKER,
    value_serializer="json",
    consumer_auto_offset_reset="earliest",
    topic_allow_declare=True,
    topic_disable_leader=True,
)

# ─── Redis client (lazily initialised on worker start) ────────────────────────
_redis: aioredis.Redis | None = None


@app.on_start.connect
async def on_worker_start(**kwargs) -> None:  # type: ignore[no-untyped-def]
    global _redis
    _redis = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    logger.info("Faust worker connected to Redis: %s", REDIS_URL)


@app.on_stop.connect
async def on_worker_stop(**kwargs) -> None:  # type: ignore[no-untyped-def]
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
    logger.info("Faust worker shut down cleanly.")


# ─── Topic definitions ────────────────────────────────────────────────────────

weather_topic = app.topic(
    "weather-events",
    value_type=bytes,
)

congestion_topic = app.topic(
    "port-congestion",
    value_type=bytes,
)

carrier_topic = app.topic(
    "carrier-events",
    value_type=bytes,
)


# ─── Stream agents ────────────────────────────────────────────────────────────

@app.agent(weather_topic)
async def process_weather_events(stream) -> None:  # type: ignore[no-untyped-def]
    """
    Consume weather-events and update Redis.
    Expected payload: { "port_id": "Singapore", "severity": 0.65, ... }
    """
    async for event in stream:
        try:
            port_id  = str(event.get("port_id") or event.get("route_segment_id") or "")
            severity = float(event.get("severity", 0.3))
            severity = max(0.0, min(1.0, severity))  # clamp to [0,1]

            if port_id and _redis:
                await _redis.set(f"weather:{port_id}", severity)
                logger.debug("Weather updated — %s: %.3f", port_id, severity)
        except Exception as exc:
            logger.error("process_weather_events error: %s | event: %s", exc, event)


@app.agent(congestion_topic)
async def process_congestion_events(stream) -> None:  # type: ignore[no-untyped-def]
    """
    Consume port-congestion events and update Redis.
    Expected payload: { "port_id": "Rotterdam", "congestion_score": 0.72, ... }
    """
    async for event in stream:
        try:
            port_id = str(event.get("port_id") or "")
            score   = float(event.get("congestion_score", 0.5))
            score   = max(0.0, min(1.0, score))

            if port_id and _redis:
                await _redis.set(f"congestion:{port_id}", score)
                logger.debug("Congestion updated — %s: %.3f", port_id, score)
        except Exception as exc:
            logger.error("process_congestion_events error: %s | event: %s", exc, event)


@app.agent(carrier_topic)
async def process_carrier_events(stream) -> None:  # type: ignore[no-untyped-def]
    """
    Consume carrier performance events and update Redis.
    Expected payload: { "carrier": "Maersk", "ontime_rate": 0.88, ... }
    """
    async for event in stream:
        try:
            carrier = str(event.get("carrier") or event.get("carrier_id") or "")
            rate    = float(event.get("ontime_rate", 0.85))
            rate    = max(0.0, min(1.0, rate))

            if carrier and _redis:
                await _redis.set(f"carrier:{carrier}:ontime_rate", rate)
                logger.debug("Carrier rate updated — %s: %.3f", carrier, rate)
        except Exception as exc:
            logger.error("process_carrier_events error: %s | event: %s", exc, event)