"""
NexusFlow — Isolation Forest Anomaly Detector
===============================================
Detects anomalous port congestion readings using sklearn's IsolationForest.

Design:
  - One mini-model per port, fitted lazily on a rolling window of readings.
  - Readings are stored in Redis as a capped list (key: anomaly:history:{port_name}).
  - Once a port has >= MIN_SAMPLES readings, the detector fits an IsolationForest
    and classifies each new reading as NORMAL or ANOMALY.
  - Results are logged and can be used to trigger higher-priority re-scoring.

Typical use (inside Faust process_port agent):
    from app.services.anomaly_detector import AnomalyDetector
    detector = AnomalyDetector()
    is_anomaly = await detector.check(redis, port_name, new_congestion_score)
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Minimum number of historical readings before we fit the model
MIN_SAMPLES = 10
# Number of past readings to keep (rolling window)
WINDOW_SIZE = 50
# IsolationForest contamination assumption (fraction of expected anomalies)
CONTAMINATION = 0.1


class AnomalyDetector:
    """
    Lightweight port-level anomaly detector using IsolationForest.
    Fits a new model per port each time check() is called (fast for small windows).
    """

    async def check(self, redis: Any, port_name: str, congestion_score: float) -> bool:
        """
        Record *congestion_score* for *port_name* and return True if it is anomalous.
        Returns False (non-anomalous) if there is insufficient history.
        """
        history_key = f"anomaly:history:{port_name}"

        try:
            # Append new reading and trim to window
            await redis.rpush(history_key, congestion_score)
            await redis.ltrim(history_key, -WINDOW_SIZE, -1)

            raw_history = await redis.lrange(history_key, 0, -1)
            history = [float(v) for v in raw_history]

        except Exception as exc:
            logger.error("AnomalyDetector Redis error for '%s': %s", port_name, exc)
            return False

        if len(history) < MIN_SAMPLES:
            logger.debug(
                "AnomalyDetector: not enough history for '%s' (%d/%d). Skipping.",
                port_name, len(history), MIN_SAMPLES,
            )
            return False

        try:
            from sklearn.ensemble import IsolationForest
            import numpy as np

            X = np.array(history[:-1]).reshape(-1, 1)     # all past readings
            x_new = np.array([[history[-1]]])              # current reading

            model = IsolationForest(
                n_estimators=50,
                contamination=CONTAMINATION,
                random_state=42,
                n_jobs=1,
            )
            model.fit(X)

            # predict returns -1 (anomaly) or +1 (normal)
            prediction = model.predict(x_new)[0]
            score      = float(model.decision_function(x_new)[0])
            is_anomaly = prediction == -1

            if is_anomaly:
                logger.warning(
                    "🚨 ANOMALY detected at port '%s': congestion=%.4f "
                    "(decision_score=%.4f, history_len=%d)",
                    port_name, congestion_score, score, len(history),
                )
                # Persist the anomaly event in Redis for dashboards / auditing
                await self._record_anomaly(redis, port_name, congestion_score, score)
            else:
                logger.debug(
                    "AnomalyDetector: port '%s' congestion=%.4f is NORMAL (score=%.4f).",
                    port_name, congestion_score, score,
                )

            return is_anomaly

        except ImportError:
            logger.warning("sklearn not available — anomaly detection skipped.")
            return False
        except Exception as exc:
            logger.error("IsolationForest error for '%s': %s", port_name, exc)
            return False

    async def _record_anomaly(
        self,
        redis: Any,
        port_name: str,
        congestion_score: float,
        decision_score: float,
    ) -> None:
        """Write the anomaly event to Redis for later retrieval / alerting."""
        try:
            import time
            event = {
                "port":           port_name,
                "congestion":     round(congestion_score, 4),
                "decision_score": round(decision_score, 4),
                "timestamp":      int(time.time()),
            }
            # Keep last 100 anomaly events in a list
            await redis.rpush("anomaly:events", json.dumps(event))
            await redis.ltrim("anomaly:events", -100, -1)
        except Exception as exc:
            logger.error("Could not persist anomaly event: %s", exc)
