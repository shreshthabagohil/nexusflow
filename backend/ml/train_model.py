#!/usr/bin/env python3
"""
NexusFlow — XGBoost Risk Model Training Script
===============================================
Trains a binary classifier (disruption_occurred = 0/1) on synthetic
supply-chain data whose feature scales EXACTLY match what FeatureEngineer
produces at runtime.

Run once inside the backend container (volume-mounted, so the pkl
is written to your host machine too):

    docker compose exec backend python ml/train_model.py

Output:
    /app/ml/risk_scorer.pkl   — trained XGBoost model
    /app/ml/model_meta.json   — feature names, AUC, threshold

Designed to be idempotent: re-running overwrites the previous model.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
ML_DIR   = Path(__file__).resolve().parent          # backend/ml/
ROOT_DIR = ML_DIR.parent                            # backend/
DATA_DIR = ROOT_DIR.parent / "data"                # nexusflow/data/

MODEL_PATH = ML_DIR / "risk_scorer.pkl"
META_PATH  = ML_DIR / "model_meta.json"

# ─── Feature columns (must match FeatureEngineer output order) ────────────────
FEATURE_COLS = [
    "weather_severity",       # float  0.0 – 1.0
    "origin_congestion",      # float  0.0 – 1.0
    "dest_congestion",        # float  0.0 – 1.0
    "carrier_ontime_rate",    # float  0.55 – 0.99
    "cargo_priority_weight",  # int    3 / 5 / 6 / 7 / 8 / 10
    "days_until_eta",         # float  0 – 60
    "route_distance_km",      # float  300 – 15 000
]
TARGET_COL = "disruption_occurred"


def _generate_data(n: int = 12_000, seed: int = 42) -> tuple:
    """
    Generate synthetic labelled rows whose feature scales match the
    live FeatureEngineer output (0-1 for weather/congestion, etc.).

    Disruption label is deterministic + 8% noise.
    """
    rng = random.Random(seed)

    # cargo_priority_weight values actually used by FeatureEngineer
    cargo_weights = [3, 5, 6, 7, 8, 10]

    X, y = [], []
    for _ in range(n):
        ws  = rng.uniform(0.0, 1.0)    # weather_severity
        oc  = rng.uniform(0.0, 1.0)    # origin_congestion
        dc  = rng.uniform(0.0, 1.0)    # dest_congestion
        cor = rng.uniform(0.55, 0.99)  # carrier_ontime_rate
        cpw = rng.choice(cargo_weights)
        dte = rng.uniform(0.0, 60.0)   # days_until_eta
        rdk = rng.uniform(300.0, 15_000.0)  # route_distance_km

        # Deterministic disruption rules (matching business logic)
        disrupted = (
            ws  > 0.70                           # severe weather
            or oc  > 0.80                        # origin port heavily congested
            or dc  > 0.80                        # dest port heavily congested
            or cor < 0.65                        # unreliable carrier
            or (ws > 0.50 and dte < 3.0)         # bad weather + tight deadline
            or (cpw >= 8 and (oc > 0.65 or ws > 0.55))  # high-value cargo + risk
        )
        label = int(disrupted)

        # 8% random label noise (realistic real-world ambiguity)
        if rng.random() < 0.08:
            label = 1 - label

        X.append([ws, oc, dc, cor, cpw, dte, rdk])
        y.append(label)

    return X, y


def main() -> None:
    print("=" * 60)
    print("NexusFlow XGBoost Risk Model Trainer")
    print("=" * 60)

    # ── 1. Imports ────────────────────────────────────────────────────────────
    try:
        import numpy as np
        import pandas as pd
        import xgboost as xgb
        import shap
        import joblib
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import (
            roc_auc_score, accuracy_score, classification_report
        )
    except ImportError as exc:
        print(f"\n❌  Missing dependency: {exc}")
        print("    Run: pip install xgboost scikit-learn shap pandas numpy joblib")
        sys.exit(1)

    # ── 2. Generate training data ─────────────────────────────────────────────
    print("\n[1/5] Generating synthetic training data (12 000 rows)…")
    X_raw, y_raw = _generate_data(n=12_000)
    X = np.array(X_raw, dtype=np.float32)
    y = np.array(y_raw, dtype=np.int32)
    df = pd.DataFrame(X, columns=FEATURE_COLS)
    df[TARGET_COL] = y

    disruption_rate = y.mean() * 100
    print(f"    Disruption rate: {disruption_rate:.1f}%")
    print(f"    Feature ranges:")
    for col in FEATURE_COLS:
        print(f"      {col:<28} [{df[col].min():.3f} – {df[col].max():.3f}]")

    # ── 3. Train / test split ─────────────────────────────────────────────────
    print("\n[2/5] Splitting data (80/20 train/test)…")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"    Train: {len(X_train)} rows   Test: {len(X_test)} rows")

    # ── 4. Train XGBoost ──────────────────────────────────────────────────────
    print("\n[3/5] Training XGBoost classifier…")
    scale_pos_weight = float((y == 0).sum()) / max(1, float((y == 1).sum()))

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        use_label_encoder=False,
        eval_metric="auc",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    print("    Training complete.")

    # ── 5. Evaluate ───────────────────────────────────────────────────────────
    print("\n[4/5] Evaluating on test set…")
    y_prob  = model.predict_proba(X_test)[:, 1]
    y_pred  = model.predict(X_test)
    auc     = roc_auc_score(y_test, y_prob)
    acc     = accuracy_score(y_test, y_pred)

    print(f"    AUC:      {auc:.4f}  {'✅ PASS (>0.80)' if auc >= 0.80 else '⚠️  BELOW TARGET'}")
    print(f"    Accuracy: {acc:.4f}")
    print("\n    Classification report:")
    for line in classification_report(y_test, y_pred).split("\n"):
        print(f"      {line}")

    # ── 6. SHAP feature importance ────────────────────────────────────────────
    print("[4/5] Computing SHAP feature importance…")
    try:
        explainer     = shap.TreeExplainer(model)
        shap_values   = explainer.shap_values(X_test[:500])
        mean_abs_shap = abs(shap_values).mean(axis=0)
        importance    = sorted(
            zip(FEATURE_COLS, mean_abs_shap.tolist()),
            key=lambda t: t[1], reverse=True
        )
        print("    SHAP feature importance (mean |SHAP|):")
        for feat, imp in importance:
            bar = "█" * int(imp * 200)
            print(f"      {feat:<28} {imp:.4f}  {bar}")
    except Exception as exc:
        print(f"    ⚠️  SHAP skipped: {exc}")
        importance = [(col, 0.0) for col in FEATURE_COLS]

    # ── 7. Save model ─────────────────────────────────────────────────────────
    print("\n[5/5] Saving model…")
    ML_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, MODEL_PATH)
    print(f"    ✅  Model saved to {MODEL_PATH}")

    meta = {
        "feature_cols":        FEATURE_COLS,
        "auc":                 round(auc, 4),
        "accuracy":            round(acc, 4),
        "disruption_rate_pct": round(disruption_rate, 1),
        "n_estimators":        model.n_estimators,
        "shap_importance":     {k: round(v, 4) for k, v in importance},
        "feature_ranges": {
            "weather_severity":      [0.0, 1.0],
            "origin_congestion":     [0.0, 1.0],
            "dest_congestion":       [0.0, 1.0],
            "carrier_ontime_rate":   [0.55, 0.99],
            "cargo_priority_weight": [3, 10],
            "days_until_eta":        [0.0, 60.0],
            "route_distance_km":     [300.0, 15000.0],
        },
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"    ✅  Metadata saved to {META_PATH}")

    print("\n" + "=" * 60)
    print("🎉  Training complete!")
    print(f"    AUC = {auc:.4f} | Accuracy = {acc:.4f}")
    print(f"    Model: {MODEL_PATH}")
    print("=" * 60)
    print("\nNext step: docker compose restart backend")


if __name__ == "__main__":
    main()
