"""
Unit tests for AnomalyDetector.

Covers:
  - detect() with high / normal / low congestion
  - detect() with weather and carrier_ontime dimensions
  - detect() with multiple flags simultaneously
  - is_anomalous() single-value path
  - Edge values: exactly at threshold, 0.0, 1.0
"""

import pytest

from app.services.anomaly_detector import AnomalyDetector


@pytest.fixture(scope="module")
def detector() -> AnomalyDetector:
    """Shared detector instance — Isolation Forest trained once."""
    return AnomalyDetector()


# ── detect() — congestion dimension ──────────────────────────────────────────

class TestDetectCongestion:
    def test_high_congestion_is_anomaly(self, detector):
        result = detector.detect(congestion=0.92)
        assert result["is_anomaly"] is True
        assert result["flags"]["congestion_anomaly"] is True
        assert any("congestion" in r for r in result["reasons"])

    def test_normal_congestion_not_anomaly(self, detector):
        result = detector.detect(congestion=0.50)
        assert result["is_anomaly"] is False
        assert result["flags"]["congestion_anomaly"] is False
        assert result["reasons"] == []

    def test_congestion_exactly_at_threshold_is_anomaly(self, detector):
        # 0.85 is the threshold — values >= threshold are anomalous
        result = detector.detect(congestion=0.85)
        assert result["is_anomaly"] is True
        assert result["flags"]["congestion_anomaly"] is True

    def test_congestion_just_below_threshold_not_anomaly(self, detector):
        result = detector.detect(congestion=0.84)
        assert result["is_anomaly"] is False

    def test_zero_congestion_not_anomaly(self, detector):
        result = detector.detect(congestion=0.0)
        assert result["is_anomaly"] is False

    def test_max_congestion_is_anomaly(self, detector):
        result = detector.detect(congestion=1.0)
        assert result["is_anomaly"] is True


# ── detect() — weather dimension ─────────────────────────────────────────────

class TestDetectWeather:
    def test_severe_weather_is_anomaly(self, detector):
        result = detector.detect(weather=0.90)
        assert result["is_anomaly"] is True
        assert result["flags"]["weather_anomaly"] is True

    def test_mild_weather_not_anomaly(self, detector):
        result = detector.detect(weather=0.40)
        assert result["is_anomaly"] is False
        assert result["flags"]["weather_anomaly"] is False

    def test_weather_at_threshold_is_anomaly(self, detector):
        result = detector.detect(weather=0.80)
        assert result["is_anomaly"] is True

    def test_weather_just_below_threshold_not_anomaly(self, detector):
        result = detector.detect(weather=0.79)
        assert result["is_anomaly"] is False


# ── detect() — carrier_ontime dimension ──────────────────────────────────────

class TestDetectCarrier:
    def test_low_ontime_rate_is_anomaly(self, detector):
        result = detector.detect(carrier_ontime=0.30)
        assert result["is_anomaly"] is True
        assert result["flags"]["carrier_anomaly"] is True

    def test_high_ontime_rate_not_anomaly(self, detector):
        result = detector.detect(carrier_ontime=0.90)
        assert result["is_anomaly"] is False
        assert result["flags"]["carrier_anomaly"] is False

    def test_carrier_exactly_at_boundary_not_anomaly(self, detector):
        # < 0.50 is anomalous; exactly 0.50 is NOT
        result = detector.detect(carrier_ontime=0.50)
        assert result["is_anomaly"] is False

    def test_carrier_just_below_boundary_is_anomaly(self, detector):
        result = detector.detect(carrier_ontime=0.49)
        assert result["is_anomaly"] is True


# ── detect() — multiple dimensions ───────────────────────────────────────────

class TestDetectMultiple:
    def test_all_normal_no_anomaly(self, detector):
        result = detector.detect(congestion=0.50, weather=0.30, carrier_ontime=0.85)
        assert result["is_anomaly"] is False
        assert all(not v for v in result["flags"].values())

    def test_one_bad_dimension_triggers_anomaly(self, detector):
        result = detector.detect(congestion=0.90, weather=0.30, carrier_ontime=0.85)
        assert result["is_anomaly"] is True
        assert result["flags"]["congestion_anomaly"] is True
        assert result["flags"]["weather_anomaly"] is False
        assert result["flags"]["carrier_anomaly"] is False

    def test_multiple_bad_dimensions(self, detector):
        result = detector.detect(congestion=0.90, weather=0.90, carrier_ontime=0.20)
        assert result["is_anomaly"] is True
        assert result["flags"]["congestion_anomaly"] is True
        assert result["flags"]["weather_anomaly"] is True
        assert result["flags"]["carrier_anomaly"] is True
        assert len(result["reasons"]) == 3

    def test_no_args_returns_no_anomaly(self, detector):
        result = detector.detect()
        assert result["is_anomaly"] is False
        assert result["flags"] == {}
        assert result["reasons"] == []


# ── is_anomalous() — single-value path ───────────────────────────────────────

class TestIsAnomalous:
    def test_extreme_high_value(self, detector):
        assert detector.is_anomalous(9.9) is True

    def test_normal_range_value(self, detector):
        assert detector.is_anomalous(3.0) is False

    def test_zero_not_anomalous(self, detector):
        assert detector.is_anomalous(0.0) is False

    def test_at_threshold(self, detector):
        assert detector.is_anomalous(AnomalyDetector.ANOMALY_THRESHOLD) is True
