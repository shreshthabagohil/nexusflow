// frontend/src/components/RerouteModal.jsx
export default function RerouteModal({ shipment, onClose }) {
  if (!shipment) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          padding: "2rem",
          minWidth: "320px",
          maxWidth: "480px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 1rem", color: "#1A2B4A", fontSize: "1.1rem" }}>
          Reroute Shipment
        </h2>
        <dl style={{ margin: "0 0 1.5rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
          <dt style={dtStyle}>ID</dt>
          <dd style={ddStyle}>{shipment.id}</dd>
          <dt style={dtStyle}>Origin</dt>
          <dd style={ddStyle}>{shipment.origin_port}</dd>
          <dt style={dtStyle}>Destination</dt>
          <dd style={ddStyle}>{shipment.destination_port}</dd>
        </dl>
        <button
          onClick={onClose}
          style={{
            background: "#1A2B4A",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem 1.25rem",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

const dtStyle = { fontWeight: 600, color: "#555", fontSize: "0.875rem", margin: 0 };
const ddStyle = { margin: 0, color: "#1A2B4A", fontSize: "0.875rem" };
