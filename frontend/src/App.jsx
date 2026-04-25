import React, { useState, useEffect, useCallback, useRef } from "react";
import { useShipments } from "./hooks/useShipments";
import StatsBar from "./components/StatsBar";
import AlertPanel from "./components/AlertPanel";
import DisruptionButton from "./components/DisruptionButton";
import RerouteModal from "./components/RerouteModal";
import MapView from "./components/MapView";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

/**
 * App — root component for NexusFlow dashboard.
 *
 * Connects to backend WebSocket for live score updates.
 * Shows map placeholder, stats bar, alert panel, and disruption controls.
 */
export default function App() {
  const { shipments: initialShipments, loading, error, refetch } = useShipments();
  const [shipments, setShipments] = useState([]);
  const [rerouteTarget, setRerouteTarget] = useState(null);
  const wsRef = useRef(null);

  // Sync initial load
  useEffect(() => {
    if (initialShipments.length > 0) {
      setShipments(initialShipments);
    }
  }, [initialShipments]);

  // ─── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    let ws;
    let reconnectTimer;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected to", WS_URL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "score_update" && msg.shipment_id) {
            setShipments((prev) =>
              prev.map((s) =>
                s.id === msg.shipment_id
                  ? { ...s, risk_score: msg.score, status: msg.status || s.status }
                  : s
              )
            );
          }
        } catch {
          // ignore non-JSON or malformed messages
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected. Reconnecting in 3s...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn("[WS] Error:", err);
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const handleViewReroute = useCallback((shipment) => {
    setRerouteTarget(shipment);
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p>Loading NexusFlow...</p>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>NexusFlow</h1>
        <span style={styles.subtitle}>
          Predictive Supply Chain Intelligence
        </span>
      </header>

      {/* Stats Bar */}
      <div style={styles.statsWrapper}>
        <StatsBar shipments={shipments} />
      </div>

      {/* Main layout */}
      <div style={styles.main}>
        {/* Live Leaflet map — pins coloured by risk score, click at-risk ports to reroute */}
        <div style={styles.mapArea}>
          <MapView shipments={shipments} onViewReroute={handleViewReroute} />
        </div>

        {/* Right sidebar */}
        <div style={styles.sidebar}>
          {/* Disruption controls */}
          <div style={{ marginBottom: 12 }}>
            <DisruptionButton />
          </div>

          {/* Alert panel */}
          <AlertPanel
            shipments={shipments}
            onViewReroute={handleViewReroute}
          />
        </div>
      </div>

      {/* Reroute Modal */}
      <RerouteModal
        shipment={rerouteTarget}
        onClose={() => setRerouteTarget(null)}
      />

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          Backend unavailable — showing cached data. {error}
        </div>
      )}
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    padding: "12px 20px",
    background: "#0d1520",
    borderBottom: "1px solid #1e293b",
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: "#60a5fa",
    margin: 0,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  statsWrapper: {
    padding: "8px 20px",
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    padding: "0 20px 12px",
    gap: 16,
  },
  mapArea: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    background: "#0d1b2a",
    border: "1px solid #1e293b",
  },
  mapPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#475569",
  },
  sidebar: {
    width: 320,
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflowY: "auto",
  },
  loadingScreen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: 16,
    color: "#94a3b8",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #334155",
    borderTop: "3px solid #60a5fa",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBanner: {
    padding: "8px 20px",
    background: "#7f1d1d",
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
  },
};
