import json
import random
import asyncio
from typing import List, Dict
import redis.asyncio as redis


# 🔹 Get single ship
async def get_ship(r, ship_id: str) -> Dict:
    data = await r.get(f"ship:{ship_id}")
    return json.loads(data) if data else None


# 🔹 Set ship with TTL
async def set_ship(r, ship_id: str, data: Dict, ttl: int = 300):
    await r.set(f"ship:{ship_id}", json.dumps(data), ex=ttl)


# 🔹 Get all ships with pagination + filter
async def get_all_ships(r, min_risk=0, page=1, limit=20) -> List[Dict]:
    keys = await r.keys("ship:*")

    ships = []
    for key in keys:
        data = await r.get(key)
        if data:
            ship = json.loads(data)
            if ship["risk_score"] >= min_risk:
                ships.append(ship)

    # pagination
    start = (page - 1) * limit
    end = start + limit
    return ships[start:end]


# 🔹 Pipeline batch fetch
async def pipeline_get_ships(r, ids: List[str]) -> List[Dict]:
    pipe = r.pipeline()
    for ship_id in ids:
        pipe.get(f"ship:{ship_id}")

    results = await pipe.execute()

    return [json.loads(res) for res in results if res]


# 🔹 Seed synthetic data
async def seed_data(r):
    ports = ["Shanghai", "Mumbai", "Dubai", "Singapore", "LA"]

    for i in range(1, 501):
        ship_id = f"S{i:03}"
        data = {
            "ship_id": ship_id,
            "origin": random.choice(ports),
            "destination": random.choice(ports),
            "risk_score": round(random.uniform(0, 1), 2),
            "status": "at_risk" if random.random() > 0.7 else "on_time",
            "top_factors": ["weather", "port delay"]
        }

        await r.set(f"ship:{ship_id}", json.dumps(data))
