# NexusFlow — Demo Script

**Target length:** 3 minutes  
**URL:** http://localhost:3000  
**Pre-flight:** `docker compose up -d` — all 7 containers green.

---

## Scene 1 (0:00 – 0:30) — The Live Dashboard

**Action:** Open http://localhost:3000. Let the map load fully.

**Narration:**
> "NexusFlow monitors 500 live shipments worldwide in real time.
> Green pins are on track. Amber means watch closely. Red means disruption risk — right now."

**Point to:** StatsBar at the top — Total Shipments, At Risk count, Rerouting count, On-Time %.

> "Our ML engine scores every shipment's disruption probability continuously,
> pulling from live weather feeds, port congestion data, and carrier performance."

---

## Scene 2 (0:30 – 1:00) — ML Risk Scoring + SHAP

**Action:** Scroll the AlertPanel on the right. Click **"View Reroute"** on the highest-risk shipment (red badge, score ≥ 70).

**Narration:**
> "Each shipment gets an XGBoost risk score from 0 to 100.
> This one is scoring 87 — critical."

**Wait for RerouteModal to open. Point to the top risk factors.**

> "SHAP explainability tells us exactly WHY. Severe weather on the route,
> destination port congestion, and a carrier with a degraded on-time rate —
> those three factors are driving this score."

---

## Scene 3 (1:00 – 1:45) — Rotterdam Disruption Simulation

**Action:** Close the modal. Click the red **"Simulate Rotterdam Closure"** button.

**Narration:**
> "Let's stress-test the system. Rotterdam — the busiest port in Europe — just closed."

**Watch the map.** Within 5–10 seconds, pins near Rotterdam and on inbound routes turn red.

> "Our Kafka streaming pipeline picks up the disruption event instantly.
> Scores for all 47 affected shipments update via WebSocket in under 3 seconds —
> no page refresh needed."

**Point to AlertPanel filling with new alerts.**

> "The alert panel surfaces the highest-risk shipments automatically,
> sorted by risk × cargo priority."

---

## Scene 4 (1:45 – 2:30) — Dijkstra Route Optimizer

**Action:** Click **"View Reroute"** on a newly-at-risk Rotterdam-bound shipment.

**Narration:**
> "For every disrupted shipment, our Dijkstra route optimizer instantly finds
> the three best alternative paths — balancing time, cost, and risk reduction."

**Point to the 3 route cards.**

> "Route 1 via Hamburg adds 48 hours but cuts risk by 38%.
> Route 2 via Antwerp is faster but costs $4,000 more.
> Route 3 is the Pareto-optimal choice — recommended."

**Click "Select This Route".**

> "One click. The shipment is rerouted."

---

## Scene 5 (2:30 – 3:00) — Architecture + Close

**Action:** Return to the main dashboard. Show the full map with mixed pin colours.

**Narration:**
> "Under the hood: Kafka streams from 3 real-time topics.
> An Isolation Forest flags statistical anomalies in port congestion before they cascade.
> XGBoost with SHAP gives interpretable, auditable predictions.
> All of it live — zero manual intervention."

**Pause on the map.**

> "NexusFlow. Predictive supply chain intelligence — from data to decision in seconds."

---

## Pre-Demo Checklist

```bash
# 1. Fresh start
docker compose down && docker compose up -d

# 2. Verify all 7 containers up
docker compose ps

# 3. Confirm 500 shipments loaded
curl -s http://localhost:8000/api/analytics | python3 -m json.tool

# 4. Seed a dramatic score for demo shipments
curl -s http://localhost:8000/api/score/S001
curl -s http://localhost:8000/api/score/S002
curl -s http://localhost:8000/api/score/S003

# 5. Open http://localhost:3000 — confirm map loads with pins
# 6. Open DevTools → Network → WS → confirm WebSocket connected
```

## Key Numbers to Know

| Metric | Value |
|--------|-------|
| Shipments monitored | 500 |
| ML model AUC-ROC | 0.8999 |
| SHAP factors per shipment | 3 |
| Reroute options per shipment | 3 |
| WebSocket update latency | ~3 seconds |
| Kafka topics | 3 (weather-events, port-congestion, carrier-events) |
| Anomaly detection | Isolation Forest (500 baseline samples) |
