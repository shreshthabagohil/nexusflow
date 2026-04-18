# NexusFlow — System Architecture

> **Predictive Supply Chain Intelligence Platform**
> Real-time disruption detection, ML risk scoring, and Pareto-optimal rerouting
> delivered through a streaming, microservice architecture.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow Diagram](#2-data-flow-diagram)
3. [Layer Reference](#3-layer-reference)
4. [Technology Stack](#4-technology-stack)
5. [Docker Services](#5-docker-services)
6. [Key Design Decisions](#6-key-design-decisions)

---

## 1. Architecture Overview

NexusFlow is built around a strict four-layer pipeline. Each layer has a single
responsibility and communicates with its neighbours through well-defined
interfaces (Kafka topics, Redis keys, REST/WebSocket endpoints).

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Data Ingestion          (Kafka producers)                │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2 — Stream Processing       (Faust → Redis)                  │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3 — ML Risk Engine          (XGBoost · SHAP · IsolationForest│
│                                     · Dijkstra)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4 — Dashboard               (React · Leaflet · Recharts · WS)│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Diagram

```
External Sources
  │  weather API (OpenWeather)
  │  port-congestion feed
  │  carrier telemetry
  │  shipment ERP events
  │
  ▼
┌──────────────────────────────────────────────────────────┐
│                  KAFKA  (event bus)                      │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ weather-events  │  │  port-status │  │carrier-    │  │
│  └────────┬────────┘  └──────┬───────┘  │delays      │  │
│           │                  │          └─────┬──────┘  │
│  ┌────────┴──────────────────┴───────────────┴──────┐   │
│  │              shipment-updates                     │   │
│  └───────────────────────────┬───────────────────────┘   │
└──────────────────────────────┼───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│           FAUST STREAM PROCESSORS  (Layer 2)             │
│                                                          │
│  weather-consumer ──┐                                    │
│  port-consumer    ──┼──► FeatureEngineer                 │
│  carrier-consumer ──┘        │                           │
│  shipment-consumer ──────────┘                           │
│                              │                           │
│                              ▼                           │
│                      feature vectors                     │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│              ML RISK ENGINE  (Layer 3)                   │
│                                                          │
│  XGBoost ──► risk score 0-100                            │
│  SHAP     ──► top-3 explanatory factors                  │
│  IsolationForest ──► anomaly flag                        │
│  Dijkstra ──► Pareto-optimal reroute candidates          │
│                              │                           │
│                              ▼                           │
│                    ┌─────────────────┐                   │
│                    │     REDIS       │                   │
│                    │  risk scores    │                   │
│                    │  graph state    │                   │
│                    │  anomaly flags  │                   │
│                    └────────┬────────┘                   │
└─────────────────────────────┼────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│          FASTAPI  backend  (REST + WebSocket)             │
│                                                          │
│  GET  /api/shipments      reads Redis state              │
│  GET  /api/routes         returns optimal reroutes       │
│  GET  /api/risk/{id}      returns score + SHAP factors   │
│  WS   /ws                 pushes updates every 2 s       │
└──────────────────────────────┬───────────────────────────┘
                               │  WebSocket / REST
                               ▼
┌──────────────────────────────────────────────────────────┐
│            REACT + VITE  DASHBOARD  (Layer 4)            │
│                                                          │
│  react-leaflet  ── live shipment map + risk overlays     │
│  Recharts       ── analytics panels, trend charts        │
│  WebSocket hook ── sub-2 s real-time refresh             │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Layer Reference

### Layer 1 — Data Ingestion

Kafka producers emit structured events onto four dedicated topics:

| Topic | Source | Payload |
|---|---|---|
| `weather-events` | OpenWeather API poller | temperature, wind, storm severity |
| `port-status` | Port authority feed | congestion index, berth availability |
| `carrier-delays` | Carrier telemetry | ETA delta, delay reason code |
| `shipment-updates` | ERP / WMS webhook | shipment ID, origin, destination, status |

Producers are decoupled from consumers; Kafka acts as a durable, replayable
buffer that absorbs traffic spikes and enables independent scaling of each side.

---

### Layer 2 — Stream Processing

**Faust** (Python async stream-processing library) runs one consumer agent per
topic. Each agent:

1. Deserialises the raw Kafka event.
2. Passes fields through the shared `FeatureEngineer` module, which normalises
   values and joins cross-topic signals (e.g. weather severity at the
   shipment's current port).
3. Writes the assembled feature vector to **Redis** for consumption by Layer 3.

Redis acts as the shared state store between the stream layer and the ML layer,
enabling sub-millisecond reads without re-querying Kafka.

---

### Layer 3 — ML Risk Engine

The risk engine is a FastAPI service that reads feature vectors from Redis and
runs three complementary models:

| Model | Output | Library |
|---|---|---|
| **XGBoost** | Disruption risk score **0–100** | `xgboost` |
| **SHAP** | Top-3 explanatory factors for the score | `shap` |
| **Isolation Forest** | Binary anomaly flag (unusual shipment behaviour) | `scikit-learn` |
| **Dijkstra** | Pareto-optimal reroute candidates (minimise risk × cost) | `networkx` |

The 200-node shipping network graph is held in memory; edge weights are
recomputed dynamically whenever a new risk score or delay event arrives.
Dijkstra is run on demand per reroute API call with a composite weight
`w = α·risk + (1-α)·distance`, where `α` is configurable per request.

Results (score, SHAP factors, anomaly flag, reroute list) are written back to
Redis with a short TTL so the dashboard always reads fresh data.

---

### Layer 4 — Dashboard

A **React 18 + Vite** single-page application that connects to the backend over
both REST and WebSocket.

| Component | Library | Purpose |
|---|---|---|
| Interactive map | `react-leaflet` | Live shipment positions, risk heat overlays, route arcs |
| Analytics panels | `Recharts` | Risk trend charts, delay histograms, KPI cards |
| Real-time updates | Native `WebSocket` | Server pushes a full state snapshot every 2 s |
| State management | React Context + hooks | Lightweight; avoids Redux overhead for this data shape |

---

## 4. Technology Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Event streaming | Apache Kafka | 7.5.0 (Confluent) | Durable topic-based message bus |
| Stream coordination | Apache ZooKeeper | 7.5.0 (Confluent) | Kafka broker coordination |
| Stream processing | Faust | latest | Python async Kafka consumers |
| In-memory store | Redis | 7 (Alpine) | Feature cache, risk scores, graph state |
| ML — gradient boosting | XGBoost | latest | Disruption risk scoring (0–100) |
| ML — explainability | SHAP | latest | Top-3 factor attribution per prediction |
| ML — anomaly detection | Isolation Forest (scikit-learn) | latest | Flags statistically unusual shipments |
| Graph routing | NetworkX (Dijkstra) | latest | Pareto-optimal reroute computation |
| API layer | FastAPI + Uvicorn | latest | REST endpoints + WebSocket server |
| Frontend framework | React 18 + Vite | 18 / 5 | SPA scaffold, HMR dev server |
| Maps | react-leaflet | latest | Interactive geo visualisation |
| Charts | Recharts | latest | Time-series and categorical analytics |
| Containerisation | Docker + Compose | 3.9 | Service orchestration |

---

## 5. Docker Services

Six containers are declared in `docker-compose.yml` and share the `nexus-net`
bridge network:

| # | Container | Image / Build | Exposed Port | Role |
|---|---|---|---|---|
| 1 | `nexus-zookeeper` | `confluentinc/cp-zookeeper:7.5.0` | internal | Kafka broker coordination |
| 2 | `nexus-kafka` | `confluentinc/cp-kafka:7.5.0` | `9092` | Event streaming bus |
| 3 | `nexus-redis` | `redis:7-alpine` | `6379` | Feature cache + risk state store |
| 4 | `nexus-backend` | `./backend/Dockerfile` | `8000` | FastAPI — REST + WebSocket + ML engine |
| 5 | `nexus-frontend` | `./frontend/Dockerfile` | `5173` | React/Vite dashboard (Vite dev server) |

Start-up order is enforced via `depends_on: condition: service_healthy`
healthchecks on each dependency.

---

## 6. Key Design Decisions

**Kafka over direct HTTP producers** — decouples ingest rate from processing
capacity; events can be replayed during model retraining without re-hitting
external APIs.

**Faust over Spark/Flink** — pure-Python, zero-JVM, integrates natively with
the XGBoost/SHAP stack, and is sufficient throughput for this workload.

**Redis as the ML feature store** — avoids re-querying Kafka for each API
request; TTL-based expiry ensures stale scores are never served.

**SHAP alongside XGBoost** — raw scores without explanations create a black-box
UX; surfacing the top-3 factors lets logistics operators trust and act on
recommendations.

**Isolation Forest as a complement to XGBoost** — the gradient-booster
interpolates within trained distributions; the anomaly detector flags
out-of-distribution events that the scoring model may underestimate.

**Dijkstra with composite weights** — pure shortest-path ignores risk; pure
lowest-risk ignores cost. The `α·risk + (1-α)·distance` formulation exposes
a configurable risk-cost trade-off to the operator.

**WebSocket push over polling** — eliminates per-client polling overhead and
delivers updates in under 2 s with a single server-side broadcast loop.
