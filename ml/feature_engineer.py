import math
from datetime import date, datetime


class FeatureEngineer:
    CARGO_PRIORITY = {
        "pharmaceuticals": 5,
        "perishables": 4,
        "electronics": 3,
        "chemicals": 3,
        "automotive": 2,
        "machinery": 2,
        "general": 1,
        "textiles": 1,
    }

    def __init__(self, ports_data: list, carriers_data: list):
        self._ports = {p["name"]: p for p in ports_data}
        self._carriers = {c["name"]: c for c in carriers_data}

    def extract(self, shipment, port_congestion_override=None, weather_severity: float = 0.0) -> dict:
        # Support both dict and object-style shipments
        def _get(obj, key):
            if isinstance(obj, dict):
                return obj.get(key)
            return getattr(obj, key, None)

        origin_port = _get(shipment, "origin_port")
        dest_port = _get(shipment, "destination_port")
        carrier_name = _get(shipment, "carrier")
        cargo_type = _get(shipment, "cargo_type")
        eta = _get(shipment, "eta")
        current_lat = _get(shipment, "current_lat")
        current_lng = _get(shipment, "current_lng")

        # origin_congestion
        if port_congestion_override is not None:
            origin_congestion = float(port_congestion_override)
        else:
            port = self._ports.get(origin_port)
            origin_congestion = port["congestion_score"] / 10.0 if port else 0.5

        # dest_congestion
        dest_port_data = self._ports.get(dest_port)
        dest_congestion = dest_port_data["congestion_score"] / 10.0 if dest_port_data else 0.5

        # carrier_ontime_rate
        carrier = self._carriers.get(carrier_name)
        carrier_ontime_rate = carrier["ontime_rate"] if carrier else 0.5

        # cargo_priority_weight
        cargo_priority_weight = self.CARGO_PRIORITY.get(cargo_type, 1)

        # days_until_eta
        try:
            eta_date = datetime.fromisoformat(eta).date() if eta else None
            days_until_eta = float(max((eta_date - date.today()).days, 0)) if eta_date else 5.0
        except (ValueError, TypeError):
            days_until_eta = 5.0

        # route_distance_km via haversine: current position → destination port
        try:
            dest_lat = dest_port_data["lat"]
            dest_lng = dest_port_data["lng"]
            route_distance_km = _haversine(
                float(current_lat), float(current_lng),
                float(dest_lat), float(dest_lng),
            )
        except (TypeError, KeyError):
            route_distance_km = 1000.0

        return {
            "weather_severity": float(weather_severity),
            "origin_congestion": origin_congestion,
            "dest_congestion": dest_congestion,
            "carrier_ontime_rate": carrier_ontime_rate,
            "cargo_priority_weight": cargo_priority_weight,
            "days_until_eta": days_until_eta,
            "route_distance_km": route_distance_km,
        }


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
