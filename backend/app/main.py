"""
NexusFlow FastAPI application entry point.

Startup sequence (lifespan):
  1. Connect to Redis
  2. Seed Redis with 53 shipments + port/carrier/weather baselines (idempotent)
  3. Load XGBoost risk model (if trained — graceful skip if not)
  4. ML-score all shipments and write live risk_score + top_risk_factors to Redis
  5. Serve requests

Shutdown:
  6. Close Redis connection pool

IMPORTANT: Faust stream processors (services/faust_app.py) run as a SEPARATE
           worker process and are NEVER imported here.
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.shipments import router as shipments_router
from app.data.seed_data import seed_redis
from app.services.redis_client import close_redis, get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ─── ML scoring helper ────────────────────────────────────────────────────────

async def _ml_score_all_shipments(redis) -> None:
    """
    For every shipment in Redis:
      1. Build its feature vector (FeatureEngineer)
      2. Predict risk score via XGBoost
      3. Get top-3 SHAP risk factors
      4. Write updated risk_score + top_risk_factors back to Redis

    Graceful: if the model isn't trained yet, logs a warning and returns.
    """
    # Lazy import keeps startup fast if the model doesn't exist yet
    try:
        from ml.risk_scorer import get_scorer
        from app.services.feature_engineer import FeatureEngineer
    except ImportError as exc:
        logger.warning("ML import failed (%s) — skipping ML scoring.", exc)
        return

    scorer = get_scorer()
    if scorer is None:
        logger.warning(
            "ML model not trained yet. Shipments will use seed risk_scores. "
            "Run: docker compose exec backend python ml/train_model.py"
        )
        return

    fe   = FeatureEngineer(redis)
    keys = await redis.keys("shipment:*")
    if not keys:
        logger.warning("No shipment keys in Redis — skipping ML scoring.")
        return

    scored = 0
    errors = 0
    for key in keys:
        try:
            raw = await redis.get(key)
            if not raw:
                continue
            shipment   = json.loads(raw)
            shipment_id = shipment.get("id", key.split(":")[-1])

            fv = await fe.build(shipment_id)
            if fv is None:
                continue

            risk_score       = scorer.score(fv)
            top_risk_factors = scorer.explain(fv, top_n=3)

            shipment["risk_score"]       = risk_score
            shipment["top_risk_factors"] = top_risk_factors
            await redis.set(key, json.dumps(shipment))
            scored += 1
        except Exception as exc:
            logger.error("ML scoring failed for key '%s': %s", key, exc)
            errors += 1

    logger.info(
        "ML scoring complete — %d shipments scored, %d errors.", scored, errors
    )


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup → yield → shutdown."""
    logger.info("NexusFlow Backend starting…")

    redis = None
    try:
        redis = await get_redis()
        await seed_redis(redis)
        logger.info("Redis seed complete.")
    except Exception as exc:
        logger.warning(
            "Redis seed failed (%s). Endpoints will use in-memory fallbacks.", exc
        )

    # ML scoring — only runs if Redis connected successfully
    if redis is not None:
        try:
            await _ml_score_all_shipments(redis)
        except Exception as exc:
            logger.warning("ML scoring step failed (%s). Continuing with seed scores.", exc)

    yield  # ← application is live

    logger.info("NexusFlow Backend shutting down…")
    await close_redis()
    logger.info("Shutdown complete.")


# ─── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="NexusFlow API",
    version="1.0.0",
    description="Predictive Supply Chain Intelligence Platform — backend API",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://frontend:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(shipments_router)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> dict:
    """Liveness probe used by Docker healthcheck."""
    return {"status": "ok", "version": "1.0.0", "service": "nexusflow-backend"}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Real-time push channel.

    Subscribes to the Redis "score_updates" pub/sub channel.
    Every time the Faust worker re-scores a shipment it publishes there;
    we immediately forward that JSON payload to all connected WebSocket clients.

    Also sends a heartbeat every 5 s so the client knows the connection is alive.
    """
    await websocket.accept()
    logger.info("WebSocket client connected: %s", websocket.client)

    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe("score_updates")

    try:
        while True:
            # Non-blocking poll — check for a pub/sub message
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.05)

            if message and message.get("type") == "message":
                try:
                    payload = json.loads(message["data"])
                    await websocket.send_json(payload)
                except Exception as exc:
                    logger.warning("WS send error: %s", exc)
            else:
                # No message in this poll cycle — send a heartbeat every 5 s
                await asyncio.sleep(5)
                await websocket.send_json({
                    "type":    "heartbeat",
                    "status":  "ok",
                    "message": "ML risk scores are live.",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", websocket.client)
    except Exception as exc:
        logger.warning("WebSocket error for %s: %s", websocket.client, exc)
    finally:
        try:
            await pubsub.unsubscribe("score_updates")
            await pubsub.aclose()
        except Exception:
            pass
