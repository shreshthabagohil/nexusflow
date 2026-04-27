import { useState } from "react";
import { useNavigate } from "react-router-dom";

function riskColor(score) {
  if (score > 70) return "#EF4444";
  if (score > 40) return "#F59E0B";
  return "#10B981";
}

export default function ShipmentList({ shipments, onSelectShipment }) {
  const [sortDesc, setSortDesc] = useState(false);
  const navigate = useNavigate();

  if (!shipments || shipments.length === 0) {
    return <p style={{ padding: "1rem", color: "#64748b" }}>Loading shipments...</p>;
  }

  const sorted = sortDesc
    ? [...shipments].sort((a, b) => b.risk_score - a.risk_score)
    : shipments;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
      <thead>
        <tr style={{ background: "#1A2B4A", color: "#fff" }}>
          <th style={th}>ID</th>
          <th style={th}>Origin</th>
          <th style={th}>Destination</th>
          <th style={th}>Carrier</th>
          <th style={th}>Status</th>
          <th style={th}>ETA</th>
          <th style={{ ...th, whiteSpace: "nowrap" }}>
            Risk Score{" "}
            <button
              onClick={() => setSortDesc((prev) => !prev)}
              style={{
                marginLeft: 6,
                padding: "2px 7px",
                fontSize: "0.75rem",
                background: sortDesc ? "#F59E0B" : "#334e77",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {sortDesc ? "▼ Sorted" : "Sort ▼"}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s, i) => (
          <tr
            key={s.id ?? i}
            onClick={() => navigate(`/shipments/${s.id}`)}
            style={{
              background: i % 2 === 0 ? "#fff" : "#f7f9fc",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f0fe")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f7f9fc")
            }
          >
            <td style={td}>{s.id}</td>
            <td style={td}>{s.origin_port}</td>
            <td style={td}>{s.destination_port}</td>
            <td style={td}>{s.carrier}</td>
            <td style={td}>{s.status}</td>
            <td style={td}>{s.eta}</td>
            <td style={{ ...td, color: riskColor(s.risk_score), fontWeight: 600 }}>
              {s.risk_score}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = { padding: "8px 12px", textAlign: "left", fontWeight: 600 };
const td = { padding: "7px 12px", borderBottom: "1px solid #e8edf3" };
