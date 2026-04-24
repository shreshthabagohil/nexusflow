"""
Static reference data + Redis seeding.

Responsibilities:
  - PORT_COORDS         — lat/lng for every port in the system
  - CARGO_BY_CARRIER    — maps carrier name → cargo type
  - CARGO_PRIORITY_WEIGHTS — maps cargo type → int priority (used by FeatureEngineer)
  - DEFAULT_WEATHER     — baseline weather severity per port  (0-1)
  - DEFAULT_CONGESTION  — baseline congestion score per port  (0-1)
  - DEFAULT_CARRIER_ONTIME_RATES — baseline on-time rate per carrier (0-1)
  - SHIPMENTS_SEED      — 500 shipments (S001-S003 demos + NX1001-NX1050 + NX1051-NX1497 generated)
  - seed_redis()        — async fn called once on backend startup
                          writes shipments + defaults into Redis so every
                          endpoint works immediately, even before Faust enriches data.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ─── Port coordinates (lat, lng) ─────────────────────────────────────────────
PORT_COORDS: dict[str, tuple[float, float]] = {
    "Singapore":          (1.3521,   103.8198),
    "Mumbai":             (18.9254,   72.8242),
    "Rotterdam":          (51.9244,    4.4777),
    "Mombasa":            (-4.0435,   39.6682),
    "Los Angeles":        (33.7395, -118.2592),
    "Vancouver":          (49.2827, -123.1207),
    "Hamburg":            (53.5753,    9.9690),
    "Dubai (Jebel Ali)":  (24.9857,   55.0272),
    "Busan":              (35.1796,  129.0756),
    "Yokohama":           (35.4437,  139.6380),
    "Antwerp":            (51.2213,    4.3997),
    "New York":           (40.6840,  -74.0445),
    "Durban":             (-29.8587,  31.0218),
    "Colombo":            (6.9333,    79.8428),
    "Hong Kong":          (22.3193,  114.1694),
    "Felixstowe":         (51.9559,    1.3512),
    "Port Klang":         (3.0000,   101.4000),
    "Long Beach":         (33.7543, -118.1890),
    "Santos":             (-23.9608, -46.3336),
    "Tanjung Pelepas":    (1.3630,   103.5534),
    "Shenzhen":           (22.5431,  114.0579),
    "Shanghai":           (31.2304,  121.4737),
    "Qingdao":            (36.0671,  120.3826),
    "Tianjin":            (38.9142,  117.2804),
    "Jeddah":             (21.4858,   39.1925),
}

# ─── Cargo type by carrier ────────────────────────────────────────────────────
CARGO_BY_CARRIER: dict[str, str] = {
    "Maersk":      "ELECTRONICS",
    "MSC":         "GENERAL",
    "CMA CGM":     "AUTOMOTIVE",
    "Evergreen":   "PHARMA",
    "COSCO":       "CHEMICALS",
    "Hapag-Lloyd": "FOOD",
    "ONE":         "ELECTRONICS",
    "Yang Ming":   "GENERAL",
    "HMM":         "AUTOMOTIVE",
    "PIL":         "CHEMICALS",
}

# ─── Cargo priority weights ───────────────────────────────────────────────────
CARGO_PRIORITY_WEIGHTS: dict[str, int] = {
    "PHARMA":      10,
    "ELECTRONICS": 8,
    "AUTOMOTIVE":  7,
    "CHEMICALS":   6,
    "FOOD":        5,
    "GENERAL":     3,
}

# ─── Default weather severity per port (0.0 – 1.0) ───────────────────────────
# Overwritten by Faust when live weather events arrive.
DEFAULT_WEATHER: dict[str, float] = {
    "Singapore":         0.20,
    "Mumbai":            0.30,
    "Rotterdam":         0.40,
    "Mombasa":           0.20,
    "Los Angeles":       0.10,
    "Vancouver":         0.30,
    "Hamburg":           0.35,
    "Dubai (Jebel Ali)": 0.15,
    "Busan":             0.25,
    "Yokohama":          0.20,
    "Antwerp":           0.40,
    "New York":          0.30,
    "Durban":            0.25,
    "Colombo":           0.20,
    "Hong Kong":         0.30,
    "Felixstowe":        0.35,
    "Port Klang":        0.20,
    "Long Beach":        0.15,
    "Santos":            0.25,
    "Tanjung Pelepas":   0.20,
    "Shenzhen":          0.25,
    "Shanghai":          0.30,
    "Qingdao":           0.20,
    "Tianjin":           0.25,
    "Jeddah":            0.15,
}

# ─── Default port congestion (0.0 – 1.0) ─────────────────────────────────────
DEFAULT_CONGESTION: dict[str, float] = {
    "Singapore":         0.70,
    "Mumbai":            0.60,
    "Rotterdam":         0.50,
    "Mombasa":           0.40,
    "Los Angeles":       0.80,
    "Vancouver":         0.50,
    "Hamburg":           0.55,
    "Dubai (Jebel Ali)": 0.60,
    "Busan":             0.65,
    "Yokohama":          0.60,
    "Antwerp":           0.50,
    "New York":          0.75,
    "Durban":            0.40,
    "Colombo":           0.45,
    "Hong Kong":         0.70,
    "Felixstowe":        0.55,
    "Port Klang":        0.60,
    "Long Beach":        0.80,
    "Santos":            0.45,
    "Tanjung Pelepas":   0.55,
    "Shenzhen":          0.75,
    "Shanghai":          0.80,
    "Qingdao":           0.60,
    "Tianjin":           0.65,
    "Jeddah":            0.50,
}

# ─── Default carrier on-time rates (0.0 – 1.0) ───────────────────────────────
DEFAULT_CARRIER_ONTIME_RATES: dict[str, float] = {
    "Maersk":      0.91,
    "MSC":         0.87,
    "CMA CGM":     0.85,
    "Evergreen":   0.82,
    "COSCO":       0.83,
    "Hapag-Lloyd": 0.88,
    "ONE":         0.84,
    "Yang Ming":   0.80,
    "HMM":         0.79,
    "PIL":         0.76,
}

# ─── Shipment seed list ───────────────────────────────────────────────────────
# S001/S002/S003 = synthetic test shipments so demo curl commands always work.
# NX1001-NX1050 = production-like shipments matching the frontend mock data.
# departure_date is derived at seed time as ETA - 14 days.
_RAW_SHIPMENTS: list[dict[str, Any]] = [
    # ── Synthetic demo shipments ──────────────────────────────────────────────
    {"id": "S001", "origin_port": "Singapore",  "destination_port": "Mumbai",
     "carrier": "MSC",         "eta": "2026-05-10T12:00:00Z",
     "current_lat": 5.5,  "current_lng": 85.0,  "status": "in_transit", "risk_score": 32.0},
    {"id": "S002", "origin_port": "Rotterdam",  "destination_port": "Los Angeles",
     "carrier": "Maersk",      "eta": "2026-05-20T12:00:00Z",
     "current_lat": 35.0, "current_lng": -40.0, "status": "in_transit", "risk_score": 18.0},
    {"id": "S003", "origin_port": "Hamburg",    "destination_port": "Busan",
     "carrier": "Hapag-Lloyd", "eta": "2026-05-25T12:00:00Z",
     "current_lat": 30.0, "current_lng": 60.0,  "status": "at_risk",    "risk_score": 67.0},
    # ── NX1001-NX1050 (matching frontend mock data) ───────────────────────────
    {"id": "NX1001", "origin_port": "Singapore",        "destination_port": "Mumbai",            "carrier": "MSC",         "eta": "2026-04-29T17:57:39Z", "current_lat": 10.7489,  "current_lng": 84.0357,   "status": "on_time",  "risk_score": 7.0},
    {"id": "NX1002", "origin_port": "Rotterdam",        "destination_port": "Mombasa",           "carrier": "CMA CGM",     "eta": "2026-05-13T17:57:39Z", "current_lat": 13.3201,  "current_lng": 30.2474,   "status": "on_time",  "risk_score": 2.0},
    {"id": "NX1003", "origin_port": "Los Angeles",      "destination_port": "Vancouver",         "carrier": "Evergreen",   "eta": "2026-05-14T17:57:39Z", "current_lat": 39.0781,  "current_lng": -121.219,  "status": "on_time",  "risk_score": 16.0},
    {"id": "NX1004", "origin_port": "Hamburg",          "destination_port": "Dubai (Jebel Ali)", "carrier": "COSCO",       "eta": "2026-05-08T17:57:39Z", "current_lat": 49.7324,  "current_lng": 15.0368,   "status": "on_time",  "risk_score": 17.0},
    {"id": "NX1005", "origin_port": "Busan",            "destination_port": "Yokohama",          "carrier": "Hapag-Lloyd", "eta": "2026-05-19T17:57:39Z", "current_lat": 35.4579,  "current_lng": 132.7773,  "status": "on_time",  "risk_score": 0.0},
    {"id": "NX1006", "origin_port": "Dubai (Jebel Ali)","destination_port": "Tanjung Pelepas",  "carrier": "ONE",         "eta": "2026-05-01T17:57:39Z", "current_lat": 7.6941,   "current_lng": 91.2877,   "status": "on_time",  "risk_score": 4.0},
    {"id": "NX1007", "origin_port": "Hong Kong",        "destination_port": "Rotterdam",         "carrier": "Yang Ming",   "eta": "2026-05-06T17:57:39Z", "current_lat": 47.995,   "current_lng": 15.9823,   "status": "on_time",  "risk_score": 3.0},
    {"id": "NX1008", "origin_port": "Antwerp",          "destination_port": "New York",          "carrier": "HMM",         "eta": "2026-05-09T17:57:39Z", "current_lat": 43.1697,  "current_lng": -56.8031,  "status": "on_time",  "risk_score": 23.0},
    {"id": "NX1009", "origin_port": "New York",         "destination_port": "Durban",            "carrier": "PIL",         "eta": "2026-05-04T17:57:39Z", "current_lat": 4.6984,   "current_lng": -18.7173,  "status": "on_time",  "risk_score": 17.0},
    {"id": "NX1010", "origin_port": "Mumbai",           "destination_port": "Tianjin",           "carrier": "Maersk",      "eta": "2026-05-01T17:57:39Z", "current_lat": 34.8722,  "current_lng": 108.7947,  "status": "on_time",  "risk_score": 18.0},
    {"id": "NX1011", "origin_port": "Colombo",          "destination_port": "Busan",             "carrier": "MSC",         "eta": "2026-04-27T17:57:39Z", "current_lat": 24.4977,  "current_lng": 112.0894,  "status": "on_time",  "risk_score": 9.0},
    {"id": "NX1012", "origin_port": "Felixstowe",       "destination_port": "Yokohama",          "carrier": "CMA CGM",     "eta": "2026-05-15T17:57:39Z", "current_lat": 39.8745,  "current_lng": 111.3458,  "status": "on_time",  "risk_score": 14.0},
    {"id": "NX1013", "origin_port": "Yokohama",         "destination_port": "Port Klang",        "carrier": "Evergreen",   "eta": "2026-05-03T17:57:39Z", "current_lat": 9.0923,   "current_lng": 109.3326,  "status": "on_time",  "risk_score": 21.0},
    {"id": "NX1014", "origin_port": "Long Beach",       "destination_port": "Singapore",         "carrier": "COSCO",       "eta": "2026-04-30T17:57:39Z", "current_lat": 12.559,   "current_lng": 29.2811,   "status": "on_time",  "risk_score": 20.0},
    {"id": "NX1015", "origin_port": "Santos",           "destination_port": "Antwerp",           "carrier": "Hapag-Lloyd", "eta": "2026-05-15T17:57:39Z", "current_lat": 15.0499,  "current_lng": -19.607,   "status": "on_time",  "risk_score": 8.0},
    {"id": "NX1016", "origin_port": "Durban",           "destination_port": "Santos",            "carrier": "ONE",         "eta": "2026-05-19T17:57:39Z", "current_lat": -26.8224, "current_lng": -20.4,     "status": "on_time",  "risk_score": 24.0},
    {"id": "NX1017", "origin_port": "Mombasa",          "destination_port": "Qingdao",           "carrier": "Yang Ming",   "eta": "2026-05-03T17:57:39Z", "current_lat": 2.0006,   "current_lng": 50.8266,   "status": "on_time",  "risk_score": 12.0},
    {"id": "NX1018", "origin_port": "Jeddah",           "destination_port": "Hamburg",           "carrier": "HMM",         "eta": "2026-05-05T17:57:39Z", "current_lat": 27.1328,  "current_lng": 35.4031,   "status": "on_time",  "risk_score": 22.0},
    {"id": "NX1019", "origin_port": "Port Klang",       "destination_port": "Colombo",           "carrier": "PIL",         "eta": "2026-05-09T17:57:39Z", "current_lat": 4.0156,   "current_lng": 96.9652,   "status": "on_time",  "risk_score": 20.0},
    {"id": "NX1020", "origin_port": "Tanjung Pelepas",  "destination_port": "Jeddah",            "carrier": "Maersk",      "eta": "2026-05-03T17:57:39Z", "current_lat": 4.3149,   "current_lng": 91.409,    "status": "on_time",  "risk_score": 17.0},
    {"id": "NX1021", "origin_port": "Shenzhen",         "destination_port": "Shanghai",          "carrier": "MSC",         "eta": "2026-05-02T17:57:39Z", "current_lat": 28.4662,  "current_lng": 119.5495,  "status": "on_time",  "risk_score": 11.0},
    {"id": "NX1022", "origin_port": "Qingdao",          "destination_port": "Hong Kong",         "carrier": "CMA CGM",     "eta": "2026-04-26T17:57:39Z", "current_lat": 22.3525,  "current_lng": 114.6598,  "status": "on_time",  "risk_score": 24.0},
    {"id": "NX1023", "origin_port": "Tianjin",          "destination_port": "Long Beach",        "carrier": "Evergreen",   "eta": "2026-05-08T17:57:39Z", "current_lat": 33.7569,  "current_lng": -72.7599,  "status": "on_time",  "risk_score": 21.0},
    {"id": "NX1024", "origin_port": "Vancouver",        "destination_port": "Shenzhen",          "carrier": "COSCO",       "eta": "2026-05-11T17:57:39Z", "current_lat": 33.3967,  "current_lng": 14.9692,   "status": "on_time",  "risk_score": 14.0},
    {"id": "NX1025", "origin_port": "Shanghai",         "destination_port": "Los Angeles",       "carrier": "Hapag-Lloyd", "eta": "2026-05-18T17:57:39Z", "current_lat": 32.1201,  "current_lng": 53.033,    "status": "on_time",  "risk_score": 21.0},
    {"id": "NX1026", "origin_port": "Singapore",        "destination_port": "Mumbai",            "carrier": "ONE",         "eta": "2026-05-15T17:57:39Z", "current_lat": 5.549,    "current_lng": 99.1431,   "status": "on_time",  "risk_score": 24.0},
    {"id": "NX1027", "origin_port": "Rotterdam",        "destination_port": "Mombasa",           "carrier": "Yang Ming",   "eta": "2026-05-18T17:57:39Z", "current_lat": 30.8118,  "current_lng": 16.3304,   "status": "on_time",  "risk_score": 0.0},
    {"id": "NX1028", "origin_port": "Los Angeles",      "destination_port": "Vancouver",         "carrier": "HMM",         "eta": "2026-05-11T17:57:39Z", "current_lat": 45.719,   "current_lng": -122.2258, "status": "on_time",  "risk_score": 5.0},
    {"id": "NX1029", "origin_port": "Hamburg",          "destination_port": "Dubai (Jebel Ali)", "carrier": "PIL",         "eta": "2026-05-11T17:57:39Z", "current_lat": 30.4628,  "current_lng": 47.5596,   "status": "delayed",  "risk_score": 50.0},
    {"id": "NX1030", "origin_port": "Busan",            "destination_port": "Yokohama",          "carrier": "Maersk",      "eta": "2026-05-19T17:57:39Z", "current_lat": 34.2598,  "current_lng": 136.1027,  "status": "delayed",  "risk_score": 47.0},
    {"id": "NX1031", "origin_port": "Dubai (Jebel Ali)","destination_port": "Tanjung Pelepas",  "carrier": "MSC",         "eta": "2026-04-25T17:57:39Z", "current_lat": 6.0404,   "current_lng": 96.8158,   "status": "delayed",  "risk_score": 45.0},
    {"id": "NX1032", "origin_port": "Hong Kong",        "destination_port": "Rotterdam",         "carrier": "CMA CGM",     "eta": "2026-05-02T17:57:39Z", "current_lat": 27.0511,  "current_lng": 96.5399,   "status": "delayed",  "risk_score": 39.0},
    {"id": "NX1033", "origin_port": "Antwerp",          "destination_port": "New York",          "carrier": "Evergreen",   "eta": "2026-05-18T17:57:39Z", "current_lat": 51.0005,  "current_lng": -4.3779,   "status": "delayed",  "risk_score": 32.0},
    {"id": "NX1034", "origin_port": "New York",         "destination_port": "Durban",            "carrier": "COSCO",       "eta": "2026-04-29T17:57:39Z", "current_lat": 4.949,    "current_lng": -21.984,   "status": "delayed",  "risk_score": 54.0},
    {"id": "NX1035", "origin_port": "Mumbai",           "destination_port": "Tianjin",           "carrier": "Hapag-Lloyd", "eta": "2026-05-11T17:57:39Z", "current_lat": 22.6271,  "current_lng": 81.4187,   "status": "delayed",  "risk_score": 38.0},
    {"id": "NX1036", "origin_port": "Colombo",          "destination_port": "Busan",             "carrier": "ONE",         "eta": "2026-05-19T17:57:39Z", "current_lat": 29.6016,  "current_lng": 118.9769,  "status": "delayed",  "risk_score": 47.0},
    {"id": "NX1037", "origin_port": "Felixstowe",       "destination_port": "Yokohama",          "carrier": "Yang Ming",   "eta": "2026-05-15T17:57:39Z", "current_lat": 39.612,   "current_lng": 96.6201,   "status": "delayed",  "risk_score": 51.0},
    {"id": "NX1038", "origin_port": "Yokohama",         "destination_port": "Port Klang",        "carrier": "HMM",         "eta": "2026-05-02T17:57:39Z", "current_lat": 23.8575,  "current_lng": 124.424,   "status": "delayed",  "risk_score": 37.0},
    {"id": "NX1039", "origin_port": "Long Beach",       "destination_port": "Singapore",         "carrier": "PIL",         "eta": "2026-05-02T17:57:39Z", "current_lat": 27.9808,  "current_lng": -88.3009,  "status": "delayed",  "risk_score": 48.0},
    {"id": "NX1040", "origin_port": "Santos",           "destination_port": "Antwerp",           "carrier": "Maersk",      "eta": "2026-04-26T17:57:39Z", "current_lat": -16.8701, "current_lng": -43.2906,  "status": "delayed",  "risk_score": 32.0},
    {"id": "NX1041", "origin_port": "Durban",           "destination_port": "Santos",            "carrier": "MSC",         "eta": "2026-05-10T17:57:39Z", "current_lat": -26.4176, "current_lng": -31.7987,  "status": "at_risk",  "risk_score": 76.0},
    {"id": "NX1042", "origin_port": "Mombasa",          "destination_port": "Qingdao",           "carrier": "CMA CGM",     "eta": "2026-05-13T17:57:39Z", "current_lat": 5.2681,   "current_lng": 61.9537,   "status": "at_risk",  "risk_score": 73.0},
    {"id": "NX1043", "origin_port": "Jeddah",           "destination_port": "Hamburg",           "carrier": "Evergreen",   "eta": "2026-04-28T17:57:39Z", "current_lat": 37.6626,  "current_lng": 26.1736,   "status": "at_risk",  "risk_score": 61.0},
    {"id": "NX1044", "origin_port": "Port Klang",       "destination_port": "Colombo",           "carrier": "COSCO",       "eta": "2026-05-18T17:57:39Z", "current_lat": 3.4259,   "current_lng": 97.6928,   "status": "at_risk",  "risk_score": 69.0},
    {"id": "NX1045", "origin_port": "Tanjung Pelepas",  "destination_port": "Jeddah",            "carrier": "Hapag-Lloyd", "eta": "2026-05-07T17:57:39Z", "current_lat": 4.363,    "current_lng": 95.8767,   "status": "at_risk",  "risk_score": 56.0},
    {"id": "NX1046", "origin_port": "Shenzhen",         "destination_port": "Shanghai",          "carrier": "ONE",         "eta": "2026-05-01T17:57:39Z", "current_lat": 29.4522,  "current_lng": 118.0155,  "status": "at_risk",  "risk_score": 61.0},
    {"id": "NX1047", "origin_port": "Qingdao",          "destination_port": "Hong Kong",         "carrier": "Yang Ming",   "eta": "2026-05-02T17:57:39Z", "current_lat": 27.693,   "current_lng": 116.1392,  "status": "rerouting","risk_score": 79.0},
    {"id": "NX1048", "origin_port": "Tianjin",          "destination_port": "Long Beach",        "carrier": "HMM",         "eta": "2026-05-12T17:57:39Z", "current_lat": 33.4619,  "current_lng": -73.647,   "status": "rerouting","risk_score": 92.0},
    {"id": "NX1049", "origin_port": "Vancouver",        "destination_port": "Shenzhen",          "carrier": "PIL",         "eta": "2026-04-27T17:57:39Z", "current_lat": 45.4113,  "current_lng": -84.5751,  "status": "rerouting","risk_score": 65.0},
    {"id": "NX1050", "origin_port": "Shanghai",         "destination_port": "Los Angeles",       "carrier": "Maersk",      "eta": "2026-05-10T17:57:39Z", "current_lat": 34.4297,  "current_lng": -85.228,   "status": "rerouting","risk_score": 80.0},
]


def _enrich(raw: dict[str, Any]) -> dict[str, Any]:
    """Add cargo_type, departure_date, top_risk_factors to a raw shipment dict."""
    carrier = raw.get("carrier", "")
    cargo_type = CARGO_BY_CARRIER.get(carrier, "GENERAL")

    # departure_date = ETA - 14 days (reasonable average sea transit)
    eta_str = raw.get("eta", "")
    try:
        eta_dt = datetime.fromisoformat(eta_str.replace("Z", "+00:00"))
        departure_date = (eta_dt - timedelta(days=14)).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        departure_date = ""

    return {
        **raw,
        "cargo_type": cargo_type,
        "departure_date": departure_date,
        "top_risk_factors": [],
    }


# ─── Programmatic generator for NX1051-NX1497 ────────────────────────────────

def _generate_bulk_shipments(start: int = 1051, count: int = 447, seed: int = 42) -> list[dict[str, Any]]:
    """
    Generate `count` synthetic shipments (NX{start} through NX{start+count-1}).
    Uses a deterministic pseudo-random sequence so restarts produce identical data.
    Status + risk_score distributions roughly mirror the hand-crafted set above.
    """
    import random as _random
    rng = _random.Random(seed)

    ports = list(PORT_COORDS.keys())
    carriers = list(CARGO_BY_CARRIER.keys())

    # Status weights: 40% on_time, 30% delayed, 20% at_risk, 10% rerouting
    statuses = ["on_time"] * 40 + ["delayed"] * 30 + ["at_risk"] * 20 + ["rerouting"] * 10

    # Risk score ranges per status (realistic distributions)
    risk_ranges = {
        "on_time":   (0,  30),
        "delayed":   (30, 60),
        "at_risk":   (55, 79),
        "rerouting": (65, 99),
    }

    # Base ETA: between 5 and 35 days from a fixed anchor date
    anchor = datetime(2026, 4, 24, 17, 57, 39, tzinfo=timezone.utc)

    shipments: list[dict[str, Any]] = []
    for i in range(count):
        sid = f"NX{start + i}"

        origin = rng.choice(ports)
        dest_candidates = [p for p in ports if p != origin]
        dest = rng.choice(dest_candidates)

        carrier = rng.choice(carriers)
        status  = rng.choice(statuses)
        lo, hi  = risk_ranges[status]
        risk    = round(rng.uniform(lo, hi), 1)

        eta_days = rng.uniform(5, 35)
        eta_dt   = anchor + timedelta(days=eta_days)
        eta_str  = eta_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Interpolate lat/lng between origin and dest with some noise
        o_lat, o_lng = PORT_COORDS[origin]
        d_lat, d_lng = PORT_COORDS[dest]
        t = rng.uniform(0.1, 0.9)
        noise_lat = rng.uniform(-3.0, 3.0)
        noise_lng = rng.uniform(-5.0, 5.0)
        cur_lat = round(o_lat + t * (d_lat - o_lat) + noise_lat, 4)
        cur_lng = round(o_lng + t * (d_lng - o_lng) + noise_lng, 4)

        shipments.append({
            "id":               sid,
            "origin_port":      origin,
            "destination_port": dest,
            "carrier":          carrier,
            "eta":              eta_str,
            "current_lat":      cur_lat,
            "current_lng":      cur_lng,
            "status":           status,
            "risk_score":       risk,
        })

    return [_enrich(s) for s in shipments]


# Public seed list — 500 shipments total, fully enriched
SHIPMENTS_SEED: list[dict[str, Any]] = (
    [_enrich(s) for s in _RAW_SHIPMENTS]   # 53  hand-crafted (S001-S003 + NX1001-NX1050)
    + _generate_bulk_shipments(start=1051, count=447)  # 447 generated → total 500
)


# ─── Redis seeding ────────────────────────────────────────────────────────────

async def seed_redis(redis) -> None:  # type: ignore[type-arg]
    """
    Write baseline data into Redis so every endpoint works on first boot,
    even before Faust stream processors have run.

    Keys written:
      shipment:{id}                → JSON blob
      weather:{port}               → float severity
      congestion:{port}            → float congestion score
      carrier:{name}:ontime_rate   → float on-time rate
    """
    pipe = redis.pipeline()

    # Shipments
    for shipment in SHIPMENTS_SEED:
        pipe.set(f"shipment:{shipment['id']}", json.dumps(shipment))

    # Weather baselines (only write if key doesn't already exist
    # so live Faust updates are never overwritten on restart)
    for port, severity in DEFAULT_WEATHER.items():
        pipe.set(f"weather:{port}", severity, nx=True)

    # Congestion baselines
    for port, score in DEFAULT_CONGESTION.items():
        pipe.set(f"congestion:{port}", score, nx=True)

    # Carrier on-time rates
    for carrier, rate in DEFAULT_CARRIER_ONTIME_RATES.items():
        pipe.set(f"carrier:{carrier}:ontime_rate", rate, nx=True)

    await pipe.execute()
    logger.info(
        "Redis seeded: %d shipments, %d weather keys, %d carrier keys.",
        len(SHIPMENTS_SEED),
        len(DEFAULT_WEATHER),
        len(DEFAULT_CARRIER_ONTIME_RATES),
    )