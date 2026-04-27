import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShipment } from "../services/api";
import RerouteModal from "./RerouteModal";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

function riskColor(score) {
  if (score > 70) return "#EF4444";
  if (score > 40) return "#F59E0B";
  return "#10B981";
}

function riskLabel(score) {
  if (score > 70) return "High Risk";
  if (score > 40) return "Medium Risk";
  return "Low Risk";
}

function FeatureBar({ label, value, max = 1, unit = "", color = "#1A2B4A" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{label}</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color }}>
          {typeof value === "number" ? value.toFixed(value < 10 ? 2 : 0) : value}{unit}
        </span>
      </div>
      <div style={{ height: 6, background: "#f0f4f8", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #f0f4f8" }}>
      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1A2B4A", textAlign: "right", maxWidth: "55%" }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    on_time:   { bg: "#d1fae5", text: "#065f46" },
    delayed:   { bg: "#fef3c7", text: "#92400e" },
    at_risk:   { bg: "#fee2e2", text: "#991b1b" },
    rerouting: { bg: "#ede9fe", text: "#4c1d95" },
  };
  const c = colors[status] ?? { bg: "#e2e8f0", text: "#1e293b" };
  return (
    <span style={{ background: c.bg, color: c.text, padding: "3px 10px", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
      {status?.replace("_", " ") ?? "unknown"}
    </span>
  );
}

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState(null);
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReroute, setShowReroute] = useState(false);

  useEffect(() => {
    setLoading(true);
    setShipment(null);
    setFeatures(null);

    Promise.all([
      getShipment(id),
      fetch(`${BACKEND_URL}/api/shipments/${id}/features`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([s, f]) => {
      setShipment(s);
      setFeatures(f);
      setLoading(false);
    });
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={centeredPage}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p style={{ color: "#64748b", margin: 0 }}>Loading shipment {id}…</p>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!shipment) {
    return (
      <div style={centeredPage}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
          <p style={{ color: "#EF4444", fontWeight: 600, marginBottom: "1rem" }}>
            Shipment "{id}" not found
          </p>
          <button onClick={() => navigate("/")} style={backBtnStyle}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const riskScore = Number(shipment.risk_score ?? 0);
  const formattedEta = shipment.eta
    ? new Date(shipment.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

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
        gap: "1rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          ← Dashboard
        </button>
        <span style={{ fontSize: "1.05rem", fontWeight: 700 }}>Shipment {id}</span>
        <StatusBadge status={shipment.status} />
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>

        {/* Why this score — SHAP risk factors (full width, above the cards) */}
        {shipment.top_risk_factors?.length > 0 && (
          <div style={{
            background: "#fff",
            borderRadius: 10,
            padding: "1rem 1.25rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            marginBottom: "1rem",
            borderLeft: `4px solid ${riskColor(riskScore)}`,
          }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#1A2B4A" }}>
              🤖 Why this risk score?
            </h2>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {shipment.top_risk_factors.map((rf, i) => {
                const isIncrease = rf.direction === "increase";
                const abs = Math.abs(rf.contribution).toFixed(2);
                return (
                  <div key={i} style={{
                    flex: "1 1 240px",
                    background: isIncrease ? "#fff5f5" : "#f0fdf4",
                    border: `1px solid ${isIncrease ? "#fecaca" : "#bbf7d0"}`,
                    borderRadius: 8,
                    padding: "0.6rem 0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}>
                    <span style={{ fontSize: "1.2rem" }}>{isIncrease ? "⬆️" : "⬇️"}</span>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: isIncrease ? "#991b1b" : "#065f46" }}>
                        {rf.factor}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 1 }}>
                        {isIncrease ? "Increasing" : "Reducing"} risk · SHAP {abs}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

          {/* Left: shipment details */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1A2B4A" }}>Shipment Details</h2>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: riskColor(riskScore), lineHeight: 1 }}>
                  {riskScore}
                </div>
                <div style={{ fontSize: "0.72rem", color: riskColor(riskScore), fontWeight: 600 }}>
                  {riskLabel(riskScore)}
                </div>
              </div>
            </div>

            <DetailRow label="Origin Port" value={shipment.origin_port} />
            <DetailRow label="Destination Port" value={shipment.destination_port} />
            <DetailRow label="Carrier" value={shipment.carrier} />
            <DetailRow label="Cargo Type" value={shipment.cargo_type || "—"} />
            <DetailRow label="ETA" value={formattedEta} />
            <DetailRow label="Departure" value={shipment.departure_date || "—"} />
            <DetailRow
              label="Position"
              value={shipment.current_lat != null
                ? `${Number(shipment.current_lat).toFixed(3)}°, ${Number(shipment.current_lng).toFixed(3)}°`
                : "—"}
            />

            <button
              onClick={() => setShowReroute(true)}
              style={{
                marginTop: "1.25rem",
                width: "100%",
                background: "#1A2B4A",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                padding: "0.65rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
                letterSpacing: "0.3px",
              }}
            >
              🔄 Reroute Shipment
            </button>
          </div>

          {/* Right: ML feature vector */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <h2 style={{ margin: "0 0 1.1rem", fontSize: "1rem", fontWeight: 700, color: "#1A2B4A" }}>
              ML Feature Vector
            </h2>

            {features ? (
              <>
                <FeatureBar label="Weather Severity" value={features.weather_severity} max={1} unit=" / 1.0" color="#F59E0B" />
                <FeatureBar label="Origin Congestion" value={features.origin_congestion} max={1} unit=" / 1.0" color="#EF4444" />
                <FeatureBar label="Dest. Congestion" value={features.dest_congestion} max={1} unit=" / 1.0" color="#EF4444" />
                <FeatureBar label="Carrier On-Time Rate" value={features.carrier_ontime_rate} max={1} unit=" / 1.0" color="#10B981" />
                <FeatureBar label="Cargo Priority" value={features.cargo_priority_weight} max={10} unit=" / 10" color="#1A2B4A" />
                <FeatureBar label="Days Until ETA" value={features.days_until_eta} max={60} unit=" days" color="#6366f1" />
                <div style={{ marginTop: "0.25rem", padding: "0.6rem 0.75rem", background: "#f8fafc", borderRadius: 7, border: "1px solid #e8edf3" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Route Distance</span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1A2B4A" }}>
                      {features.route_distance_km.toFixed(0).toLocaleString()} km
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "1.5rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🤖</div>
                <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
                  Feature vector unavailable.<br />ML engine is initialising.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showReroute && (
        <RerouteModal shipment={shipment} onClose={() => setShowReroute(false)} />
      )}
    </div>
  );
}

const centeredPage = {
  minHeight: "100vh",
  background: "#f0f4f8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
};

const backBtnStyle = {
  background: "#1A2B4A",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  padding: "0.6rem 1.25rem",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 600,
};
