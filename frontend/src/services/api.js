// frontend/src/services/api.js
import axios from "axios";
import mockShipments from "../data/mock_shipments.json";

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000",
  timeout: 800, // fail fast — mock fallback kicks in within 1 second
});

// ─── Mock enrichment ──────────────────────────────────────────────────────────
// Deterministically adds cargo_type, departure_date, and top_risk_factors to a
// bare mock shipment so all UI views (analytics filters, shipment detail) work
// correctly even with no backend running.

const MOCK_CARGO_TYPES = ["Electronics","General","Automotive","Pharma","Chemicals","Food","Perishables","Textiles","Machinery"];

function enrichMockShipment(s) {
  if (!s) return null;
  const seed  = s.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const score = Number(s.risk_score ?? 0);
  const cargoType = s.cargo_type ?? MOCK_CARGO_TYPES[seed % MOCK_CARGO_TYPES.length];
  const depDate   = s.eta
    ? new Date(new Date(s.eta).getTime() - (18 + (seed % 12)) * 86400000).toISOString()
    : null;
  const topFactors = s.top_risk_factors ?? (() => {
    const f = [];
    if (score > 60) f.push({ factor: "Origin port congestion",  direction: "increase", contribution: +(1.5 + (seed % 10) / 10).toFixed(2) });
    if (score > 50) f.push({ factor: "Severe weather on route", direction: "increase", contribution: +(0.7 + (seed % 5)  / 10).toFixed(2) });
    if (score > 40) f.push({ factor: "High-priority cargo",     direction: "increase", contribution: +(0.5 + (seed % 4)  / 10).toFixed(2) });
    if (score <= 40 && score > 20) f.push({ factor: "Carrier on-time rate", direction: "reduce", contribution: +(0.8 + (seed % 5) / 10).toFixed(2) });
    return f;
  })();
  return { ...s, cargo_type: cargoType, departure_date: depDate, top_risk_factors: topFactors };
}

// ─── Shipments ────────────────────────────────────────────────────────────────

// Synchronous — used as instant initial state so the UI never waits
export function getMockShipments() {
  return mockShipments.map(enrichMockShipment);
}

/**
 * Fetch live shipments from backend.
 * Falls back to enriched mock data if backend is offline or returns empty.
 */
export async function getShipments() {
  try {
    const res = await api.get("/api/shipments");
    const data = res.data;

    // If backend is up but has no data yet (Redis cold start), use mock
    if (Array.isArray(data) && data.length === 0) {
      console.warn("[api] /api/shipments returned []. Using mock data.");
      return mockShipments.map(enrichMockShipment);
    }

    return data;
  } catch (err) {
    console.warn("[api] getShipments offline — using mock data:", err.message);
    // Enrich every mock shipment with cargo_type, departure_date, top_risk_factors
    // so cargo filters in Analytics and other views always work
    return mockShipments.map(enrichMockShipment);
  }
}

export async function getShipment(id) {
  try {
    const res = await api.get(`/api/shipments/${id}`);
    return res.data;
  } catch (err) {
    console.warn(`[api] getShipment(${id}) offline — using mock:`, err.message);
    const raw = mockShipments.find((s) => s.id === id) ?? null;
    return enrichMockShipment(raw);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics() {
  try {
    const res = await api.get("/api/analytics"); // FIX: was /analytics
    return res.data;
  } catch (err) {
    console.warn("[api] getAnalytics offline — deriving from mock:", err.message);
    const enriched = mockShipments.map(enrichMockShipment);
    const total         = enriched.length;
    const at_risk       = enriched.filter((s) => Number(s.risk_score) > 40).length;
    const rerouting     = enriched.filter((s) => s.status === "rerouting").length;
    const on_time_count = enriched.filter((s) => s.status === "on_time").length;
    return {
      total,
      at_risk,
      rerouting,
      on_time_pct: Math.round((on_time_count / total) * 100),
    };
  }
}

// ─── Routes (rerouting options) ──────────────────────────────────────────────

function mockRerouteOptions(shipmentId) {
  return {
    reroute_options: [
      {
        route_name: "Pacific Express",
        waypoints: [
          { port: "Shanghai" },
          { port: "Busan" },
          { port: "Long Beach" },
        ],
        eta_days: 14,
        cost_delta: 0,
        risk_delta: -18,
        color: "#3b82f6",
      },
      {
        route_name: "Suez Detour",
        waypoints: [
          { port: "Singapore" },
          { port: "Port Said" },
          { port: "Rotterdam" },
        ],
        eta_days: 21,
        cost_delta: 12,
        risk_delta: -8,
        color: "#f97316",
      },
      {
        route_name: "Cape of Good Hope",
        waypoints: [
          { port: "Singapore" },
          { port: "Cape Town" },
          { port: "Hamburg" },
        ],
        eta_days: 28,
        cost_delta: -5,
        risk_delta: 4,
        color: "#8b5cf6",
      },
    ],
  };
}

export async function getRoutes(shipmentId) {
  try {
    // Correct endpoint: /api/shipments/:id/reroute
    const res = await api.get(`/api/shipments/${shipmentId}/reroute`);
    return res.data;
  } catch (err) {
    console.warn(`[api] getRoutes(${shipmentId}) falling back to mock:`, err.message);
    // Always return mock options so the modal is never empty offline
    return mockRerouteOptions(shipmentId);
  }
}

// ─── Disruption simulation ────────────────────────────────────────────────────

export async function postSimulateDisruption(event) {
  try {
    // Try the Day 5 endpoint first, fall back to legacy path
    const res = await api.post("/api/simulation/disrupt", event);
    return res.data;
  } catch (err) {
    try {
      const res = await api.post("/api/simulate/disruption", event);
      return res.data;
    } catch (err2) {
      // Backend offline — return a mock success so the UI isn't stuck on "API unavailable"
      console.warn("[api] postSimulateDisruption offline — returning mock result:", err2.message);
      return {
        ok: true,
        mock: true,
        event,
        affected: mockShipments.filter((s) => s.origin_port === (event?.port ?? "") || s.destination_port === (event?.port ?? "")).length,
        message: `Simulated ${event?.type ?? "disruption"} at ${event?.port ?? "port"} (demo mode)`,
      };
    }
  }
}

export async function getReroute(shipmentId) {
  try {
    const res = await api.get(`/api/shipments/${shipmentId}/reroute`);
    return res.data;
  } catch (err) {
    console.error(`[api] getReroute(${shipmentId}) error:`, err.message);
    return null;
  }
}

export default api;
