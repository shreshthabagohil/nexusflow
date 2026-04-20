import json
import logging
import os
from datetime import datetime, timezone

from kafka import KafkaProducer as _KafkaProducer
from kafka.errors import KafkaError

logger = logging.getLogger(__name__)


class KafkaProducer:
    def __init__(self, bootstrap_servers: str = "localhost:9092"):
        self._producer = _KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )

    def _publish(self, topic: str, payload: dict) -> None:
        try:
            self._producer.send(topic, value=payload)
            self._producer.flush()
        except KafkaError as exc:
            logger.error("Failed to publish to topic '%s': %s", topic, exc)

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def send_weather_event(
        self, route_segment_id: str, severity: str, weather_type: str
    ) -> None:
        self._publish(
            "weather-events",
            {
                "route_segment_id": route_segment_id,
                "severity": severity,
                "weather_type": weather_type,
                "timestamp": self._now_iso(),
            },
        )

    def send_port_status(
        self, port_id: str, name: str, congestion_score: float
    ) -> None:
        self._publish(
            "port-status",
            {
                "port_id": port_id,
                "name": name,
                "congestion_score": congestion_score,
                "timestamp": self._now_iso(),
            },
        )

    def send_carrier_delay(self, carrier_id: str, ontime_rate: float) -> None:
        self._publish(
            "carrier-delays",
            {
                "carrier_id": carrier_id,
                "ontime_rate": ontime_rate,
                "timestamp": self._now_iso(),
            },
        )

    def send_shipment_update(
        self, shipment_id: str, lat: float, lng: float, status: str
    ) -> None:
        self._publish(
            "shipment-updates",
            {
                "shipment_id": shipment_id,
                "lat": lat,
                "lng": lng,
                "status": status,
                "timestamp": self._now_iso(),
            },
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    bootstrap = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    producer = KafkaProducer(bootstrap_servers=bootstrap)

    producer.send_weather_event(
        route_segment_id="SEG-001", severity="high", weather_type="typhoon"
    )
    print("Sent weather event")

    producer.send_port_status(
        port_id="PORT-SHA", name="Shanghai", congestion_score=0.87
    )
    print("Sent port status")

    producer.send_carrier_delay(carrier_id="CARRIER-001", ontime_rate=0.72)
    print("Sent carrier delay")

    producer.send_shipment_update(
        shipment_id="SHIP-0001", lat=31.2304, lng=121.4737, status="in_transit"
    )
    print("Sent shipment update")
