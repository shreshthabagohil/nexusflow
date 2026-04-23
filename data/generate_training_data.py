"""Generate data/training_data.csv with 10000 synthetic labelled rows."""
import json
import random
import sys
from pathlib import Path

import pandas as pd

# Allow `from ml.feature_engineer import ...` when run from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.feature_engineer import FeatureEngineer

DATA_DIR = Path(__file__).resolve().parent

with open(DATA_DIR / "shipments.json") as f:
    shipments = json.load(f)
with open(DATA_DIR / "ports.json") as f:
    ports = json.load(f)
with open(DATA_DIR / "carriers.json") as f:
    carriers = json.load(f)

random.seed(42)

fe = FeatureEngineer(ports_data=ports, carriers_data=carriers)

rows = []
for _ in range(10_000):
    shipment = random.choice(shipments)
    weather_severity = random.random()

    features = fe.extract(shipment, weather_severity=weather_severity)

    # Synthetic label
    label = int(
        features["weather_severity"] > 0.6
        or features["origin_congestion"] > 0.7
        or features["days_until_eta"] < 3
    )
    # 10 % noise
    if random.random() < 0.10:
        label = 1 - label

    rows.append({**features, "risk_label": label})

df = pd.DataFrame(rows, columns=[
    "weather_severity",
    "origin_congestion",
    "dest_congestion",
    "carrier_ontime_rate",
    "cargo_priority_weight",
    "days_until_eta",
    "route_distance_km",
    "risk_label",
])
df.to_csv(DATA_DIR / "training_data.csv", index=False)
print("Generated 10000 training rows")
