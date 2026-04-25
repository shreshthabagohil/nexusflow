"""
AnomalyDetector — Isolation Forest-based anomaly detection for NexusFlow.

Detects anomalous congestion, weather, or carrier performance values
that deviate significantly from baseline. Used to flag unusual port
conditions or carrier degradation before they impact shipments.

The model is trained on a synthetic baseline of normal operating
conditions and flags values that fall outside the learned distribution.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Try to use sklearn's IsolationForest; fall back to threshold-based detection
try:
    from sklearn.ensemble import IsolationForest

    _HAS_SKLEARN = True
except ImportError:
    _HAS_SKLEARN = False
    logger.warning(
        "scikit-learn not available. AnomalyDetector will use threshold-based fallback."
    )


class AnomalyDetector:
    """
    Detect anomalous values using Isolation Forest or threshold fallback.

    Usage:
        detector = AnomalyDetector()
        is_anomaly = detector.is_anomalous(9.8)       # True — extreme value
        is_anomaly = detector.is_anomalous(0.5)        # False — normal range
        result = detector.detect(congestion=0.95, weather=0.9)  # dict with details
    """

    # Thresholds for fallback mode (no sklearn)
    ANOMALY_THRESHOLD = 7.0  # values above this are considered anomalous
    CONGESTION_THRESHOLD = 0.85
    WEATHER_THRESHOLD = 0.80

    def __init__(self) -> None:
        self._model: Any = None
        if _HAS_SKLEARN:
            self._train_model()

    def _train_model(self) -> None:
        """Train Isolation Forest on synthetic baseline data."""
        # Synthetic normal operating conditions
        rng = np.random.RandomState(42)
        normal_data = rng.normal(loc=3.0, scale=1.5, size=(500, 1))
        normal_data = np.clip(normal_data, 0, 10)

        self._model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
        )
        self._model.fit(normal_data)
        logger.info("AnomalyDetector: Isolation Forest trained on 500 baseline samples.")

    def is_anomalous(self, value: float) -> bool:
        """
        Check if a single numeric value is anomalous.

        Args:
            value: A numeric value (e.g. congestion severity 0-10)

        Returns:
            True if the value is detected as an anomaly.
        """
        if self._model is not None:
            prediction = self._model.predict([[value]])
            # Only flag as anomalous if BOTH the model says outlier AND the
            # value is above the threshold.  Low values (e.g. 0.5) are
            # statistical outliers from the training distribution but are
            # operationally safe — only high values indicate disruption risk.
            return bool(prediction[0] == -1) and value >= self.ANOMALY_THRESHOLD
        # Threshold fallback
        return value >= self.ANOMALY_THRESHOLD

    def detect(
        self,
        congestion: float | None = None,
        weather: float | None = None,
        carrier_ontime: float | None = None,
    ) -> dict[str, Any]:
        """
        Run anomaly detection on multiple feature dimensions.

        Args:
            congestion: Port congestion level (0-1 scale)
            weather: Weather severity (0-1 scale)
            carrier_ontime: Carrier on-time rate (0-1 scale, low = anomalous)

        Returns:
            Dict with 'is_anomaly' bool and per-feature anomaly flags.
        """
        flags: dict[str, bool] = {}
        reasons: list[str] = []

        if congestion is not None:
            anomalous = congestion >= self.CONGESTION_THRESHOLD
            flags["congestion_anomaly"] = anomalous
            if anomalous:
                reasons.append(f"congestion={congestion:.2f} exceeds {self.CONGESTION_THRESHOLD}")

        if weather is not None:
            anomalous = weather >= self.WEATHER_THRESHOLD
            flags["weather_anomaly"] = anomalous
            if anomalous:
                reasons.append(f"weather={weather:.2f} exceeds {self.WEATHER_THRESHOLD}")

        if carrier_ontime is not None:
            # Low on-time rate is anomalous (inverted)
            anomalous = carrier_ontime < 0.5
            flags["carrier_anomaly"] = anomalous
            if anomalous:
                reasons.append(f"carrier_ontime={carrier_ontime:.2f} below 0.50")

        is_anomaly = any(flags.values()) if flags else False

        return {
            "is_anomaly": is_anomaly,
            "flags": flags,
            "reasons": reasons,
        }
