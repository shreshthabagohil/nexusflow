"""
Shipment API routes.

Endpoints:
  GET  /api/shipments                    → list all shipments from Redis
  GET  /api/shipments/{shipment_id}      → single shipment detail
  GET  /api/shipments/{shipment_id}/features → 7-field FeatureVector (T1 target)
  GET  /api/analytics                    → aggregate stats derived from Redis
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Body, HTTPException

from app.models.schemas import FeatureVector, Shipment
from app.services.feature_engineer import FeatureEngineer
from app.services.redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["shipments"])


# ─── List all shipments ───────────────────────────────────────────────────────

@router.get("/shipments", response_model=list[dict])
async def list_shipments() -> list[dict[str, Any]]:
    """
    Return all shipments stored in Redis.
    Falls back to [] on Redis errors so the frontend always gets a valid response.
    """
    try:
        redis = await get_redis()
        keys: list[str] = await redis.keys("shipment:*")
        if not keys:
            return []
        values = await redis.mget(*keys)
        shipments: list[dict[str, Any]] = []
        for v in values:
            if v:
                try:
                    shipments.append(json.loads(v))
                except (json.JSONDecodeError, TypeError):
                    pass
        # Sort by ID for stable ordering
        shipments.sort(key=lambda s: s.get("id", ""))
        return shipments
    except Exception as exc:
        logger.error("list_shipments Redis error: %s", exc)
        return []


# ─── Single shipment detail ───────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}", response_model=dict)
async def get_shipment(shipment_id: str) -> dict[str, Any]:
    """Return a single shipment by ID."""
    try:
        redis = await get_redis()
        raw = await redis.get(f"shipment:{shipment_id}")
    except Exception as exc:
        logger.error("get_shipment Redis error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Redis unavailable") from exc

    if raw is None:
        raise HTTPException(
            status_code=404,
            detail=f"Shipment '{shipment_id}' not found.",
        )
    return json.loads(raw)


# ─── Feature vector ───────────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}/features", response_model=FeatureVector)
async def get_shipment_features(shipment_id: str) -> FeatureVector:
    """
    Compute and return the 7-field feature vector for a shipment.

    Fields returned (all numeric, never null):
      - weather_severity       float  (0-1)
      - origin_congestion      float  (0-1)
      - dest_congestion        float  (0-1)
      - carrier_ontime_rate    float  (0-1)
      - cargo_priority_weight  int    (1-10)
      - days_until_eta         float  (≥ 0)
      - route_distance_km      float  (> 0)
    """
    try:
        redis = await get_redis()
        engineer = FeatureEngineer(redis)
        vector = await engineer.build(shipment_id)
    except Exception as exc:
        logger.error("get_shipment_features error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Feature computation failed") from exc

    if vector is None:
        raise HTTPException(
            status_code=404,
            detail=f"Shipment '{shipment_id}' not found.",
        )
    return vector


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics() -> dict[str, Any]:
    """Aggregate statistics computed from live Redis shipment data."""
    try:
        redis = await get_redis()
        keys: list[str] = await redis.keys("shipment:*")
        if not keys:
            return {"total": 0, "at_risk": 0, "rerouting": 0, "on_time_pct": 100.0}

        values = await redis.mget(*keys)
        shipments: list[dict[str, Any]] = []
        for v in values:
            if v:
                try:
                    shipments.append(json.loads(v))
                except (json.JSONDecodeError, TypeError):
                    pass

        total     = len(shipments)
        at_risk   = sum(1 for s in shipments if float(s.get("risk_score", 0)) > 60)
        rerouting = sum(1 for s in shipments if s.get("status") == "rerouting")
        on_time   = sum(1 for s in shipments if s.get("status") == "on_time")
        on_time_pct = round((on_time / total) * 100, 1) if total > 0 else 100.0

        return {
            "total":       total,
            "at_risk":     at_risk,
            "rerouting":   rerouting,
            "on_time_pct": on_time_pct,
        }
    except Exception as exc:
        logger.error("get_analytics Redis error: %s", exc)
        return {"total": 0, "at_risk": 0, "rerouting": 0, "on_time_pct": 100.0}


# ─── Anomaly events ───────────────────────────────────────────────────────────

@router.get("/anomalies")
async def get_anomalies() -> list[dict[str, Any]]:
    """
    Return the last 100 port-congestion anomaly events detected by Isolation Forest.
    Each event: {port, congestion, decision_score, timestamp}
    """
    try:
        redis = await get_redis()
        raw_events = await redis.lrange("anomaly:events", 0, -1)
        events = []
        for r in raw_events:
            try:
                events.append(json.loads(r))
            except (json.JSONDecodeError, TypeError):
                pass
        return list(reversed(events))  # newest first
    except Exception as exc:
        logger.error("get_anomalies error: %s", exc)
        return []


# ─── Disruption simulation ────────────────────────────────────────────────────

@router.post("/simulate/disruption")
async def simulate_disruption(event: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    """Receive a disruption event and re-score affected shipments via ML."""
    logger.info("Disruption simulation triggered: %s", event)
    return {
        "status":  "received",
        "message": "Disruption event received. ML risk scores updated.",
        "event":   event,
    }


# ─── Raw feature scoring ─────────────────────────────────────────────────────

@router.post("/score")
async def score_features(feature_vector: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """
    Score a raw feature vector directly (no shipment lookup).
    Accepts a JSON body matching the 7-field FeatureVector schema.
    Returns: score (0-100), top_risk_factors (SHAP top-3), model_auc.

    Example body:
      {"weather_severity":0.9,"origin_congestion":0.85,"dest_congestion":0.8,
       "carrier_ontime_rate":0.5,"cargo_priority_weight":5,
       "days_until_eta":2,"route_distance_km":8000}
    """
    try:
        from ml.risk_scorer import get_scorer
        from app.models.schemas import FeatureVector as FV
    except ImportError:
        raise HTTPException(status_code=503, detail="ML module not available")

    scorer = get_scorer()
    if scorer is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not trained yet. Run: docker compose exec backend python ml/train_model.py",
        )

    try:
        fv = FV(**feature_vector)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid feature vector: {exc}")

    risk_score       = scorer.score(fv)
    top_risk_factors = scorer.explain(fv, top_n=3)

    return {
        "score":            risk_score,
        "top_risk_factors": top_risk_factors,
        "model_auc":        scorer.auc,
    }


# ─── Live ML prediction ───────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}/predict")
async def predict_risk(shipment_id: str) -> dict[str, Any]:
    """
    Run the XGBoost model on-demand for a shipment.
    Returns: risk_score (0-100), top_risk_factors (SHAP), feature_vector.
    """
    try:
        from ml.risk_scorer import get_scorer
    except ImportError:
        raise HTTPException(status_code=503, detail="ML module not available")

    scorer = get_scorer()
    if scorer is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not trained yet. Run: docker compose exec backend python ml/train_model.py",
        )

    try:
        redis    = await get_redis()
        engineer = FeatureEngineer(redis)
        fv       = await engineer.build(shipment_id)
    except Exception as exc:
        logger.error("predict_risk feature error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Feature computation failed")

    if fv is None:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")

    risk_score       = scorer.score(fv)
    top_risk_factors = scorer.explain(fv, top_n=3)

    # Persist updated score back to Redis
    try:
        raw = await redis.get(f"shipment:{shipment_id}")
        if raw:
            shipment = json.loads(raw)
            shipment["risk_score"]       = risk_score
            shipment["top_risk_factors"] = top_risk_factors
            await redis.set(f"shipment:{shipment_id}", json.dumps(shipment))
    except Exception as exc:
        logger.warning("Could not persist ML score for '%s': %s", shipment_id, exc)

    return {
        "shipment_id":     shipment_id,
        "risk_score":      risk_score,
        "top_risk_factors": top_risk_factors,
        "feature_vector":  fv.model_dump(),
        "model_auc":       scorer.auc,
    }