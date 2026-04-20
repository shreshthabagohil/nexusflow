# ml/

**Owner: T3**

This folder contains all machine learning assets for NexusFlow's risk-scoring pipeline.

## Contents

| Path | Description |
|------|-------------|
| `train_model.py` | Model training script — generated on Day 3 |
| `risk_scorer.pkl` | Serialised scikit-learn model — generated on Day 3 |
| `features.json` | Canonical feature list consumed by the scorer |
| `models/` | Versioned model artefacts subfolder |

## Notes

- `risk_scorer.pkl` is regenerated each training run; do **not** commit `.pkl` files larger than 50 MB.
- Add `*.pkl` files above the size limit to `.gitignore` before pushing.
