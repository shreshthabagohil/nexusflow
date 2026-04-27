"""
NexusFlow FastAPI application entry point.

Startup sequence (lifespan):
  1. Connect to Redis (lazy — first real call triggers handshake)
  2. Seed Redis with 53 shipments + port/carrier baseline data  (idempotent)
  3. Serve requests

Shutdown sequence:
  4. Close Redis connection pool gracefully

IMPORTANT: Faust stream processors (app/streams/processors.py) are a
           SEPARATE worker process — never imported here.
"""

from __future__ import annotations

import asyncio
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


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan — startup → yield → shutdown."""
    logger.info("NexusFlow Backend starting…")

    redis = None
    try:
        redis = await get_redis()
        await seed_redis(redis)
        logger.info("Redis seed complete.")
    except Exception as exc:
        # Graceful degradation: backend is still usable even if Redis isn't ready
        # yet; Docker healthcheck will retry until /health returns 200.
        logger.warning(
            "Redis seed failed (%s). This is normal on first boot if Redis "
            "is still initialising. Will retry on next reload.",
            exc,
        )

    # ML scoring — only runs if Redis connected successfully
    if redis is not None:
        try:
            await _ml_score_all_shipments(redis)
        except Exception as exc:
            logger.warning("ML scoring step failed (%s). Continuing with seed scores.", exc)


async def _ml_score_all_shipments(redis) -> None:  # type: ignore[type-arg]
    """
    Run XGBoost scoring on every shipment in Redis at startup.

    Best-effort — any failure is caught by the caller and logged as a warning
    so the backend starts cleanly even when the ML model isn't loaded yet.
    """
    import json as _json

    from ml.risk_scorer import get_scorer

    scorer = get_scorer()
    if scorer is None:
        logger.info("_ml_score_all_shipments: model not loaded, skipping initial scoring.")
        return

    from app.services.feature_engineer import FeatureEngineer

    engineer = FeatureEngineer(redis)
    keys = await redis.keys("shipment:*")
    if not keys:
        return

    scored = 0
    for key in keys:
        raw = await redis.get(key)
        if not raw:
            continue
        try:
            shipment = _json.loads(raw)
            sid = shipment.get("id", "")
            vector = await engineer.build(sid)
            if vector is None:
                continue
            import asyncio as _asyncio
            loop = _asyncio.get_event_loop()
            risk_score  = await loop.run_in_executor(None, scorer.score,   vector)
            top_factors = await loop.run_in_executor(None, scorer.explain, vector)
            shipment["risk_score"]       = risk_score
            shipment["top_risk_factors"] = top_factors
            await redis.set(key, _json.dumps(shipment))
            scored += 1
        except Exception as exc:
            logger.debug("_ml_score_all_shipments: skipped %s: %s", key, exc)

    logger.info("_ml_score_all_shipments: scored %d shipments.", scored)

    yield  # ← application is live

    logger.info("NexusFlow Backend shutting down…")
    await close_redis()
    logger.info("Shutdown complete.")


# ─── App ──────────────────────────────────────────────────────────────────────

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
        "http://localhost:3000",   # CRA / legacy & docker-compose frontend
        "http://localhost:5173",   # Vite dev server
        "http://localhost:4173",   # Vite preview
        "http://frontend:3000",    # Docker internal hostname
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ─── Routers ──────────────────────────────────────────────────────────────────

# Handles: /api/shipments, /api/shipments/{id}, /api/shipments/{id}/features,
#          /api/shipments/{id}/reroute, /api/analytics,
#          /api/simulate/disruption, /api/simulation/disrupt
app.include_router(shipments_router)


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> dict:
    """
    Liveness probe used by Docker healthcheck.
    Returns 200 as long as uvicorn is accepting connections.
    Redis connectivity is NOT checked here — that would make the probe
    dependent on an external service, causing false negatives.
    """
    return {"status": "ok", "version": "1.0.0", "service": "nexusflow-backend"}


# ─── WebSocket — real-time updates ────────────────────────────────────────────


class ConnectionManager:
    """Manages active WebSocket connections for broadcasting score updates."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)
        logger.info("WebSocket client connected (%d active)", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        self.active = [w for w in self.active if w != ws]
        logger.info("WebSocket client disconnected (%d active)", len(self.active))

    async def broadcast(self, data: dict) -> None:
        """Send data to all connected clients. Remove dead connections."""
        import json as _json

        msg = _json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Real-time state push channel.

    Pushes live risk-score updates to connected frontends every 3 seconds.
    After a disruption simulation, the frontend sees scores change in near
    real-time as this loop reads fresh values from Redis.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Broadcast current shipment scores from Redis
            try:
                redis = await get_redis()
                keys = await redis.keys("shipment:*")
                if keys:
                    import json as _json

                    values = await redis.mget(*keys)
                    for v in values:
                        if not v:
                            continue
                        try:
                            s = _json.loads(v)
                            await websocket.send_json({
                                "type": "score_update",
                                "shipment_id": s.get("id"),
                                "score": float(s.get("risk_score", 0)),
                                "status": s.get("status", "unknown"),
                            })
                        except (ValueError, TypeError):
                            pass
            except Exception as exc:
                logger.warning("WebSocket Redis read error: %s", exc)
                # Fall back to heartbeat if Redis is unavailable
                await websocket.send_json({
                    "type": "heartbeat",
                    "status": "ok",
                })

            await asyncio.sleep(3)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
        manager.disconnect(websocket)
