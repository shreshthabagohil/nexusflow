"""
Shipment API routes.

Endpoints:
  GET  /api/shipments                      → list all shipments
  GET  /api/shipments/{id}                 → single shipment
  GET  /api/shipments/{id}/features        → 7-field FeatureVector  (T1 ✓)
  GET  /api/shipments/{id}/reroute         → 3 Pareto-optimal reroute options
  GET  /api/analytics                      → aggregate stats
  GET  /api/score/{id}                     → XGBoost risk score + SHAP top-3 factors
  POST /api/simulate/disruption            → disruption sim (legacy path)
  POST /api/simulation/disrupt             → disruption sim (Day 5 path)
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Body, HTTPException

from app.models.schemas import FeatureVector, RiskScoreResponse, Shipment
from app.services.feature_engineer import FeatureEngineer
from app.services.redis_client import get_redis
from app.services.route_optimizer import RouteOptimizer
from ml.risk_scorer import get_scorer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["shipments"])


# ─── List all shipments ───────────────────────────────────────────────────────

@router.get("/shipments", response_model=list[Shipment])
async def list_shipments() -> list[dict[str, Any]]:
    """
    Return all shipments stored in Redis.
    Validated against the Shipment schema — cargo_type / departure_date are
    optional so older Redis entries without these fields still deserialise.
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
        shipments.sort(key=lambda s: s.get("id", ""))
        return shipments
    except Exception as exc:
        logger.error("list_shipments Redis error: %s", exc)
        return []


# ─── Single shipment ──────────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}", response_model=Shipment)
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

    All 7 fields are always numeric — never null.
      weather_severity       float  (0–1)
      origin_congestion      float  (0–1)
      dest_congestion        float  (0–1)
      carrier_ontime_rate    float  (0–1)
      cargo_priority_weight  int    (1–10)
      days_until_eta         float  (≥ 0)
      route_distance_km      float  (> 0)
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


# ─── ML risk score + SHAP explanation ───────────────────────────────────────

@router.get("/score/{shipment_id}", response_model=RiskScoreResponse)
async def score_shipment(shipment_id: str) -> RiskScoreResponse:
    """
    Score a shipment's disruption risk using the trained XGBoost model.

    Returns:
      - score: int 0-100 (higher = higher disruption risk)
      - top_risk_factors: top 3 SHAP-explained risk drivers
    """
    # 1. Build feature vector
    try:
        redis = await get_redis()
        engineer = FeatureEngineer(redis)
        vector = await engineer.build(shipment_id)
    except Exception as exc:
        logger.error("score_shipment feature build error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Feature computation failed") from exc

    if vector is None:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")

    # 2. Score + explain
    scorer = get_scorer()
    if scorer is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded. Run: docker compose exec backend python ml/train_model.py",
        )

    loop = asyncio.get_event_loop()
    risk_score = await loop.run_in_executor(None, scorer.score, vector)
    top_factors = await loop.run_in_executor(None, scorer.explain, vector)

    # 3. Persist updated score back to Redis
    try:
        raw = await redis.get(f"shipment:{shipment_id}")
        if raw:
            shipment = json.loads(raw)
            shipment["risk_score"] = risk_score
            shipment["top_risk_factors"] = top_factors
            await redis.set(f"shipment:{shipment_id}", json.dumps(shipment))
    except Exception as exc:
        logger.warning("score_shipment: failed to persist score for '%s': %s", shipment_id, exc)

    return RiskScoreResponse(
        shipment_id=shipment_id,
        score=risk_score,
        top_risk_factors=top_factors,
    )


# ─── Reroute options ─────────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}/reroute")
async def get_reroute(shipment_id: str) -> dict[str, Any]:
    """
    Return up to 3 Pareto-optimal reroute options for a shipment.

    Uses Dijkstra shortest paths on the shipping graph. Each option
    includes estimated_time_hours, cost_delta_usd, and risk_reduction.
    """
    try:
        redis = await get_redis()
        raw = await redis.get(f"shipment:{shipment_id}")
    except Exception as exc:
        logger.error("get_reroute Redis error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Redis unavailable") from exc

    if raw is None:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")

    shipment = json.loads(raw)
    optimizer = RouteOptimizer()
    # Run CPU-bound NetworkX work in a thread so the async event loop stays free
    loop = asyncio.get_event_loop()
    routes = await loop.run_in_executor(
        None,
        optimizer.find_reroutes,
        shipment.get("origin_port", "Singapore"),
        shipment.get("destination_port", "Rotterdam"),
    )
    return {"shipment_id": shipment_id, "reroute_options": routes}


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics() -> dict[str, Any]:
    """Aggregate statistics derived from live Redis shipment data."""
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


# ─── Disruption simulation ────────────────────────────────────────────────────

async def _run_disruption(event: dict[str, Any]) -> dict[str, Any]:
    """
    Shared disruption logic for both endpoint paths.

    Sets high congestion for the target port, then re-scores all shipments
    whose destination matches the disrupted port by bumping their risk_score.
    Returns the number of shipments affected.
    """
    port = event.get("port", "Rotterdam")
    severity = float(event.get("severity", 9.5))

# ─── Route optimisation ──────────────────────────────────────────────────────

@router.get("/routes/{shipment_id}")
async def get_routes(shipment_id: str) -> dict[str, Any]:
    """
    Return 3 route options for a shipment (Dijkstra via NetworkX).

    Response:
      {
        "shipment_id": "S001",
        "origin":      "Shanghai",
        "destination": "Rotterdam",
        "reroute_options": [ { route_name, waypoints, distance_km, eta_days,
                               cost_delta, risk_delta, carrier, color, dash_array } ]
      }
    """
    try:
        redis = await get_redis()
        raw = await redis.get(f"shipment:{shipment_id}")
    except Exception as exc:
        logger.error("get_routes Redis error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=503, detail="Redis unavailable") from exc

    if raw is None:
        raise HTTPException(status_code=404, detail=f"Shipment '{shipment_id}' not found.")

    try:
        shipment = json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Corrupt shipment data") from exc

    origin      = shipment.get("origin_port", "")
    destination = shipment.get("destination_port", "")
    carrier     = shipment.get("carrier", "Maersk")
    risk_score  = int(shipment.get("risk_score", 50))

    try:
        from app.services.route_optimizer import get_reroute_options
        options = get_reroute_options(origin, destination, carrier, risk_score)
    except Exception as exc:
        logger.error("route_optimizer error for '%s': %s", shipment_id, exc)
        raise HTTPException(status_code=500, detail=f"Route computation failed: {exc}")

    return {
        "shipment_id":    shipment_id,
        "origin":         origin,
        "destination":    destination,
        "reroute_options": options,
    }


# ─── Raw feature scoring ─────────────────────────────────────────────────────

    try:
        redis = await get_redis()

        # Update congestion for the disrupted port
        # Map port name → code for congestion key
        port_name_to_code = {
            "Rotterdam": "Rotterdam", "Shanghai": "Shanghai", "Singapore": "Singapore",
            "Los Angeles": "Los Angeles", "Dubai": "Dubai", "Hamburg": "Hamburg",
            "Mumbai": "Mumbai", "Busan": "Busan", "Hong Kong": "Hong Kong",
        }
        port_key = port_name_to_code.get(port, port)
        await redis.set(f"congestion:{port_key}", str(min(severity / 10.0, 1.0)))

        # Re-score shipments: find those routed through the disrupted port
        keys = await redis.keys("shipment:*")
        affected = 0
        rescored_shipments = []

        if keys:
            values = await redis.mget(*keys)
            for key, v in zip(keys, values):
                if not v:
                    continue
                try:
                    s = json.loads(v)
                except (json.JSONDecodeError, TypeError):
                    continue

                dest = s.get("destination_port", "")
                origin = s.get("origin_port", "")

                # If shipment touches the disrupted port, bump risk
                if port_key in (dest, origin, port):
                    old_score = float(s.get("risk_score", 30))
                    bump = severity * 5  # severity 9.5 → +47.5 risk
                    new_score = min(99.0, old_score + bump)
                    s["risk_score"] = round(new_score, 1)
                    if new_score > 60:
                        s["status"] = "at_risk"
                    await redis.set(key, json.dumps(s))
                    affected += 1
                    rescored_shipments.append({
                        "shipment_id": s.get("id"),
                        "old_score": old_score,
                        "new_score": round(new_score, 1),
                    })

        return {
            "status": "simulated",
            "message": f"Disruption simulated at {port}",
            "port": port,
            "severity": severity,
            "shipments_queued": affected,
            "rescored": rescored_shipments[:10],  # first 10 for response brevity
        }
    except Exception as exc:
        logger.error("Disruption simulation failed: %s", exc)
        return {
            "status": "error",
            "message": f"Disruption simulation failed: {exc}",
            "shipments_queued": 0,
        }


@router.post("/simulate/disruption")
async def simulate_disruption(
    event: dict[str, Any] = Body(default={}),
) -> dict[str, Any]:
    """Legacy disruption endpoint path (kept for backward compatibility)."""
    return await _run_disruption(event)


@router.post("/simulation/disrupt")
async def simulation_disrupt(
    event: dict[str, Any] = Body(default={}),
) -> dict[str, Any]:
    """
    Day 5 disruption endpoint. Simulates port closure or weather event.
    Triggers mass rescoring of affected shipments.
    """
    return await _run_disruption(event)
