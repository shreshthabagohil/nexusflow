# ⚡ NexusFlow
### Predictive Supply Chain Intelligence Platform

> **Predictive. Explainable. Real-time.**
> Stop firefighting disruptions. Start preventing them.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nexusflow--sand.vercel.app-blue?style=for-the-badge)](https://nexusflow-sand.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-nexusflow-black?style=for-the-badge&logo=github)](https://github.com/shreshthabagohil/nexusflow)
[![Google AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-orange?style=for-the-badge)](https://ai.google.dev/)

---

## 🔴 The Problem

Global supply chains lose **$1.5 trillion annually** to disruptions. Storms, port closures, carrier failures — companies only find out *after* the damage is done.

Existing tools tell you **where** your shipment is.
NexusFlow tells you **where it's about to go wrong** — and what to do about it.

---

## ✅ How We Solved It

NexusFlow monitors live shipments globally, scores each for disruption risk using a trained XGBoost AI model, and delivers Pareto-optimal reroute recommendations **within 5 seconds** of any disruption event — giving logistics teams a **24–48 hour warning window** before damage occurs.

A Kafka-based event streaming pipeline ingests weather, port, carrier, and GPS data continuously. The ML engine scores every shipment 0–100, SHAP explains the top 3 risk factors per shipment, and **Google Gemini API** translates the analysis into plain-English alerts anyone on the team can act on — no data science degree required.

---

## 🚀 Features

- **AI Risk Scoring** — XGBoost model scores every shipment 0–100 in real time (AUC > 0.80)
- **SHAP Explainability** — Top 3 risk factors shown per shipment. No black boxes
- **Gemini AI Alerts** — Plain-English disruption summaries powered by Google Gemini
- **Pareto-Optimal Rerouting** — 3 ranked reroute alternatives per disruption (cost vs. time vs. risk)
- **Anomaly Detection** — Isolation Forest flags unusual port congestion spikes automatically
- **Live WebSocket Updates** — Dashboard refreshes in under 5 seconds from any event
- **Disruption Simulation** — One-click Rotterdam port closure demo with live rescore
- **Analytics Dashboard** — Fleet KPIs, carrier performance, cargo breakdown — all live
- **Filter by Risk Tier** — Critical · High Risk · Medium · Low Risk · Delayed · Rerouting
- **One-Command Deployment** — Full stack via `docker-compose up -d`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, react-leaflet, Recharts |
| **Backend** | FastAPI (Python 3.11), Pydantic, WebSocket |
| **Google AI** | Gemini API — natural language alert summaries |
| **ML / AI** | XGBoost, SHAP, Isolation Forest, NetworkX (Dijkstra) |
| **Streaming** | Apache Kafka, Faust, Zookeeper |
| **Storage** | Redis (primary state), PostgreSQL (optional) |
| **DevOps** | Docker Compose — 7 containerised services |

---

## ⚡ Quick Start

```bash
git clone https://github.com/shreshthabagohil/nexusflow
cd nexusflow
docker-compose up -d
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API | http://localhost:8000 |
| Kafka UI | http://localhost:8080 |

---

## 📈 Future Scale

- **Real Data Integration** — Connect live weather APIs, port APIs, and carrier feeds to replace synthetic events
- **ML Retraining Pipeline** — Daily model updates as new disruption patterns emerge
- **Multi-Tenant SaaS** — Per-customer isolation, subscription pricing
- **Mobile App** — React Native for field logistics teams
- **Carbon Footprint Scoring** — ESG compliance optimization
- **Multi-Modal Routing** — Air, rail, and sea route optimization

---

## 👥 Team

Built for **Google Solution Challenge 2026** — Smart Supply Chains track.

---

*"Supply chains shouldn't be managed in hindsight."*
