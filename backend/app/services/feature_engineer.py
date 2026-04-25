"""
FeatureEngineer — builds the 7-field feature vector for a shipment.

Design principles:
  - Never crashes. Every Redis miss is caught and replaced with a sensible default.
  - Reads from Redis (live data written by Faust stream processors).
  - Falls back to seed defaults when Redis keys are absent (cold start, Faust not running).
  - route_distance_km computed via Haversine on port coordinates — no external API needed.
  - days_until_eta computed from UTC now vs shipment ETA string.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from typing import Any

from app.data.seed_data import (
    CARGO_BY_CARRIER,
    CARGO_PRIORITY_WEIGHTS,
    DEFAULT_CARRIER_ONTIME_RATES,
    DEFAULT_CONGESTION,
    DEFAULT_WEATHER,
    PORT_COORDS,
)
from app.models.schemas import FeatureVector

logger = logging.getLogger(__name__)

# Fallback distance when both ports are unknown (km) — mid-Pacific average
_FALLBACK_DISTANCE_KM = 5_000.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two geographic points (km)."""
    R = 6_371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


class FeatureEngineer:
    """
    Computes a FeatureVector for a given shipment_id.

    Usage:
        redis = await get_redis()
        fe = FeatureEngineer(redis)
        vector = await fe.build("NX1001")   # returns FeatureVector | None
    """

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    async def build(self, shipment_id: str) -> FeatureVector | None:
        """
        Return a fully-populated FeatureVector, or None if the shipment
        is not found in Redis (caller should return HTTP 404).
        """
        # ── 1. Load shipment ─────────────────────────────────────────────────
        raw = await self._safe_get(f"shipment:{shipment_id}")
        if raw is None:
            logger.warning("FeatureEngineer: shipment '%s' not found in Redis.", shipment_id)
            return None

        try:
            shipment: dict[str, Any] = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.error("FeatureEngineer: corrupt Redis value for '%s': %s", shipment_id, exc)
            return None

        origin  = shipment.get("origin_port", "")
        dest    = shipment.get("destination_port", "")
        carrier = shipment.get("carrier", "")
        # cargo_type may have been set during seeding; fall back to carrier map
        cargo_type = shipment.get("cargo_type") or CARGO_BY_CARRIER.get(carrier, "GENERAL")
        eta_str    = shipment.get("eta", "")

        # ── 2. weather_severity — average of origin & destination weather ────
        origin_weather = await self._safe_float(
            f"weather:{origin}", DEFAULT_WEATHER.get(origin, 0.30)
        )
        dest_weather = await self._safe_float(
            f"weather:{dest}", DEFAULT_WEATHER.get(dest, 0.30)
        )
        weather_severity = round((origin_weather + dest_weather) / 2.0, 4)

        # ── 3. origin_congestion ─────────────────────────────────────────────
        origin_congestion = await self._safe_float(
            f"congestion:{origin}", DEFAULT_CONGESTION.get(origin, 0.50)
        )

        # ── 4. dest_congestion ───────────────────────────────────────────────
        dest_congestion = await self._safe_float(
            f"congestion:{dest}", DEFAULT_CONGESTION.get(dest, 0.50)
        )

        # ── 5. carrier_ontime_rate ───────────────────────────────────────────
        carrier_ontime_rate = await self._safe_float(
            f"carrier:{carrier}:ontime_rate",
            DEFAULT_CARRIER_ONTIME_RATES.get(carrier, 0.80),
        )

        # ── 6. cargo_priority_weight (int, 1-10) ─────────────────────────────
        cargo_priority_weight = CARGO_PRIORITY_WEIGHTS.get(cargo_type, 3)

        # ── 7. days_until_eta ────────────────────────────────────────────────
        days_until_eta = _days_until_eta(eta_str)

        # ── 8. route_distance_km ─────────────────────────────────────────────
        route_distance_km = _route_distance_km(origin, dest)

        return FeatureVector(
            weather_severity=weather_severity,
            origin_congestion=round(origin_congestion, 4),
            dest_congestion=round(dest_congestion, 4),
            carrier_ontime_rate=round(carrier_ontime_rate, 4),
            cargo_priority_weight=cargo_priority_weight,
            days_until_eta=round(days_until_eta, 4),
            route_distance_km=round(route_distance_km, 2),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _safe_get(self, key: str) -> str | None:
        """GET from Redis; returns None on any error."""
        try:
            return await self._redis.get(key)
        except Exception as exc:
            logger.error("Redis GET '%s' failed: %s", key, exc)
            return None

    async def _safe_float(self, key: str, default: float) -> float:
        """GET a float from Redis; returns *default* on miss or error."""
        raw = await self._safe_get(key)
        if raw is None:
            return default
        try:
            return float(raw)
        except (ValueError, TypeError):
            logger.warning("Redis key '%s' has non-numeric value '%s'. Using default.", key, raw)
            return default


# ── Module-level pure helpers (no I/O) ───────────────────────────────────────

def _days_until_eta(eta_str: str) -> float:
    """Fractional days from now until ETA. Returns 0.0 if past or unparseable."""
    if not eta_str:
        return 0.0
    try:
        eta_dt = datetime.fromisoformat(eta_str.replace("Z", "+00:00"))
        now    = datetime.now(timezone.utc)
        delta  = (eta_dt - now).total_seconds() / 86_400.0
        return max(0.0, delta)
    except (ValueError, TypeError) as exc:
        logger.warning("Could not parse ETA '%s': %s", eta_str, exc)
        return 0.0


def _route_distance_km(origin: str, dest: str) -> float:
    """
    Straight-line (Haversine) distance between origin and destination ports.
    Sea routes are longer, but Haversine gives a deterministic, reproducible
    baseline that's good enough for ML features. Returns fallback for unknown ports.
    """
    o = PORT_COORDS.get(origin)
    d = PORT_COORDS.get(dest)
    if o is None or d is None:
        logger.warning(
            "Unknown port(s) for distance calc: origin='%s' dest='%s'. Using fallback.",
            origin, dest,
        )
        return _FALLBACK_DISTANCE_KM
    return _haversine_km(*o, *d)
