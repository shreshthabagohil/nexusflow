import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

function riskColor(score) {
  if (score >= 70) return "#EF4444";
  if (score >= 40) return "#F59E0B";
  return "#10B981";
}

export default function MapView({ shipments }) {
  if (!shipments || shipments.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          background: "#f0f4f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#64748b", fontSize: "0.95rem" }}>Loading map data...</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {shipments.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.current_lat, s.current_lng]}
          radius={8}
          pathOptions={{
            color: riskColor(s.risk_score),
            fillColor: riskColor(s.risk_score),
            fillOpacity: 0.85,
          }}
        >
          <Popup>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>
              <strong>ID:</strong> {s.id}<br />
              <strong>Carrier:</strong> {s.carrier}<br />
              <strong>Status:</strong> {s.status}<br />
              <strong>Risk Score:</strong>{" "}
              <span style={{ color: riskColor(s.risk_score), fontWeight: 600 }}>
                {s.risk_score}
              </span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
