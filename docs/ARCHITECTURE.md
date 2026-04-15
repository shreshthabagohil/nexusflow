# NexusFlow Architecture

## 1. Project Overview

NexusFlow is a Predictive Supply Chain Intelligence Platform designed to anticipate disruptions and optimize routing in real time. Built for the Google Hackathon, it leverages streaming data, machine learning, and advanced graph algorithms to deliver actionable insights to logistics users via an interactive dashboard.

---

## 2. Architecture Overview

NexusFlow employs a modular, four-layered architecture:

### Layer 1: Data Ingestion

- **Sources:** Real-time external and internal feeds (weather, port status, carrier delay, and shipment status)
- **Transport:** Apache Kafka with dedicated topics: `weather-events`, `port-status`, `carrier-delays`, and `shipment-updates`
- **Function:** Buffer and decouple streaming event producers from downstream consumers for scalable, resilient ingest

### Layer 2: Stream Processing & Risk Scoring

- **Consumers:** [Faust](https://faust.readthedocs.io/) stream processors consume Kafka topics
- **Processing:** `FeatureEngineer` module extracts and aggregates features for risk analysis
- **Prediction:** Pre-trained XGBoost model infers shipment risk scores
- **Caching:** Predicted scores are written to Redis in-memory store for ultra-low latency access

### Layer 3: Route Optimization

- **Graph Analytics:** On-demand, FastAPI microservice exposes optimized routing based on live risk and performance data
- **Algorithm:** Dijkstra's algorithm (via [networkx](https://networkx.org/)) operates on a dynamic, 200-node shipping network graph, considering both static (distance, capacity) and dynamic (risk score, delays) edge weights

### Layer 4: Real-Time Dashboard

- **Frontend:** React 18 (bootstrapped with Vite) renders an interactive, map-centric dashboard
- **Live Updates:** Data is streamed to the browser via WebSocket, refreshing every two seconds for minimal latency
- **Visualization:** [react-leaflet](https://react-leaflet.js.org/) for map rendering; displays live routes, shipment positions, and risk overlays

---

## 3. ASCII Architecture Diagram

```
[ Kafka Topics ]              [Faust Stream Processors]           [Redis]
 weather-events           ->     shipment-update-consumer    ->   live risk scores
 port-status              ->     weather-consumer            ->   shipment graph data
 carrier-delays           ->     FeatureEngineer + XGBoost   |
 shipment-updates         |                                   
                          |        ____________             [FastAPI Route API]
                          |------> |  Redis   |  <-------   (reads risk & graph)
                          |        ------------           /
                          |                              /
                          |----------------------------/
                                                      /
                        [React+Vite Frontend] <------/
                               (WebSocket: 2s updates)
```

---

## 4. Technology Stack

| Architecture Layer         | Technology                        | Purpose                                                                |
|---------------------------|-----------------------------------|------------------------------------------------------------------------|
| Data Ingestion            | Kafka                             | Reliable, high-throughput streaming ingest/buffering                    |
| Stream Processing         | Faust (Python), XGBoost, Redis    | Stream processing, ML risk scoring, in-memory caching                   |
| Route Optimization        | FastAPI, networkx (Dijkstra)      | API microservice, shortest/optimal path calculation on shipping graph   |
| Real-Time Dashboard       | React 18, Vite, react-leaflet     | Web UI, fast dev/build cycle, interactive maps                          |
| Messaging/API             | WebSocket                         | Real-time data push to browsers                                         |

---

## 5. Key Design Decisions

- **Kafka for Ingestion:** Chosen for horizontal scalability, ability to replay streams, and native handling of multiple data producers.
- **Faust Stream Processing:** Lightweight yet powerful Python stream-processing, tightly integrates with Kafka and the Python data stack for rapid prototyping.
- **XGBoost + Redis:** XGBoost delivers fast, high-quality risk predictions; Redis ensures sub-millisecond response time for live dashboards.
- **Networkx & Dijkstra:** Enables flexible, in-memory graph optimization; rapidly recomputes optimal routes as edge weights (i.e., risks, delays) change in real time.
- **React + Vite + WebSocket:** React provides rich, interactive UI; Vite accelerates developer workflow; WebSockets guarantee timely updates for end-users.

---

## 6. Data Flow Description: Shipment Risk Score

1. **Event Entry:** A shipment update (e.g., delayed at port) is published by a data source to the `shipment-updates` Kafka topic.
2. **Stream Processing:** Faust consumer subscribed to `shipment-updates` ingests the event.
3. **Feature Engineering:** Consumer module extracts features (e.g., delay duration, port congestion, weather risk) and passes them to the XGBoost model.
4. **Risk Scoring:** XGBoost infers the shipment's risk score using trained parameters.
5. **Result Caching:** Risk score is written to Redis, updating the shipment and edge weights in the graph.
6. **API Access:** FastAPI service exposes an endpoint that queries Redis for latest risk data and recalculates optimal routes as needed.
7. **Real-Time Delivery:** React frontend, via a persistent WebSocket connection, receives the latest shipment risks and route updates every 2 seconds.
8. **User Insight:** The browser updates the map and dashboard widgets, visualizing new shipment positions, risk levels, and optimized routes immediately.

---
