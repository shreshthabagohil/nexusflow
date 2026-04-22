// frontend/src/components/ShipmentList.jsx
export default function ShipmentList({ shipments = [] }) {
  if (shipments.length === 0) {
    return <p>No shipments loaded yet.</p>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
      <thead>
        <tr style={{ background: "#1A2B4A", color: "#fff" }}>
          <th style={th}>ID</th>
          <th style={th}>Origin</th>
          <th style={th}>Destination</th>
          <th style={th}>Carrier</th>
          <th style={th}>ETA</th>
          <th style={th}>Risk Score</th>
        </tr>
      </thead>
      <tbody>
        {shipments.map((s, i) => (
          <tr key={s.id ?? i} style={{ background: i % 2 === 0 ? "#fff" : "#f7f9fc" }}>
            <td style={td}>{s.id}</td>
            <td style={td}>{s.origin}</td>
            <td style={td}>{s.destination}</td>
            <td style={td}>{s.carrier}</td>
            <td style={td}>{s.eta}</td>
            <td style={{ ...td, color: s.risk_score > 40 ? "#c0392b" : "#27ae60", fontWeight: 600 }}>
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
