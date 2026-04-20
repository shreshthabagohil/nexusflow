# data/

This directory contains synthetic JSON datasets generated on **Day 2** for local development and testing.

## Files

| File | Records | Description |
|------|---------|-------------|
| `shipments.json` | 500 | Synthetic shipment records with routes, statuses, and timestamps |
| `ports.json` | 50 | Port metadata including location, capacity, and congestion scores |
| `carriers.json` | 10 | Carrier profiles with on-time rates and delay statistics |
| `shipping_graph.json` | 200-node graph | Weighted adjacency graph of shipping lanes between ports |
| `training_data.csv` | 10 000 rows | Feature-label dataset for model training — generated on Day 3 |

## Generation

All JSON files are produced by `generate_synthetic_data.py` in this directory.
`training_data.csv` is produced by `ml/train_model.py` as a preprocessing step.
