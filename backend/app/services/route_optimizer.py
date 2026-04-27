"""
NexusFlow — Route Optimizer
"""

from __future__ import annotations

import logging
import math
from typing import Any

import networkx as nx

logger = logging.getLogger(__name__)


# ─── Port coordinates (lat, lng) ─────────────────────────────────────────────
# Mirror of seed_data.PORT_COORDS — kept here so route_optimizer has no circular
# import dependency on seed_data.

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

# ─── Congestion multipliers (higher = riskier waypoint) ──────────────────────
PORT_CONGESTION: dict[str, float] = {
    "Singapore":         0.55,
    "Rotterdam":         0.65,
    "Shanghai":          0.75,
    "Shenzhen":          0.70,
    "Hong Kong":         0.60,
    "Los Angeles":       0.70,
    "Long Beach":        0.70,
    "New York":          0.55,
    "Hamburg":           0.50,
    "Antwerp":           0.55,
    "Busan":             0.45,
    "Mumbai":            0.50,
    "Dubai (Jebel Ali)": 0.40,
    "Port Klang":        0.50,
    "Tanjung Pelepas":   0.40,
    "Colombo":           0.35,
    "Mombasa":           0.30,
    "Durban":            0.30,
    "Jeddah":            0.35,
    "Yokohama":          0.45,
    "Qingdao":           0.55,
    "Tianjin":           0.60,
    "Vancouver":         0.40,
    "Santos":            0.35,
    "Felixstowe":        0.45,
}

# ─── Carrier alternatives by route region ────────────────────────────────────
CARRIER_ALTERNATIVES: dict[str, list[str]] = {
    "asia_europe":    ["Maersk", "Hapag-Lloyd", "MSC"],
    "transpacific":   ["COSCO", "Evergreen", "ONE"],
    "transatlantic":  ["MSC", "CMA CGM", "Hapag-Lloyd"],
    "intra_asia":     ["Evergreen", "Yang Ming", "HMM"],
    "default":        ["Maersk", "MSC", "CMA CGM"],
}

# Speed at sea (knots) × nautical-mile conversion factor → km/day
_SPEED_KM_PER_DAY = 500.0   # ~21 knots × 24 h, realistic laden vessel


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two geographic points (km)."""
    R = 6_371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _detect_region(origin: str, dest: str) -> str:
    """Heuristic region classification for carrier selection."""
    asia = {"Singapore", "Shanghai", "Busan", "Hong Kong", "Shenzhen",
            "Yokohama", "Qingdao", "Tianjin", "Port Klang", "Tanjung Pelepas",
            "Mumbai", "Colombo", "Dubai (Jebel Ali)", "Jeddah"}
    europe = {"Rotterdam", "Hamburg", "Antwerp", "Felixstowe"}
    americas = {"Los Angeles", "Long Beach", "New York", "Vancouver", "Santos"}
    o_asia   = origin in asia
    d_asia   = dest   in asia
    o_europe = origin in europe
    d_europe = dest   in europe
    o_am     = origin in americas
    d_am     = dest   in americas
    if (o_asia and d_europe) or (o_europe and d_asia):
        return "asia_europe"
    if (o_asia and d_am) or (o_am and d_asia):
        return "transpacific"
    if (o_europe and d_am) or (o_am and d_europe):
        return "transatlantic"
    if o_asia and d_asia:
        return "intra_asia"
    return "default"


def _build_graph() -> nx.Graph:
    """
    Build a weighted undirected graph of all known ports.
    Edges connect ports that are within a sensible sailing distance of each other
    (≤ 8 000 km — avoids nonsensical cross-world direct links while keeping the
    graph fully connected via multi-hop paths).
    """
    G = nx.Graph()

    for port, (lat, lng) in PORT_COORDS.items():
        congestion = PORT_CONGESTION.get(port, 0.5)
        G.add_node(port, lat=lat, lng=lng, congestion=congestion)

    ports = list(PORT_COORDS.keys())
    for i, p1 in enumerate(ports):
        for p2 in ports[i + 1:]:
            lat1, lng1 = PORT_COORDS[p1]
            lat2, lng2 = PORT_COORDS[p2]
            dist = _haversine_km(lat1, lng1, lat2, lng2)
            if dist <= 8_000:
                cong1 = PORT_CONGESTION.get(p1, 0.5)
                cong2 = PORT_CONGESTION.get(p2, 0.5)
                avg_cong = (cong1 + cong2) / 2.0
                G.add_edge(
                    p1, p2,
                    distance=dist,
                    risk_weight=dist * (1.0 + avg_cong),   # penalise congested hops
                    hop_weight=1.0,                          # fewest hops strategy
                )
    return G


# Build once at module import time (O(n²) but tiny — 25 ports)
_GRAPH: nx.Graph = _build_graph()


def _path_to_waypoints(path: list[str]) -> list[dict[str, Any]]:
    return [
        {"port": p, "lat": PORT_COORDS[p][0], "lng": PORT_COORDS[p][1]}
        for p in path
        if p in PORT_COORDS
    ]


def _path_distance(path: list[str]) -> float:
    total = 0.0
    for a, b in zip(path, path[1:]):
        if a in PORT_COORDS and b in PORT_COORDS:
            total += _haversine_km(*PORT_COORDS[a], *PORT_COORDS[b])
    return total


def _eta_days(distance_km: float) -> float:
    raw = distance_km / _SPEED_KM_PER_DAY
    # Add 0.5–1 day port overhead per waypoint
    return round(raw, 1)


def get_reroute_options(
    origin: str,
    destination: str,
    current_carrier: str = "Maersk",
    current_risk_score: int = 50,
) -> list[dict[str, Any]]:
    """
    Return up to 3 route options between *origin* and *destination*.

    Each option:
        route_name      str
        waypoints       list[{port, lat, lng}]
        distance_km     float
        eta_days        float
        cost_delta      float  (USD thousands, relative to primary)
        risk_delta      float  (% points change vs primary risk score)
        carrier         str
        color           str    (for map Polyline rendering)
        dash_array      str | None
    """
    if origin not in _GRAPH or destination not in _GRAPH:
        logger.warning(
            "get_reroute_options: unknown port(s) origin='%s' dest='%s'", origin, destination
        )
        # Return a single fallback option rather than crashing
        return _fallback_options(origin, destination, current_carrier)

    region   = _detect_region(origin, destination)
    carriers = CARRIER_ALTERNATIVES.get(region, CARRIER_ALTERNATIVES["default"])
    options  = []

    # ── Strategy 1: PRIMARY (shortest distance) ──────────────────────────────
    try:
        path1 = nx.dijkstra_path(_GRAPH, origin, destination, weight="distance")
        dist1 = _path_distance(path1)
        options.append({
            "route_name":  "Primary Route",
            "waypoints":   _path_to_waypoints(path1),
            "distance_km": round(dist1, 0),
            "eta_days":    _eta_days(dist1),
            "cost_delta":  0,       # baseline
            "risk_delta":  0,       # baseline
            "carrier":     current_carrier if current_carrier in carriers else carriers[0],
            "color":       "#1565C0",   # blue solid
            "dash_array":  None,
        })
    except nx.NetworkXNoPath:
        logger.warning("No path (distance) between %s and %s", origin, destination)

    # ── Strategy 2: ALT_SAFE (avoids congestion) ─────────────────────────────
    try:
        path2 = nx.dijkstra_path(_GRAPH, origin, destination, weight="risk_weight")
        dist2 = _path_distance(path2)
        # If it's the same path as primary, perturb it slightly
        if path2 == (options[0]["waypoints"] if options else []):
            raise nx.NetworkXNoPath("same as primary")
        # Risk is typically lower on the congestion-aware path
        risk_d2 = round(max(-25, -current_risk_score * 0.20), 1)
        options.append({
            "route_name":  "Low-Risk Route",
            "waypoints":   _path_to_waypoints(path2),
            "distance_km": round(dist2, 0),
            "eta_days":    _eta_days(dist2),
            "cost_delta":  round(dist2 * 0.000_8 - (options[0]["distance_km"] if options else dist2) * 0.000_8, 1),
            "risk_delta":  risk_d2,
            "carrier":     carriers[1] if len(carriers) > 1 else carriers[0],
            "color":       "#E65100",   # orange dashed
            "dash_array":  "8 4",
        })
    except (nx.NetworkXNoPath, IndexError):
        logger.debug("Could not build alt-safe path %s→%s", origin, destination)

    # ── Strategy 3: ALT_FAST (fewest hops) ───────────────────────────────────
    try:
        path3 = nx.dijkstra_path(_GRAPH, origin, destination, weight="hop_weight")
        dist3 = _path_distance(path3)
        path3_ports = [w["port"] for w in _path_to_waypoints(path3)]
        path1_ports = [w["port"] for w in (options[0]["waypoints"] if options else [])]
        if path3_ports == path1_ports:
            # Force a different alternative by temporarily removing the most
            # congested intermediate node if one exists
            intermediates = path3[1:-1]
            if intermediates:
                most_congested = max(intermediates, key=lambda p: PORT_CONGESTION.get(p, 0))
                temp_G = _GRAPH.copy()
                temp_G.remove_node(most_congested)
                try:
                    path3 = nx.dijkstra_path(temp_G, origin, destination, weight="hop_weight")
                    dist3 = _path_distance(path3)
                except nx.NetworkXNoPath:
                    raise
        cost_d3 = round((dist3 - (options[0]["distance_km"] if options else dist3)) * 0.000_6, 1)
        risk_d3 = round(min(15, current_risk_score * 0.10), 1)   # slightly riskier but faster
        options.append({
            "route_name":  "Express Route",
            "waypoints":   _path_to_waypoints(path3),
            "distance_km": round(dist3, 0),
            "eta_days":    _eta_days(dist3) * 0.9,  # 10% faster (higher speed)
            "cost_delta":  cost_d3,
            "risk_delta":  risk_d3,
            "carrier":     carriers[2] if len(carriers) > 2 else carriers[-1],
            "color":       "#757575",   # grey dashed
            "dash_array":  "4 4",
        })
    except (nx.NetworkXNoPath, IndexError):
        logger.debug("Could not build alt-fast path %s→%s", origin, destination)

    if not options:
        return _fallback_options(origin, destination, current_carrier)

    return options


def _fallback_options(
    origin: str, destination: str, carrier: str
) -> list[dict[str, Any]]:
    """Single-option fallback when the graph has no path."""
    o = PORT_COORDS.get(origin, (0.0, 0.0))
    d = PORT_COORDS.get(destination, (0.0, 0.0))
    dist = _haversine_km(*o, *d) if o != (0.0, 0.0) else 5_000.0
    return [{
        "route_name":  "Direct Route",
        "waypoints":   [
            {"port": origin,      "lat": o[0], "lng": o[1]},
            {"port": destination, "lat": d[0], "lng": d[1]},
        ],
        "distance_km": round(dist, 0),
        "eta_days":    _eta_days(dist),
        "cost_delta":  0,
        "risk_delta":  0,
        "carrier":     carrier,
        "color":       "#1565C0",
        "dash_array":  None,
    }]
