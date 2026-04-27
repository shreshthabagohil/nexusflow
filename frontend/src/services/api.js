// frontend/src/services/api.js
import axios from "axios";
import mockShipments from "../data/mock_shipments.json";

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000",
  timeout: 5000, // don't hang forever — fail fast and fall back to mock
});

// ─── Shipments ────────────────────────────────────────────────────────────────

/**
 * Fetch live shipments from backend.
 * Falls back to mock data if:
 *   - Network error / CORS failure
 *   - Backend returns an empty array (e.g. Redis not loaded)
 *   - Any non-2xx response
 */
export async function getShipments() {
  try {
    const res = await api.get("/api/shipments"); // FIX: was /shipments
    const data = res.data;

    // If backend is up but has no data yet (Redis cold start), use mock
    if (Array.isArray(data) && data.length === 0) {
      console.warn("[api] /api/shipments returned []. Using mock data.");
      return mockShipments;
    }

    return data;
  } catch (err) {
    console.warn("[api] getShipments failed — falling back to mock data:", err.message);
    return mockShipments; // never return null; always give the UI something
  }
}

export async function getShipment(id) {
  try {
    const res = await api.get(`/api/shipments/${id}`); // FIX: was /shipments/:id
    return res.data;
  } catch (err) {
    console.error(`[api] getShipment(${id}) error:`, err.message);
    // Graceful fallback: find in mock data so detail views still work
    return mockShipments.find((s) => s.id === id) ?? null;
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics() {
  try {
    const res = await api.get("/api/analytics"); // FIX: was /analytics
    return res.data;
  } catch (err) {
    console.warn("[api] getAnalytics failed — deriving from mock:", err.message);
    // Derive analytics from mock so StatsBar never shows zeroes
    const total = mockShipments.length;
    const at_risk = mockShipments.filter((s) => s.risk_score > 40).length;
    const rerouting = mockShipments.filter((s) => s.status === "rerouting").length;
    const on_time_count = mockShipments.filter((s) => s.status === "on_time").length;
    return {
      total,
      at_risk,
      rerouting,
      on_time_pct: Math.round((on_time_count / total) * 100),
    };
  }
}

// ─── Routes (rerouting options) ──────────────────────────────────────────────

export async function getRoutes(shipmentId) {
  try {
    const res = await api.get(`/api/routes/${shipmentId}`);
    return res.data;
  } catch (err) {
    console.error(`[api] getRoutes(${shipmentId}) error:`, err.message);
    return null;
  }
}

// ─── Disruption simulation ────────────────────────────────────────────────────

export async function postSimulateDisruption(event) {
  try {
    const res = await api.post("/api/simulate/disruption", event); // FIX: was /simulate/disruption
    return res.data;
  } catch (err) {
    console.error("[api] postSimulateDisruption error:", err.message);
    return null;
  }
}

export default api;