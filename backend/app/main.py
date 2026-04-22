import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.services.redis_client import RedisClient


app = FastAPI(
    title="NexusFlow API",
    version="1.0.0",
)

@app.on_event("startup")
def load_data():
    client = RedisClient()

    if not client.ping():
        print("WARNING: Redis not reachable on startup — skipping data load")
        return

    data_path = "/app/data/shipments.json"

    if not os.path.exists(data_path):
        print(f"WARNING: {data_path} not found — skipping Redis load")
        return

    with open(data_path) as f:
        shipments = json.load(f)

    for s in shipments:
        client.set_shipment(s["id"], s)

    print(f"Loaded {len(shipments)} shipments into Redis")
    print("NexusFlow Backend starting on port 8000")
    # ── Shutdown ──────────────────────────────────────────


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://frontend:3000",
        "http://frontend:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "service": "nexusflow-backend"}


@app.get("/api/shipments")
def get_shipments():
    client = RedisClient()
    ids = client.get_all_shipment_ids()
    result = []
    for sid in ids:
        s = client.get_shipment(sid)
        if s:
            s["risk_score"] = float(client.get_risk_score(sid) or 0)
            result.append(s)
    return result


@app.get("/api/shipments/{shipment_id}")
def get_shipment(shipment_id: str):
    client = RedisClient()
    s = client.get_shipment(shipment_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")
    s["risk_score"] = float(client.get_risk_score(shipment_id) or 0)
    return s


@app.get("/api/analytics")
async def get_analytics():
    client = RedisClient()
    ids = client.get_all_shipment_ids()
    total = len(ids)
    at_risk = sum(1 for sid in ids if client.get_risk_score(sid) > 40)
    return {
        "total": total,
        "at_risk": at_risk,
        "rerouting": 0,
        "on_time_pct": round((total - at_risk) / total * 100, 1) if total > 0 else 100.0,
    }