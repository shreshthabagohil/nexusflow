import React, { useState, useEffect } from "react";
import RiskBadge from "./RiskBadge";
import api from "../services/api";

/**
 * RerouteModal — full-screen overlay showing 3 Pareto-optimal route options.
 *
 * Props:
 *   shipment  — shipment object (or null to hide modal)
 *   onClose   — callback to close the modal
 */
export default function RerouteModal({ shipment, onClose }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shipment) return;
    setLoading(true);
    api
      .get(`/api/shipments/${shipment.id}/reroute`)
      .then((res) => {
        setRoutes(res.data.reroute_options || []);
      })
      .catch((err) => {
        console.error("[RerouteModal] fetch error:", err.message);
        setRoutes([]);
      })
      .finally(() => setLoading(false));
  }, [shipment]);

  if (!shipment) return null;

  // Find the route with highest risk_reduction for "RECOMMENDED" badge
  const bestIdx = routes.reduce(
    (best, r, i) =>
      r.risk_reduction > (routes[best]?.risk_reduction ?? 0) ? i : best,
    0
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Reroute Options for {shipment.id}</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Shipment info */}
        <div style={styles.info}>
          <span>
            Route: {shipment.origin_port || "—"} →{" "}
            {shipment.destination_port || "—"}
          </span>
          <span style={{ marginLeft: 16 }}>
            Risk Score: <RiskBadge score={shipment.risk_score} />
          </span>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div style={styles.spinnerBox}>
            <div style={styles.spinner} />
            <span style={{ marginLeft: 12 }}>Finding optimal routes...</span>
          </div>
        )}

        {/* Route cards */}
        {!loading && routes.length === 0 && (
          <p style={{ padding: 16, color: "#94a3b8" }}>
            No reroute options available.
          </p>
        )}

        {!loading &&
          routes.map((route, idx) => (
            <div key={route.route_id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.routeBadge}>{route.route_id}</span>
                <span style={styles.routeDesc}>{route.description}</span>
                {idx === bestIdx && (
                  <span style={styles.recommended}>RECOMMENDED</span>
                )}
              </div>

              <div style={styles.stats}>
                <span>⏱ {route.estimated_time_hours}h</span>
                <span>💰 +${route.cost_delta_usd?.toLocaleString()}</span>
                <span>📉 -{route.risk_reduction}% risk</span>
              </div>

              <button
                style={styles.selectBtn}
                onClick={() => {
                  console.log(
                    `[RerouteModal] Selected route ${route.route_id} for ${shipment.id}`
                  );
                  onClose();
                }}
              >
                Select This Route
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modal: {
    background: "#1a2332",
    borderRadius: 12,
    maxWidth: 600,
    width: "90%",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: 24,
    color: "#e0e6ed",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#60a5fa",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 20,
    cursor: "pointer",
    padding: "4px 8px",
  },
  info: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
    fontSize: 14,
    color: "#94a3b8",
  },
  spinnerBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    color: "#94a3b8",
  },
  spinner: {
    width: 24,
    height: 24,
    border: "3px solid #334155",
    borderTop: "3px solid #60a5fa",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  card: {
    background: "#0f1923",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    border: "1px solid #1e3a5f",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  routeBadge: {
    background: "#2563eb",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
  },
  routeDesc: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
  },
  recommended: {
    background: "#16a34a",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  stats: {
    display: "flex",
    gap: 20,
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 12,
  },
  selectBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "8px 20px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
};
