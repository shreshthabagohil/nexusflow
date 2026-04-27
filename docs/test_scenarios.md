# NexusFlow — Reroute Test Scenarios

Three canonical test scenarios for validating the Dijkstra route optimizer,
disruption simulator, and end-to-end pipeline.

---

## Scenario A — Rotterdam Port Closure

**Setup:** Shipment on Shanghai → Rotterdam route. Rotterdam congestion set to maximum.

**Trigger:**
```bash
curl -X POST http://localhost:8000/api/simulation/disrupt \
  -H "Content-Type: application/json" \
  -d '{"port": "Rotterdam", "severity": 9.5}'
```

**Verify reroute avoids Rotterdam:**
```bash
curl http://localhost:8000/api/shipments/NX1001/reroute
```

**Expected:** All 3 route options bypass Rotterdam. At least one route goes via Hamburg or Antwerp. `shipments_queued` ≥ 1 in response.

---

## Scenario B — Carrier Reliability Drop (Maersk)

**Setup:** Maersk on-time rate drops to 0.4 (below anomaly threshold of 0.5).

**Trigger:**
```bash
# Simulate directly via Redis (inside container)
docker exec nexusflow-backend-1 python3 -c "
import redis, asyncio
r = redis.from_url('redis://redis:6379/0', decode_responses=True)
r.set('carrier:Maersk:ontime_rate', '0.4')
print('Maersk ontime_rate set to 0.4')
"
```

**Verify score increase for Maersk shipments:**
```bash
curl http://localhost:8000/api/score/NX1001
```

**Expected:** `score` increases (carrier_anomaly flag = True in AnomalyDetector). Reroute endpoint returns 3 alternative carriers/routes.

---

## Scenario C — Severe Weather on Indian Ocean Route

**Setup:** Weather severity set to 0.92 on Singapore route (above 0.85 threshold).

**Trigger:**
```bash
docker exec nexusflow-backend-1 python3 -c "
import redis
r = redis.from_url('redis://redis:6379/0', decode_responses=True)
r.set('weather:Singapore', '0.92')
r.set('weather:Mumbai', '0.88')
print('Severe weather set on Singapore and Mumbai')
"
```

**Verify anomaly detection:**
```bash
# Check AnomalyDetector flags weather correctly
docker exec nexusflow-backend-1 python3 -c "
from app.services.anomaly_detector import AnomalyDetector
d = AnomalyDetector()
result = d.detect(weather=0.92)
print('is_anomaly:', result['is_anomaly'])
print('reasons:', result['reasons'])
"
```

**Expected:** `is_anomaly=True`, `weather_anomaly=True`. Shipments routing through Singapore show elevated risk score via `/api/score`.

---

## Full Pipeline Integration Test

```bash
# 1. Verify all services healthy
docker compose ps

# 2. Check shipment count
curl -s http://localhost:8000/api/analytics | python3 -m json.tool

# 3. Score a shipment
curl -s http://localhost:8000/api/score/NX1001 | python3 -m json.tool

# 4. Get feature vector
curl -s http://localhost:8000/api/shipments/NX1001/features | python3 -m json.tool

# 5. Get reroute options
curl -s http://localhost:8000/api/shipments/NX1001/reroute | python3 -m json.tool

# 6. Simulate disruption
curl -s -X POST http://localhost:8000/api/simulation/disrupt \
  -H "Content-Type: application/json" \
  -d '{"port":"Rotterdam","severity":9.5}' | python3 -m json.tool

# 7. Verify Kafka consumer is alive
docker compose logs faust-worker --tail=10

# 8. Run unit tests
docker exec -w /app nexusflow-backend-1 python -m pytest tests/ -v
```
