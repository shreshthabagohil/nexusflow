from typing import Any
from pydantic import BaseModel, Field


class Shipment(BaseModel):
    id: str
    origin_port: str
    destination_port: str
    carrier: str
    # Optional so old Redis entries without these fields still deserialise cleanly.
    # FeatureEngineer falls back to carrier-based defaults when cargo_type is absent.
    cargo_type: str = ""
    departure_date: str = ""
    eta: str
    current_lat: float
    current_lng: float
    status: str = "in_transit"
    risk_score: float = 0.0
    top_risk_factors: list[Any] = Field(default_factory=list)


class PortStatus(BaseModel):
    port_id: str
    name: str
    congestion_score: float
    lat: float
    lng: float


class WeatherEvent(BaseModel):
    route_segment_id: str
    severity: float
    weather_type: str
    timestamp: str


class RiskScoreResponse(BaseModel):
    shipment_id: str
    score: int
    top_risk_factors: list[dict]


class RouteOption(BaseModel):
    shipment_id: str
    route_id: str
    description: str
    estimated_time_hours: float
    cost_delta_usd: float
    risk_reduction: float


class FeatureVector(BaseModel):
    weather_severity: float
    origin_congestion: float
    dest_congestion: float
    carrier_ontime_rate: float
    cargo_priority_weight: int
    days_until_eta: float
    route_distance_km: float
