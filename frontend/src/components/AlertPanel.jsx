// frontend/src/components/AlertPanel.jsx
import { useNavigate } from "react-router-dom";

function riskBadge(score) {
  if (score > 70) return { bg: "#fee2e2", text: "#991b1b", label: "HIGH" };
  if (score > 40) return { bg: "#fef3c7", text: "#92400e", label: "MED" };
  return { bg: "#d1fae5", text: "#065f46", label: "LOW" };
}

export default function AlertPanel({ shipments = [] }) {
  const navigate = useNavigate();

  // Show top 10 highest-risk shipments (risk > 70 = P0, else > 40)
  const alerts = [...shipments]
    .filter((s) => Number(s.risk_score) > 40)
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score))
    .slice(0, 10);

  const highCount = shipments.filter((s) => Number(s.risk_score) > 70).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#1A2B4A", fontWeight: 700 }}>
          🚨 High-Risk Alerts
        </h3>
        {highCount > 0 && (
          <span style={{ background: "#EF4444", color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: "0.75rem", fontWeight: 700 }}>
            {highCount} critical
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
          ✅ No high-risk shipments detected.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 280, overflowY: "auto" }}>
          {alerts.map((s, i) => {
            const badge = riskBadge(Number(s.risk_score));
            return (
              <button
                key={s.id ?? i}
                onClick={() => navigate(`/shipments/${s.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: "#fafafa",
                  border: "1px solid #f0f4f8",
                  borderRadius: 8,
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fafafa")}
              >
                {/* Risk badge */}
                <span style={{ background: badge.bg, color: badge.text, borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, minWidth: 38, textAlign: "center" }}>
                  {badge.label}
                </span>
                {/* Score */}
                <span style={{ fontWeight: 700, color: badge.text, fontSize: "0.9rem", minWidth: 28 }}>
                  {s.risk_score}
                </span>
                {/* Route */}
                <span style={{ fontSize: "0.82rem", color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong>{s.id}</strong> · {s.origin_port} → {s.destination_port}
                </span>
                {/* Carrier */}
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", flexShrink: 0 }}>
                  {s.carrier}
                </span>
                <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>›</span>
              </button>
            );
          })}
        </div>
      )}
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
