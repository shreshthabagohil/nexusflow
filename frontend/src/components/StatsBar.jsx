// frontend/src/components/StatsBar.jsx
const defaultAnalytics = { total: 0, at_risk: 0, rerouting: 0, on_time_pct: 100 };

export default function StatsBar({ analytics = defaultAnalytics }) {
  const { total, at_risk, rerouting, on_time_pct } = { ...defaultAnalytics, ...analytics };

  const cards = [
    { label: "Total", value: total, color: "#1A2B4A" },
    { label: "At Risk", value: at_risk, color: "#c0392b" },
    { label: "Rerouting", value: rerouting, color: "#e67e22" },
    { label: "On Time %", value: `${on_time_pct}%`, color: "#27ae60" },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
      {cards.map(({ label, value, color }) => (
        <div
          key={label}
          style={{
            flex: "1 1 100px",
            background: "#fff",
            border: "1px solid #e0e7ef",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
