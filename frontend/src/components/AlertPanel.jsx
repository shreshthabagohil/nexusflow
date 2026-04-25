import React from "react";
import RiskBadge from "./RiskBadge";

/**
 * AlertPanel — shows at-risk shipments sorted by risk score (highest first).
 *
 * Props:
 *   shipments     — array of all shipments
 *   onViewReroute — callback(shipment) when user clicks "View Reroute"
 */
export default function AlertPanel({ shipments = [], onViewReroute }) {
  const atRisk = shipments
    .filter((s) => parseFloat(s.risk_score) > 60)
    .sort((a, b) => parseFloat(b.risk_score) - parseFloat(a.risk_score));

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>
        Alerts ({atRisk.length})
      </h3>

      {atRisk.length === 0 && (
        <p style={styles.empty}>No high-risk shipments detected.</p>
      )}

      <div style={styles.list}>
        {atRisk.map((s) => (
          <div key={s.id} style={styles.card}>
            <div style={styles.cardTop}>
              <span style={styles.shipId}>{s.id}</span>
              <RiskBadge score={s.risk_score} />
            </div>
            <div style={styles.route}>
              {s.origin_port} → {s.destination_port}
            </div>
            <div style={styles.meta}>
              {s.carrier} · {s.cargo_type || "GENERAL"}
            </div>
            <button
              style={styles.rerouteBtn}
              onClick={() => onViewReroute?.(s)}
            >
              View Reroute
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    background: "#111b27",
    borderRadius: 8,
    padding: 12,
    maxHeight: "calc(100vh - 300px)",
    overflowY: "auto",
  },
  heading: {
    fontSize: 15,
    fontWeight: 700,
    color: "#ef4444",
    marginBottom: 10,
  },
  empty: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  card: {
    background: "#1a2332",
    border: "1px solid #2d1b1b",
    borderRadius: 6,
    padding: 10,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  shipId: {
    fontWeight: 700,
    fontSize: 14,
    color: "#f8fafc",
  },
  route: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 8,
  },
  rerouteBtn: {
    background: "none",
    border: "1px solid #2563eb",
    color: "#60a5fa",
    padding: "4px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
};
