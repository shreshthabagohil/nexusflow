"""
NexusFlow — RiskScorer
======================
Loads the trained XGBoost model and provides:

  score(feature_vector)  → int 0-100   (ML risk score)
  explain(feature_vector) → list[dict]  (top-3 SHAP risk factors)

Designed for use in:
  - FastAPI startup (bulk-score all seeded shipments)
  - Per-request scoring when feature vectors are computed

Lazy singleton: the model loads once on first call to get_scorer().
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

ML_DIR     = Path(__file__).resolve().parent
MODEL_PATH = ML_DIR / "risk_scorer.pkl"
META_PATH  = ML_DIR / "model_meta.json"

FEATURE_COLS = [
    "weather_severity",
    "origin_congestion",
    "dest_congestion",
    "carrier_ontime_rate",
    "cargo_priority_weight",
    "days_until_eta",
    "route_distance_km",
]

# Human-readable labels for SHAP explanations shown in the UI
FEATURE_LABELS: dict[str, str] = {
    "weather_severity":      "Severe weather on route",
    "origin_congestion":     "Origin port congestion",
    "dest_congestion":       "Destination port congestion",
    "carrier_ontime_rate":   "Carrier reliability",
    "cargo_priority_weight": "High-priority cargo",
    "days_until_eta":        "Tight delivery window",
    "route_distance_km":     "Long route distance",
}


class RiskScorer:
    """Wraps an XGBoost model to score supply-chain disruption risk."""

    def __init__(self) -> None:
        import joblib
        import shap

        self._model    = joblib.load(MODEL_PATH)
        self._explainer = shap.TreeExplainer(self._model)

        meta = json.loads(META_PATH.read_text()) if META_PATH.exists() else {}
        self.auc      = meta.get("auc", 0.0)
        self.accuracy = meta.get("accuracy", 0.0)
        logger.info(
            "RiskScorer loaded — AUC=%.4f  Accuracy=%.4f",
            self.auc, self.accuracy,
        )

    def _to_array(self, fv: Any) -> "list[float]":
        """Convert a FeatureVector (or dict) to a flat list in FEATURE_COLS order."""
        if hasattr(fv, "__dict__"):
            d = fv.__dict__
        elif hasattr(fv, "model_dump"):
            d = fv.model_dump()
        elif isinstance(fv, dict):
            d = fv
        else:
            raise ValueError(f"Cannot convert {type(fv)} to feature array")
        return [float(d[col]) for col in FEATURE_COLS]

    def score(self, feature_vector: Any) -> int:
        """
        Return a disruption risk score in [0, 100].
        Higher = more likely to be disrupted.
        """
        import numpy as np
        x = np.array([self._to_array(feature_vector)], dtype=np.float32)
        prob = float(self._model.predict_proba(x)[0, 1])
        return min(100, max(0, round(prob * 100)))

    def explain(self, feature_vector: Any, top_n: int = 3) -> list[dict[str, Any]]:
        """
        Return the top-N risk factors driving this prediction.
        Each entry: {"factor": str, "contribution": float, "direction": "increase"|"decrease"}
        """
        try:
            import numpy as np
            x          = np.array([self._to_array(feature_vector)], dtype=np.float32)
            shap_vals  = self._explainer.shap_values(x)[0]   # shape: (n_features,)
            pairs = sorted(
                zip(FEATURE_COLS, shap_vals.tolist()),
                key=lambda t: abs(t[1]),
                reverse=True,
            )
            results = []
            for col, val in pairs[:top_n]:
                results.append({
                    "factor":       FEATURE_LABELS.get(col, col),
                    "feature":      col,
                    "contribution": round(float(val), 4),
                    "direction":    "increase" if val > 0 else "decrease",
                })
            return results
        except Exception as exc:
            logger.warning("SHAP explain failed: %s", exc)
            return []

    def is_loaded(self) -> bool:
        return self._model is not None


# ── Lazy singleton ─────────────────────────────────────────────────────────────

_scorer: RiskScorer | None = None


def get_scorer() -> RiskScorer | None:
    """
    Return the singleton RiskScorer, loading it on first call.
    Returns None if the model file doesn't exist yet (train_model.py not run).
    """
    global _scorer
    if _scorer is not None:
        return _scorer

    if not MODEL_PATH.exists():
        logger.warning(
            "ML model not found at %s. "
            "Run: docker compose exec backend python ml/train_model.py",
            MODEL_PATH,
        )
        return None

    try:
        _scorer = RiskScorer()
        return _scorer
    except Exception as exc:
        logger.error("Failed to load RiskScorer: %s", exc)
        return None
