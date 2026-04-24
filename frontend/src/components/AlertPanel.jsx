// frontend/src/components/AlertPanel.jsx
export default function AlertPanel({ shipments = [] }) {
  const alerts = shipments.filter((s) => s.risk_score > 40);

  return (
    <div className="alert-panel" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#1A2B4A" }}>High-Risk Shipments</h3>
        <span
          style={{
            background: "#c0392b",
            color: "#fff",
            borderRadius: "999px",
            padding: "2px 10px",
            fontSize: "0.8rem",
            fontWeight: 700,
            minWidth: "24px",
            textAlign: "center",
          }}
        >
          {alerts.length}
        </span>
      </div>
      {alerts.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>No high-risk shipments.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
          {alerts.map((s, i) => (
            <li key={s.id ?? i} style={{ marginBottom: "4px" }}>
              <strong>{s.id}</strong> — {s.origin_port} → {s.destination_port} &nbsp;
              <span style={{ color: "#c0392b", fontWeight: 600 }}>Risk: {s.risk_score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
