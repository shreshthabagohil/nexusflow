// frontend/src/components/RerouteModal.jsx
// Full rerouting modal: fetches 3 Dijkstra route options, lets user select & apply.

import { useState, useEffect } from "react";
import { getRoutes } from "../services/api";

function costLabel(delta) {
  if (delta === 0) return { text: "Baseline", color: "#64748b" };
  if (delta > 0)   return { text: `+$${Math.abs(delta)}K`, color: "#EF4444" };
  return { text: `-$${Math.abs(delta)}K`, color: "#10B981" };
}

function riskLabel(delta) {
  if (delta === 0) return { text: "Same risk", color: "#64748b" };
  if (delta > 0)   return { text: `+${delta} pts`, color: "#EF4444" };
  return { text: `${delta} pts`, color: "#10B981" };
}

const ROUTE_COLORS = {
  "Primary Route":  "#1565C0",
  "Low-Risk Route": "#E65100",
  "Express Route":  "#757575",
};

export default function RerouteModal({ shipment, onClose }) {
  const [routes, setRoutes]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [applied, setApplied]     = useState(false);

  useEffect(() => {
    if (!shipment?.id) return;
    setLoading(true);
    setError(null);
    setApplied(false);
    setSelected(null);

    getRoutes(shipment.id).then((data) => {
      if (data?.reroute_options?.length > 0) {
        setRoutes(data.reroute_options);
        setSelected(0); // pre-select primary
      } else {
        setError("No routes available for this shipment.");
      }
      setLoading(false);
    });
  }, [shipment?.id]);

  function handleApply() {
    if (selected === null || !routes) return;
    setApplied(true);
    // In a real system we'd POST to /api/shipments/{id}/reroute
    // For demo we update locally and show success state
    setTimeout(onClose, 2000);
  }

  if (!shipment) return null;

  // Find the route with highest risk_reduction for "RECOMMENDED" badge
  const bestIdx = routes.reduce(
    (best, r, i) =>
      r.risk_reduction > (routes[best]?.risk_reduction ?? 0) ? i : best,
    0
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 12, padding: "1.75rem", width: "min(580px, 95vw)", boxShadow: "0 8px 40px rgba(0,0,0,0.22)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1A2B4A" }}>
              🔄 Reroute Shipment
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.83rem", color: "#64748b" }}>
              {shipment.origin_port} → {shipment.destination_port}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b", padding: 4 }}>✕</button>
        </div>

        {/* Shipment summary row */}
        <div style={{ display: "flex", gap: "1rem", background: "#f8fafc", borderRadius: 8, padding: "0.7rem 1rem", marginBottom: "1.25rem", fontSize: "0.82rem" }}>
          <span><strong style={{ color: "#1A2B4A" }}>ID:</strong> {shipment.id}</span>
          <span><strong style={{ color: "#1A2B4A" }}>Carrier:</strong> {shipment.carrier}</span>
          <span><strong style={{ color: "#1A2B4A" }}>Status:</strong> {shipment.status?.replace("_", " ")}</span>
          <span>
            <strong style={{ color: "#1A2B4A" }}>Risk:</strong>{" "}
            <span style={{ color: shipment.risk_score > 70 ? "#EF4444" : shipment.risk_score > 40 ? "#F59E0B" : "#10B981", fontWeight: 600 }}>
              {shipment.risk_score}
            </span>
          </span>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "#64748b" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🗺️</div>
            Computing optimal routes…
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Success state */}
        {applied && (
          <div style={{ padding: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#065f46", fontSize: "0.9rem", textAlign: "center", fontWeight: 600 }}>
            ✅ Shipment rerouted via <em>{routes[selected]?.route_name}</em>. Closing…
          </div>
        )}

        {/* Route options */}
        {!loading && !error && !applied && routes && (
          <>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>
              Select a route option:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {routes.map((route, idx) => {
                const isSelected = selected === idx;
                const routeColor = ROUTE_COLORS[route.route_name] ?? route.color ?? "#1565C0";
                const cost       = costLabel(route.cost_delta);
                const risk       = riskLabel(route.risk_delta);

                return (
                  <button
                    key={idx}
                    onClick={() => setSelected(idx)}
                    style={{
                      background: isSelected ? "#f0f7ff" : "#fafafa",
                      border: `2px solid ${isSelected ? routeColor : "#e2e8f0"}`,
                      borderRadius: 10,
                      padding: "0.9rem 1rem",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                  >
                    {/* Route name + color swatch */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", background: routeColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1A2B4A" }}>
                        {route.route_name}
                      </span>
                      {isSelected && (
                        <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: routeColor, color: "#fff", borderRadius: 12, padding: "1px 9px" }}>
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Waypoints */}
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      {route.waypoints.map((w) => w.port).join(" → ")}
                    </div>

                    {/* Metrics row */}
                    <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.82rem" }}>
                      <span style={{ color: "#64748b" }}>
                        📏 {Number(route.distance_km).toLocaleString()} km
                      </span>
                      <span style={{ color: "#64748b" }}>
                        ⏱ {route.eta_days} days
                      </span>
                      <span style={{ color: cost.color, fontWeight: 600 }}>
                        💰 {cost.text}
                      </span>
                      <span style={{ color: risk.color, fontWeight: 600 }}>
                        ⚠️ {risk.text}
                      </span>
                    </div>

                    {/* Carrier */}
                    <div style={{ marginTop: "0.4rem", fontSize: "0.78rem", color: "#94a3b8" }}>
                      Carrier: <strong style={{ color: "#475569" }}>{route.carrier}</strong>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 7, padding: "0.55rem 1.1rem", cursor: "pointer", fontSize: "0.875rem", color: "#64748b" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={selected === null}
                style={{
                  background: selected !== null ? "#1A2B4A" : "#94a3b8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "0.55rem 1.4rem",
                  cursor: selected !== null ? "pointer" : "not-allowed",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                Apply Route
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
