import React from "react";

/**
 * StatsBar — top bar showing aggregate shipment statistics.
 */
export default function StatsBar({ shipments = [] }) {
  const total = shipments.length;
  const atRisk = shipments.filter((s) => parseFloat(s.risk_score) > 60).length;
  const rerouting = shipments.filter((s) => s.status === "rerouting").length;
  const onTime = shipments.filter((s) => s.status === "on_time").length;
  const onTimePct = total > 0 ? Math.round((onTime / total) * 100) : 100;

  const stats = [
    { label: "Total Shipments", value: total, color: "#60a5fa" },
    { label: "At Risk", value: atRisk, color: "#ef4444" },
    { label: "Rerouting", value: rerouting, color: "#f59e0b" },
    { label: "On-Time %", value: `${onTimePct}%`, color: "#22c55e" },
  ];

  return (
    <div style={styles.bar}>
      {stats.map((s) => (
        <div key={s.label} style={styles.stat}>
          <div style={{ ...styles.value, color: s.color }}>{s.value}</div>
          <div style={styles.label}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    gap: 16,
    padding: "10px 16px",
    background: "#111b27",
    borderRadius: 8,
  },
  stat: {
    flex: 1,
    textAlign: "center",
  },
  value: {
    fontSize: 22,
    fontWeight: 700,
  },
  label: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
};
