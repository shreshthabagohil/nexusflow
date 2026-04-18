from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("NexusFlow Backend starting on port 8000")
    yield


app = FastAPI(
    title="NexusFlow API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "service": "nexusflow-backend"}


@app.get("/api/shipments")
async def get_shipments():
    return []


@app.get("/api/analytics")
async def get_analytics():
    return {
        "total": 0,
        "at_risk": 0,
        "rerouting": 0,
        "on_time_pct": 100.0,
    }
