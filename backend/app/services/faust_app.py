"""
NexusFlow — Faust Stream Processor
====================================
Runs as a SEPARATE worker process (never imported by FastAPI):

    docker compose exec faust-worker python -m app.services.faust_app worker -l info

Consumes 4 Kafka topics:
  - weather-events    → update weather severity for ports/routes → re-score shipments
  - port-status       → update port congestion score → re-score affected shipments
  - carrier-delays    → update carrier on-time rate → re-score affected shipments
  - shipment-updates  → update shipment position + status in Redis

After every cache update the scoring loop:
  1. Finds all shipments affected by the change
  2. Re-computes their feature vector (FeatureEngineer)
  3. Scores with XGBoost (RiskScorer)
  4. Writes updated risk_score + top_risk_factors back to Redis
  5. Publishes a score_update event to Redis channel "score_updates" (WebSocket picks this up)
  6. If score > 70, also produces a message to Kafka topic "risk-scores"
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import faust
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# ─── Faust app ────────────────────────────────────────────────────────────────

app = faust.App(
    "nexusflow",
    broker=f"kafka://{os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')}",
    value_serializer="json",
)

# ─── Redis connection (separate from FastAPI's pool) ─────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return _redis


# ─── Faust Record types ───────────────────────────────────────────────────────

class WeatherEvent(faust.Record, serializer="json"):
    route_segment_id: str
    severity: float
    weather_type: str
    timestamp: str


class PortStatus(faust.Record, serializer="json"):
    port_id: str
    name: str
    congestion_score: float
    timestamp: str


class CarrierDelay(faust.Record, serializer="json"):
    carrier_id: str
    ontime_rate: float
    timestamp: str


class ShipmentUpdate(faust.Record, serializer="json"):
    shipment_id: str
    lat: float
    lng: float
    status: str
    timestamp: str


# ─── Kafka topics ─────────────────────────────────────────────────────────────

weather_topic    = app.topic("weather-events",  value_type=WeatherEvent)
port_topic       = app.topic("port-status",      value_type=PortStatus)
carrier_topic    = app.topic("carrier-delays",   value_type=CarrierDelay)
shipment_topic   = app.topic("shipment-updates", value_type=ShipmentUpdate)
risk_score_topic = app.topic("risk-scores",      value_type=None)   # output topic


# ─── ML scorer (lazy singleton) ───────────────────────────────────────────────

_scorer = None


def _get_scorer():
    global _scorer
    if _scorer is not None:
        return _scorer
    try:
        from ml.risk_scorer import get_scorer
        _scorer = get_scorer()
    except Exception as exc:
        logger.warning("Could not load ML scorer in Faust worker: %s", exc)
    return _scorer


# ─── Core: rescore a single shipment ─────────────────────────────────────────

async def _rescore_shipment(redis: aioredis.Redis, shipment_id: str) -> int | None:
    """
    Re-build feature vector and re-score one shipment.
    Writes updated risk_score + top_risk_factors to Redis.
    Publishes to Redis channel "score_updates" (consumed by WebSocket).
    Produces to Kafka "risk-scores" topic if score > 70.
    Returns the new risk score, or None on failure.
    """
    from app.services.feature_engineer import FeatureEngineer

    scorer = _get_scorer()
    if scorer is None:
        return None  # model not trained yet — skip silently

    try:
        fe = FeatureEngineer(redis)
        fv = await fe.build(shipment_id)
        if fv is None:
            return None

        risk_score       = scorer.score(fv)
        top_risk_factors = scorer.explain(fv, top_n=3)

        # Update shipment in Redis
        raw = await redis.get(f"shipment:{shipment_id}")
        if raw:
            shipment = json.loads(raw)
            shipment["risk_score"]       = risk_score
            shipment["top_risk_factors"] = top_risk_factors
            await redis.set(f"shipment:{shipment_id}", json.dumps(shipment))

        # Broadcast score update to WebSocket clients via Redis pub/sub
        update_payload = json.dumps({
            "type":             "score_update",
            "shipment_id":      shipment_id,
            "risk_score":       risk_score,
            "top_risk_factors": top_risk_factors,
        })
        await redis.publish("score_updates", update_payload)

        # Publish high-risk alert to Kafka risk-scores topic
        if risk_score > 70:
            await risk_score_topic.send(value={
                "shipment_id": shipment_id,
                "risk_score":  risk_score,
                "alert":       "HIGH_RISK",
                "top_factors": top_risk_factors,
            })
            logger.info("HIGH RISK alert published: %s → score=%d", shipment_id, risk_score)

        return risk_score

    except Exception as exc:
        logger.error("_rescore_shipment failed for '%s': %s", shipment_id, exc)
        return None


async def _rescore_by_port(redis: aioredis.Redis, port_name: str) -> None:
    """Re-score all shipments whose origin or destination matches *port_name*."""
    try:
        keys = await redis.keys("shipment:*")
        if not keys:
            return
        values = await redis.mget(*keys)
        affected = []
        for v in values:
            if v:
                try:
                    s = json.loads(v)
                    if s.get("origin_port") == port_name or s.get("destination_port") == port_name:
                        affected.append(s["id"])
                except (json.JSONDecodeError, KeyError):
                    pass
        logger.info("Re-scoring %d shipments affected by port '%s'", len(affected), port_name)
        for sid in affected:
            await _rescore_shipment(redis, sid)
    except Exception as exc:
        logger.error("_rescore_by_port error for '%s': %s", port_name, exc)


async def _rescore_by_carrier(redis: aioredis.Redis, carrier_name: str) -> None:
    """Re-score all shipments operated by *carrier_name*."""
    try:
        keys = await redis.keys("shipment:*")
        if not keys:
            return
        values = await redis.mget(*keys)
        affected = []
        for v in values:
            if v:
                try:
                    s = json.loads(v)
                    if s.get("carrier") == carrier_name:
                        affected.append(s["id"])
                except (json.JSONDecodeError, KeyError):
                    pass
        logger.info("Re-scoring %d shipments for carrier '%s'", len(affected), carrier_name)
        for sid in affected:
            await _rescore_shipment(redis, sid)
    except Exception as exc:
        logger.error("_rescore_by_carrier error for '%s': %s", carrier_name, exc)


async def _rescore_all(redis: aioredis.Redis) -> None:
    """Re-score ALL shipments (used after weather updates that affect every route)."""
    try:
        keys = await redis.keys("shipment:*")
        if not keys:
            return
        values = await redis.mget(*keys)
        ids = []
        for v in values:
            if v:
                try:
                    ids.append(json.loads(v)["id"])
                except (json.JSONDecodeError, KeyError):
                    pass
        logger.info("Re-scoring all %d shipments after weather update", len(ids))
        for i, sid in enumerate(ids):
            await _rescore_shipment(redis, sid)
            if i % 50 == 49:
                await asyncio.sleep(0.05)  # brief yield to avoid saturating Redis
    except Exception as exc:
        logger.error("_rescore_all error: %s", exc)


# ─── Consumer agents ──────────────────────────────────────────────────────────

@app.agent(weather_topic)
async def process_weather(events):
    async for event in events:
        try:
            redis = await get_redis()

            # Store weather severity keyed by route segment
            await redis.set(f"weather:route:{event.route_segment_id}", event.severity)
            logger.info(
                "Weather updated: route=%s severity=%.3f type=%s",
                event.route_segment_id, event.severity, event.weather_type,
            )

            # Weather can affect any route — re-score all shipments
            await _rescore_all(redis)

        except Exception as exc:
            logger.error("process_weather error: %s", exc)


@app.agent(port_topic)
async def process_port(events):
    async for event in events:
        try:
            redis = await get_redis()

            # Normalise congestion_score: accept 0-10 (legacy) or 0-1
            score = event.congestion_score
            if score > 1.0:
                score = score / 10.0
            score = max(0.0, min(1.0, round(score, 4)))

            await redis.set(f"congestion:{event.name}", score)
            logger.info("Port updated: %s congestion=%.4f", event.name, score)

            # ── Isolation Forest anomaly detection ───────────────────────────
            # Detect whether this congestion reading is statistically anomalous
            # relative to the port's historical baseline.
            try:
                from app.services.anomaly_detector import AnomalyDetector
                detector = AnomalyDetector()
                anomaly_result = detector.detect(congestion=score)
                is_anomaly = anomaly_result.get("is_anomaly", False)
                if is_anomaly:
                    # Anomalous congestion spike — publish alert to WebSocket clients
                    import json as _json
                    alert = _json.dumps({
                        "type":    "anomaly_alert",
                        "port":    event.name,
                        "score":   score,
                        "message": f"Anomalous congestion spike at {event.name}: {score:.2f}",
                    })
                    await redis.publish("score_updates", alert)
            except Exception as exc:
                logger.warning("Anomaly detection failed for '%s': %s", event.name, exc)

            # Re-score only shipments touching this port
            await _rescore_by_port(redis, event.name)

        except Exception as exc:
            logger.error("process_port error: %s", exc)


@app.agent(carrier_topic)
async def process_carrier(events):
    async for event in events:
        try:
            redis = await get_redis()
            rate = max(0.0, min(1.0, round(event.ontime_rate, 4)))
            await redis.set(f"carrier:{event.carrier_id}:ontime_rate", rate)
            logger.info("Carrier updated: %s ontime_rate=%.4f", event.carrier_id, rate)

            # Re-score only shipments with this carrier
            await _rescore_by_carrier(redis, event.carrier_id)

        except Exception as exc:
            logger.error("process_carrier error: %s", exc)


@app.agent(shipment_topic)
async def process_shipment(events):
    async for event in events:
        try:
            redis = await get_redis()
            raw = await redis.get(f"shipment:{event.shipment_id}")
            if raw:
                shipment = json.loads(raw)
                shipment["current_lat"] = event.lat
                shipment["current_lng"] = event.lng
                shipment["status"]      = event.status
                await redis.set(f"shipment:{event.shipment_id}", json.dumps(shipment))
                logger.info(
                    "Shipment updated: %s status=%s lat=%.4f lng=%.4f",
                    event.shipment_id, event.status, event.lat, event.lng,
                )
                # Re-score after position/status change
                await _rescore_shipment(redis, event.shipment_id)
            else:
                logger.warning("Shipment not found in Redis: %s", event.shipment_id)
        except Exception as exc:
            logger.error("process_shipment error for %s: %s", event.shipment_id, exc)


if __name__ == "__main__":
    app.main()
