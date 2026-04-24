import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useShipments } from "../hooks/useShipments";
import { useWebSocket } from "../hooks/useWebSocket";
import StatsBar from "./StatsBar";
import ShipmentList from "./ShipmentList";
import MapView from "./MapView";
import AlertPanel from "./AlertPanel";
import DisruptionButton from "./DisruptionButton";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";

export default function Dashboard() {
  const navigate = useNavigate();
  const { shipments, loading, error, refetch } = useShipments();
  const { connected, reconnecting, lastMessage } = useWebSocket(WS_URL);

  // Debounce-refetch when a score_update arrives from the Faust worker
  const refetchTimer = useRef(null);
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "score_update") {
      // Debounce: if many updates arrive in quick succession, only refetch once
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => refetch(), 800);
    }
  }, [lastMessage, refetch]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: "#1A2B4A",
        color: "#fff",
        padding: "0 1.5rem",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.3px" }}>
            ⚓ NexusFlow
          </span>
          <span style={{
            fontSize: "0.72rem",
            background: "rgba(255,255,255,0.12)",
            padding: "2px 9px",
            borderRadius: 12,
            fontWeight: 500,
            letterSpacing: "0.3px",
          }}>
            Predictive Supply Chain Intelligence
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <DisruptionButton />
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", opacity: 0.9 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", display: "inline-block",
              background: connected ? "#10B981" : reconnecting ? "#F59E0B" : "#EF4444",
              boxShadow: connected ? "0 0 5px #10B981" : "none",
            }} />
            {connected ? "Live" : reconnecting ? "Reconnecting…" : "Disconnected"}
          </div>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────── */}
      <main style={{ padding: "1.25rem 1.5rem", maxWidth: 1400, margin: "0 auto" }}>

        {/* Stats row */}
        <StatsBar />

        {/* List + Map */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "1rem",
          marginBottom: "1rem",
        }}>
          {/* Shipment list card */}
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{
              padding: "0.7rem 1rem",
              borderBottom: "1px solid #e8edf3",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1A2B4A" }}>
                Shipments{shipments.length > 0 ? ` (${shipments.length})` : ""}
              </h2>
              <button
                onClick={refetch}
                style={{
                  fontSize: "0.78rem",
                  background: "none",
                  border: "1px solid #e0e7ef",
                  borderRadius: 5,
                  padding: "3px 10px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ↻ Refresh
              </button>
            </div>

            {loading ? (
              <p style={{ padding: "2rem", color: "#64748b", textAlign: "center", margin: 0 }}>
                Loading shipments…
              </p>
            ) : error ? (
              <p style={{ padding: "2rem", color: "#EF4444", textAlign: "center", margin: 0 }}>
                {error}
              </p>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <ShipmentList
                  shipments={shipments}
                  onSelectShipment={(s) => navigate(`/shipments/${s.id}`)}
                />
              </div>
            )}
          </div>

          {/* Map card */}
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "0.7rem 1rem", borderBottom: "1px solid #e8edf3" }}>
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1A2B4A" }}>
                Live Route Map
              </h2>
            </div>
            <div style={{ height: 370 }}>
              <MapView shipments={shipments} />
            </div>
          </div>
        </div>

        {/* Alert panel */}
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "1rem 1.25rem" }}>
          <AlertPanel shipments={shipments} />
        </div>
      </main>
    </div>
  );
}
