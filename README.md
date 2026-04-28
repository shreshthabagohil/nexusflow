# 🚢 NexusFlow — Predictive Supply Chain Intelligence

> **Google Hackathon 2026** · Smart Supply Chains track

NexusFlow is a real-time supply chain intelligence platform that uses machine learning to predict shipment disruption risk, explain the top risk drivers, and automatically generate Pareto-optimal rerouting options — all visualised on a live interactive map.

---

## 🎥 Demo Video

**[▶ Watch the 3-minute demo](#)** ← _replace with your YouTube/Drive link after recording_

---

## ✨ Key Features

- **Live Risk Scoring** — XGBoost model scores 997 shipments on disruption risk (0–100) at startup; scores update in real time via WebSocket
- **SHAP Explainability** — Every score comes with the top 3 human-readable risk factors (e.g. "High origin congestion", "Weather severity spike")
- **Dijkstra Route Optimizer** — Generates 3 Pareto-optimal reroute options (Primary / Low-Risk / Express) using NetworkX on a 25-port shipping graph
- **Rotterdam Disruption Simulator** — One-click port closure simulation that mass-rescores all affected shipments live
- **Interactive Map** — Leaflet map with colour-coded shipment dots (Critical / High / Medium / Low), hover-to-reveal route arcs, and real-time position updates
- **Analytics Dashboard** — Cargo breakdown, risk distribution charts, and live KPI strip
- **Kafka Streaming Pipeline** — Faust stream processors consume `weather-events`, `carrier-events`, and `port-congestion` topics to continuously update risk scores

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React 18 + Vite)              │
│  Dashboard · MapView · AlertsSidebar · RerouteModal      │
│  WebSocket client ←──────────────────────────────────┐  │
└──────────────────────────┬───────────────────────────│──┘
                           │ REST + WebSocket           │
┌──────────────────────────▼───────────────────────────│──┐
│              Backend (FastAPI · Python 3.11)           │  │
│  /api/shipments  /api/score  /api/routes  /ws ─────────┘  │
│  FeatureEngineer → XGBoost + SHAP → RouteOptimizer        │
└──────────┬───────────────────────────┬────────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼──────────────────┐
│   Redis 7           │   │  Apache Kafka + Faust Worker   │
│   Shipment store    │   │  weather / carrier / congestion │
│   Congestion state  │   │  stream processors             │
└─────────────────────┘   └───────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (Mac/Windows) or Docker Engine + Compose v2 (Linux)
- 4 GB RAM free for the full stack

### 1. Clone & start

```bash
git clone https://github.com/shreshthabagohil/nexusflow.git
cd nexusflow
docker compose up --build -d
```

Wait ~90 seconds for Kafka to initialise, then open:

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000/docs |
| **Kafka UI** | http://localhost:8080 |

### 2. Seed synthetic data (optional — adds weather/carrier events)

```bash
docker compose exec backend python data/generate_synthetic_data.py
```

### 3. Train / retrain the ML model (optional — model is pre-built)

```bash
docker compose exec backend python ml/train_model.py
```

### 4. Run the Rotterdam disruption demo

Click **"Simulate Disruption"** in the top-right of the dashboard, then watch risk scores for Rotterdam-bound shipments spike in real time on the map.

---

## 🗂️ Project Structure

```
nexusflow/
├── frontend/               # React 18 + Vite SPA
│   └── src/
│       ├── components/     # MapView, AlertsSidebar, RerouteModal, ...
│       ├── services/api.js # Axios client + offline mock fallback
│       └── data/           # mock_shipments.json (997 ships)
├── backend/
│   ├── app/
│   │   ├── api/routes/     # FastAPI routers
│   │   ├── services/       # FeatureEngineer, RouteOptimizer, Redis client
│   │   ├── streams/        # Faust stream processors
│   │   └── data/           # seed_data.py, shipments.json
│   └── ml/
│       ├── train_model.py  # XGBoost training pipeline
│       ├── risk_scorer.py  # Scorer + SHAP explainer
│       └── risk_scorer.pkl # Pre-trained model
└── docker-compose.yml
```

---

## 🤖 ML Pipeline

| Component | Detail |
|-----------|--------|
| Model | XGBoost classifier (AUC > 0.80) |
| Features | weather_severity, origin_congestion, dest_congestion, carrier_ontime_rate, cargo_priority_weight, days_until_eta, route_distance_km |
| Explainability | SHAP — top 3 risk factors per shipment |
| Anomaly detection | Isolation Forest flags unusual congestion patterns |
| Streaming | Faust consumers update Redis scores on every Kafka event |

---

## 🛳️ Route Optimiser

Three Dijkstra strategies on a 25-port shipping graph (NetworkX):

| Strategy | Weight | Description |
|----------|--------|-------------|
| Primary Route | `distance` | Shortest great-circle path |
| Low-Risk Route | `risk_weight` | Avoids high-congestion waypoints |
| Express Route | `hop_weight` | Fewest port stops, 10% speed boost |

---

## 🧪 Running Tests

```bash
docker compose exec backend python -m pytest backend/tests/ -v
```

---

## 👥 Team

| Role | Responsibility |
|------|---------------|
| Lead | Architecture, Docker, coordination |
| T1 | FastAPI backend, Redis, Kafka |
| T2 | React frontend, UI/UX |
| T3 | ML pipeline, XGBoost, SHAP, route optimizer |

---

## 📄 License

MIT
