// frontend/src/App.jsx
import { useState } from "react";
import { useShipments } from "./hooks/useShipments";
import MapView from "./components/MapView";
import ShipmentList from "./components/ShipmentList";
import AlertPanel from "./components/AlertPanel";
import StatsBar from "./components/StatsBar";
import RerouteModal from "./components/RerouteModal";
import DisruptionButton from "./components/DisruptionButton";

export default function App() {
  const { shipments, loading, error } = useShipments();

  // In App.jsx, add state for selected shipment:
const [selectedShipment, setSelectedShipment] = useState(null);

  // Derive basic analytics from shipments
  const analytics = {
    total: shipments.length,
    at_risk: shipments.filter((s) => s.risk_score > 40).length,
    rerouting: shipments.filter((s) => s.status === "rerouting").length,
    on_time_pct:
      shipments.length > 0
        ? Math.round(
            (shipments.filter((s) => s.status === "on_time").length / shipments.length) * 100
          )
        : 100,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", fontFamily: "sans-serif" }}>
      {/* Header */}
      <header
        style={{
          background: "#1A2B4A",
          color: "#fff",
          padding: "0 1.5rem",
          height: "56px",
          display: "flex",
          alignItems: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, letterSpacing: "0.04em" }}>
          NexusFlow
        </h1>
      </header>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: "1rem",
          padding: "1rem",
          height: "calc(100vh - 56px)",
          boxSizing: "border-box",
        }}
      >
        {/* Left panel */}
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            overflowY: "auto",
          }}
        >
          <AlertPanel shipments={shipments} />
          <StatsBar analytics={analytics} />
          <DisruptionButton />

          <div style={{ marginTop: "0.5rem" }}>
            {loading && <p style={{ color: "#666" }}>Loading shipments…</p>}
            {error && <p style={{ color: "#c0392b" }}>{error}</p>}
            {!loading && !error && (
              <ShipmentList shipments={shipments} onSelectShipment={setSelectedShipment} />
            )}
          </div>
        </aside>

        {/* Right panel — map */}
        <main
          style={{
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
<MapView shipments={shipments} />
        </main>
      </div>

      {/* Reroute modal overlay */}
      <RerouteModal shipment={selectedShipment} onClose={() => setSelectedShipment(null)} />
    </div>
  );
  
}
