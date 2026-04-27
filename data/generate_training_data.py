#!/usr/bin/env python3
"""Generate data/training_data.csv with 10,000 synthetic labelled rows for XGBoost."""

import csv
import random
from pathlib import Path

OUTPUT_PATH = Path(__file__).resolve().parent / "training_data.csv"

COLUMNS = [
    "weather_severity",
    "origin_congestion",
    "dest_congestion",
    "carrier_ontime_rate",
    "cargo_priority_weight",
    "days_until_eta",
    "route_distance_km",
    "disruption_occurred",
]

random.seed(42)

rows = []
for _ in range(10_000):
    weather_severity      = random.uniform(1, 10)
    origin_congestion     = random.uniform(1, 10)
    dest_congestion       = random.uniform(1, 10)
    carrier_ontime_rate   = random.uniform(0.55, 0.99)
    cargo_priority_weight = random.randint(1, 5)
    days_until_eta        = random.uniform(1, 30)
    route_distance_km     = random.uniform(500, 15_000)

    disrupted = (
        weather_severity > 7.0
        or origin_congestion > 8.0
        or dest_congestion > 8.0
        or carrier_ontime_rate < 0.65
        or (weather_severity > 5.0 and days_until_eta < 3)
    )
    label = int(disrupted)

    # 10% random noise: flip the label
    if random.random() < 0.10:
        label = 1 - label

    rows.append([
        round(weather_severity, 4),
        round(origin_congestion, 4),
        round(dest_congestion, 4),
        round(carrier_ontime_rate, 4),
        cargo_priority_weight,
        round(days_until_eta, 4),
        round(route_distance_km, 4),
        label,
    ])

with open(OUTPUT_PATH, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(COLUMNS)
    writer.writerows(rows)

disruption_rate = sum(r[-1] for r in rows) / len(rows) * 100
print(f"Generated 10000 training rows. Disruption rate: {disruption_rate:.1f}%")
