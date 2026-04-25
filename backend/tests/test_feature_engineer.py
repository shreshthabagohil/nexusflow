"""
Unit tests for FeatureEngineer pure helpers and async build().

Pure helpers (_days_until_eta, _route_distance_km) are tested directly.
The async build() is tested with a mock Redis client so no live Redis needed.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.feature_engineer import (
    FeatureEngineer,
    _days_until_eta,
    _route_distance_km,
)


# ── _days_until_eta ───────────────────────────────────────────────────────────

class TestDaysUntilEta:
    def test_future_eta_returns_positive(self):
        future = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        result = _days_until_eta(future)
        assert 4.9 < result < 5.1

    def test_past_eta_returns_zero(self):
        past = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        assert _days_until_eta(past) == 0.0

    def test_empty_string_returns_zero(self):
        assert _days_until_eta("") == 0.0

    def test_invalid_string_returns_zero(self):
        assert _days_until_eta("not-a-date") == 0.0

    def test_z_suffix_parsed_correctly(self):
        future = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        result = _days_until_eta(future)
        assert 9.9 < result < 10.1

    def test_fractional_day(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
        result = _days_until_eta(future)
        assert 0.45 < result < 0.55


# ── _route_distance_km ────────────────────────────────────────────────────────

class TestRouteDistanceKm:
    def test_known_ports_returns_positive(self):
        dist = _route_distance_km("Singapore", "Rotterdam")
        assert dist > 0

    def test_same_port_returns_zero(self):
        dist = _route_distance_km("Singapore", "Singapore")
        assert dist == pytest.approx(0.0, abs=1.0)

    def test_unknown_origin_returns_fallback(self):
        dist = _route_distance_km("Atlantis", "Rotterdam")
        assert dist == 5_000.0

    def test_unknown_destination_returns_fallback(self):
        dist = _route_distance_km("Singapore", "Narnia")
        assert dist == 5_000.0

    def test_both_unknown_returns_fallback(self):
        dist = _route_distance_km("Nowhere", "Elsewhere")
        assert dist == 5_000.0

    def test_singapore_los_angeles_reasonable_range(self):
        # Haversine great-circle; actual sea route is ~14k km but
        # straight-line should be roughly 14 000 km
        dist = _route_distance_km("Singapore", "Los Angeles")
        assert 13_000 < dist < 16_000

    def test_rotterdam_antwerp_short_distance(self):
        dist = _route_distance_km("Rotterdam", "Antwerp")
        assert dist < 200  # ~73 km straight line


# ── FeatureEngineer.build() — async with mocked Redis ─────────────────────────

def _make_redis(shipment_data: dict, overrides: dict | None = None) -> AsyncMock:
    """
    Build a mock async Redis client.

    shipment_data   — dict stored under 'shipment:<id>'
    overrides       — key→value pairs for weather/congestion/carrier keys
    """
    overrides = overrides or {}
    raw_shipment = json.dumps(shipment_data)

    shipment_key = f"shipment:{shipment_data.get('id', '')}"

    async def _get(key: str):
        if key == shipment_key:
            return raw_shipment
        return overrides.get(key)

    mock = AsyncMock()
    mock.get = AsyncMock(side_effect=_get)
    return mock


@pytest.fixture
def minimal_shipment() -> dict:
    return {
        "id": "NX0001",
        "origin_port": "Singapore",
        "destination_port": "Rotterdam",
        "carrier": "Maersk",
        "cargo_type": "ELECTRONICS",
        "eta": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "current_lat": 1.35,
        "current_lng": 103.82,
    }


class TestFeatureEngineerBuild:
    @pytest.mark.asyncio
    async def test_returns_feature_vector_for_valid_shipment(self, minimal_shipment):
        redis = _make_redis(minimal_shipment)
        fe = FeatureEngineer(redis)
        fv = await fe.build("NX0001")

        assert fv is not None
        assert 0.0 <= fv.weather_severity <= 1.0
        assert 0.0 <= fv.origin_congestion <= 1.0
        assert 0.0 <= fv.dest_congestion <= 1.0
        assert 0.0 <= fv.carrier_ontime_rate <= 1.0
        assert fv.cargo_priority_weight >= 1
        assert fv.days_until_eta > 0
        assert fv.route_distance_km > 0

    @pytest.mark.asyncio
    async def test_missing_shipment_returns_none(self, minimal_shipment):
        redis = _make_redis(minimal_shipment)
        fe = FeatureEngineer(redis)
        fv = await fe.build("DOES_NOT_EXIST")
        assert fv is None

    @pytest.mark.asyncio
    async def test_redis_overrides_applied(self, minimal_shipment):
        redis = _make_redis(
            minimal_shipment,
            overrides={
                "weather:Singapore": "0.75",
                "weather:Rotterdam": "0.65",
                "congestion:Singapore": "0.80",
                "congestion:Rotterdam": "0.60",
                "carrier:Maersk:ontime_rate": "0.95",
            },
        )
        fe = FeatureEngineer(redis)
        fv = await fe.build("NX0001")

        assert fv is not None
        assert fv.weather_severity == pytest.approx(0.70, abs=0.01)  # (0.75+0.65)/2
        assert fv.origin_congestion == pytest.approx(0.80, abs=0.01)
        assert fv.dest_congestion == pytest.approx(0.60, abs=0.01)
        assert fv.carrier_ontime_rate == pytest.approx(0.95, abs=0.01)

    @pytest.mark.asyncio
    async def test_falls_back_to_defaults_when_redis_misses(self, minimal_shipment):
        # No overrides — all feature keys will return None → use seed defaults
        redis = _make_redis(minimal_shipment)
        fe = FeatureEngineer(redis)
        fv = await fe.build("NX0001")

        # Should still return a valid vector (defaults applied)
        assert fv is not None
        assert 0.0 <= fv.weather_severity <= 1.0
        assert 0.0 <= fv.carrier_ontime_rate <= 1.0

    @pytest.mark.asyncio
    async def test_cargo_priority_weight_from_type(self, minimal_shipment):
        redis = _make_redis(minimal_shipment)
        fe = FeatureEngineer(redis)
        fv = await fe.build("NX0001")
        assert fv is not None
        assert isinstance(fv.cargo_priority_weight, int)
        assert 1 <= fv.cargo_priority_weight <= 10

    @pytest.mark.asyncio
    async def test_corrupt_redis_value_returns_none(self, minimal_shipment):
        async def _get(key: str):
            if key.startswith("shipment:"):
                return "NOT_VALID_JSON{{{{"
            return None

        mock = AsyncMock()
        mock.get = AsyncMock(side_effect=_get)
        fe = FeatureEngineer(mock)
        fv = await fe.build("NX0001")
        assert fv is None
