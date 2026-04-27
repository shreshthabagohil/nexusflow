#!/usr/bin/env python3
"""
NexusFlow Kafka Consumer Worker

Replaces faust-streaming (incompatible with aiokafka on Python 3.11) with a
direct kafka-python consumer that does exactly the same job:

  Kafka topics → Redis keys → Isolation Forest anomaly detection

Topics consumed:
  weather-events   → { "port_id": str, "severity": float }
  port-congestion  → { "port_id": str, "congestion_score": float }
  carrier-events   → { "carrier": str, "ontime_rate": float }

Redis keys written:
  weather:{port_id}              → severity   (float 0-1)
  congestion:{port_id}           → score      (float 0-1)
  anomaly:{port_id}              → "1"        (TTL 3600s, set on anomaly)
  carrier:{carrier}:ontime_rate  → rate       (float 0-1)

Run (inside the backend container, working_dir /app):
  python run_consumer.py
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time

import redis as redis_sync
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable, KafkaError

# ── Add /app to sys.path so `app.*` imports resolve ─────────────────────────
sys.path.insert(0, "/app")
from app.services.anomaly_detector import AnomalyDetector

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
)
logger = logging.getLogger("nexusflow.consumer")

# ─── Configuration ────────────────────────────────────────────────────────────
# KAFKA_BOOTSTRAP_SERVERS uses plain host:port (kafka-python format)
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
REDIS_URL       = os.getenv("REDIS_URL", "redis://redis:6379/0")
CONSUMER_GROUP  = "nexusflow-processors"
TOPICS          = ["weather-events", "port-congestion", "carrier-events"]
MAX_RETRIES     = 30
RETRY_DELAY_S   = 5


# ─── Kafka connection with retry ──────────────────────────────────────────────

def _connect_kafka() -> KafkaConsumer:
    """Attempt to connect to Kafka, retrying up to MAX_RETRIES times."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            consumer = KafkaConsumer(
                *TOPICS,
                bootstrap_servers=KAFKA_BOOTSTRAP,
                group_id=CONSUMER_GROUP,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
                consumer_timeout_ms=2000,   # poll() returns after 2 s if no messages
                session_timeout_ms=30_000,
                heartbeat_interval_ms=10_000,
            )
            logger.info("Connected to Kafka at %s", KAFKA_BOOTSTRAP)
            return consumer
        except (NoBrokersAvailable, KafkaError) as exc:
            logger.warning(
                "Kafka not ready (attempt %d/%d): %s. Retrying in %ds…",
                attempt, MAX_RETRIES, exc, RETRY_DELAY_S,
            )
            time.sleep(RETRY_DELAY_S)
    raise RuntimeError(
        f"Could not connect to Kafka at {KAFKA_BOOTSTRAP} after {MAX_RETRIES} attempts."
    )


# ─── Event processors ─────────────────────────────────────────────────────────

def _process_weather(event: dict, r: redis_sync.Redis) -> None:
    port_id  = str(event.get("port_id") or event.get("route_segment_id") or "")
    severity = max(0.0, min(1.0, float(event.get("severity", 0.3))))
    if port_id:
        r.set(f"weather:{port_id}", severity)
        logger.debug("Weather updated — %s: %.3f", port_id, severity)


def _process_congestion(
    event: dict,
    r: redis_sync.Redis,
    detector: AnomalyDetector,
) -> None:
    port_id = str(event.get("port_id") or "")
    score   = max(0.0, min(1.0, float(event.get("congestion_score", 0.5))))
    if not port_id:
        return

    # 1. Always update live congestion reading
    r.set(f"congestion:{port_id}", score)
    logger.debug("Congestion updated — %s: %.3f", port_id, score)

    # 2. Isolation Forest anomaly detection
    result = detector.detect(congestion=score)
    if result["is_anomaly"]:
        r.setex(f"anomaly:{port_id}", 3600, "1")   # TTL = 1 hour
        logger.warning(
            "⚠ ANOMALY at port %s — congestion=%.3f — %s",
            port_id, score, result["reasons"],
        )
    else:
        r.delete(f"anomaly:{port_id}")


def _process_carrier(event: dict, r: redis_sync.Redis) -> None:
    carrier = str(event.get("carrier") or event.get("carrier_id") or "")
    rate    = max(0.0, min(1.0, float(event.get("ontime_rate", 0.85))))
    if carrier:
        r.set(f"carrier:{carrier}:ontime_rate", rate)
        logger.debug("Carrier rate updated — %s: %.3f", carrier, rate)


# ─── Main loop ────────────────────────────────────────────────────────────────

def main() -> None:
    logger.info("NexusFlow Consumer Worker starting…")

    # Isolation Forest — trained once at startup, reused for every event
    detector = AnomalyDetector()
    logger.info("AnomalyDetector: Isolation Forest ready.")

    # Redis — synchronous client (kafka-python is sync; matches perfectly)
    r = redis_sync.from_url(REDIS_URL, decode_responses=True)
    r.ping()   # fail fast if Redis is unreachable
    logger.info("Connected to Redis: %s", REDIS_URL)

    # Kafka consumer
    consumer = _connect_kafka()

    # Graceful shutdown on SIGTERM / SIGINT
    running = True

    def _shutdown(signum: int, _frame: object) -> None:
        nonlocal running
        logger.info("Signal %d received — shutting down…", signum)
        running = False

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    logger.info("Consumer Worker ready — subscribed to %s", TOPICS)

    while running:
        try:
            records = consumer.poll(timeout_ms=1000)
            for tp, messages in records.items():
                topic = tp.topic
                for msg in messages:
                    event = msg.value
                    try:
                        if topic == "weather-events":
                            _process_weather(event, r)
                        elif topic == "port-congestion":
                            _process_congestion(event, r, detector)
                        elif topic == "carrier-events":
                            _process_carrier(event, r)
                    except Exception as exc:
                        logger.error(
                            "Error processing %s event: %s | event=%s",
                            topic, exc, event,
                        )
        except Exception as exc:
            logger.error("Consumer poll error: %s — will retry", exc)
            time.sleep(1)

    consumer.close()
    logger.info("Consumer Worker stopped cleanly.")


if __name__ == "__main__":
    main()
