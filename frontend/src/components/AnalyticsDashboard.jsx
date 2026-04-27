// frontend/src/components/AnalyticsDashboard.jsx
// Full analytics page at /analytics — dark theme, cargo filter tabs, 3 Recharts charts

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useShipments } from "../hooks/useShipments";
import { NexusHeader } from "./Dashboard";

const CARGO_TYPES = ["All", "Electronics", "General", "Automotive", "Pharma", "Chemicals", "Food", "Perishables", "Textiles", "Machinery"];
const CARRIERS = ["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "Evergreen", "ONE", "Yang Ming", "HMM", "PIL"];

// ── Custom tooltip ────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   "#0f1f33",
      border:       "1px solid #1a2d47",
      borderRadius: 8,
      padding:      "0.6rem 0.9rem",
      fontSize:     "0.78rem",
      color:        "#e2e8f0",
      boxShadow:    "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#e2e8f0" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontVariantNumeric: "tabular-nums" }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function AnalyticsStatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background:   "#0f1f33",
      border:       "1px solid #1a2d47",
      borderRadius: 10,
      padding:      "1.1rem 1.3rem",
      position:     "relative",
      overflow:     "hidden",
      animation:    "fade-in 0.4s ease both",
    }}>
      {/* Top accent */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${color}cc, ${color}22)`,
      }} />
      {/* Glow blob */}
      <div style={{
        position:     "absolute",
        bottom:       -20,
        right:        -10,
        width:        70,
        height:       70,
        borderRadius: "50%",
        background:   color,
        opacity:      0.07,
        filter:       "blur(20px)",
        pointerEvents:"none",
      }} />
      <div style={{
        fontSize:   "2.1rem",
        fontWeight: 800,
        color,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.5px",
        position:   "relative",
      }}>
        {value}
      </div>
      <div style={{
        fontSize:      "0.6rem",
        letterSpacing: "1.1px",
        color:         "#64748b",
        marginTop:     4,
        textTransform: "uppercase",
        fontWeight:    700,
        position:      "relative",
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontSize:  "0.72rem",
          color:     "#94a3b8",
          marginTop: 3,
          position:  "relative",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ title, children, accentColor = "#3b82f6" }) {
  return (
    <div style={{
      background:   "#0f1f33",
      border:       "1px solid #1a2d47",
      borderRadius: 10,
      padding:      "1.1rem 1.25rem",
      position:     "relative",
      overflow:     "hidden",
    }}>
      {/* Left accent bar */}
      <div style={{
        position:     "absolute",
        top:          "1.1rem",
        left:         0,
        width:        3,
        height:       "1.2rem",
        background:   accentColor,
        borderRadius: "0 2px 2px 0",
        opacity:      0.8,
      }} />
      <h3 style={{
        margin:        "0 0 1rem",
        fontSize:      "0.82rem",
        fontWeight:    700,
        color:         "#94a3b8",
        letterSpacing: "0.3px",
        paddingLeft:   12,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { shipments } = useShipments();
  const [cargoFilter, setCargoFilter] = useState("All");

  const filtered = useMemo(() => {
    if (cargoFilter === "All") return shipments;
    return shipments.filter((s) =>
      (s.cargo_type ?? "").toLowerCase() === cargoFilter.toLowerCase()
    );
  }, [shipments, cargoFilter]);

  // Stats
  const total     = filtered.length;
  const atRisk    = filtered.filter((s) => Number(s.risk_score) > 60).length;
  const rerouting = filtered.filter((s) => s.status === "rerouting").length;
  const onTime    = filtered.filter((s) => s.status === "on_time").length;
  const onTimePct = total > 0 ? ((onTime / total) * 100).toFixed(1) : 0;

  // Cargo breakdown
  const cargoData = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      const t = s.cargo_type ?? "General";
      map[t] = (map[t] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({
        name: name.length > 12 ? name.slice(0, 11) + "…" : name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  // Risk distribution
  const riskData = useMemo(() => {
    const low  = filtered.filter((s) => Number(s.risk_score) < 40).length;
    const med  = filtered.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 60).length;
    const high = filtered.filter((s) => Number(s.risk_score) > 60).length;
    return [
      { name: "Low",    value: low,  color: "#10b981" },
      { name: "Medium", value: med,  color: "#f59e0b" },
      { name: "High",   value: high, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  // Carrier avg risk
  const carrierData = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      const c = s.carrier;
      if (!map[c]) map[c] = { sum: 0, count: 0 };
      map[c].sum   += Number(s.risk_score ?? 0);
      map[c].count += 1;
    }
    return CARRIERS
      .filter((c) => map[c]?.count > 0)
      .map((c) => ({ name: c, avg: Math.round(map[c].sum / map[c].count) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 7);
  }, [filtered]);

  return (
    <div style={{
      minHeight:  "100vh",
      display:    "flex",
      flexDirection: "column",
      background: "#060e1a",
      color:      "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <NexusHeader active="analytics" />

      <div style={{
        padding:   "1.25rem 1.6rem",
        flex:       1,
        overflowY: "auto",
      }}>
        {/* ── Page title ── */}
        <div style={{
          display:     "flex",
          alignItems:  "center",
          gap:         "1rem",
          marginBottom:"1.4rem",
        }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background:   "rgba(59,130,246,0.1)",
              color:        "#60a5fa",
              border:       "1px solid rgba(59,130,246,0.25)",
              borderRadius: 6,
              padding:      "5px 14px",
              cursor:       "pointer",
              fontSize:     "0.8rem",
              fontWeight:   600,
              transition:   "all 0.15s ease",
              letterSpacing:"0.1px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(59,130,246,0.18)";
              e.currentTarget.style.boxShadow  = "0 0 12px rgba(59,130,246,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(59,130,246,0.1)";
              e.currentTarget.style.boxShadow  = "none";
            }}
          >
            ← Dashboard
          </button>
          <div>
            <h1 style={{
              margin:        0,
              fontSize:      "1.25rem",
              fontWeight:    800,
              color:         "#e2e8f0",
              letterSpacing: "-0.3px",
            }}>
              Analytics Dashboard
            </h1>
            <p style={{
              margin:   0,
              fontSize: "0.73rem",
              color:    "#64748b",
              marginTop: 2,
            }}>
              Live fleet intelligence · {filtered.length} shipments
              {cargoFilter !== "All" && ` · ${cargoFilter}`}
            </p>
          </div>
        </div>

        {/* ── Cargo filter tabs ── */}
        <div style={{
          display:      "flex",
          gap:          "0.4rem",
          flexWrap:     "wrap",
          marginBottom: "1.4rem",
          padding:      "0.65rem",
          background:   "#0a1628",
          border:       "1px solid #142035",
          borderRadius: 10,
        }}>
          {CARGO_TYPES.map((t) => {
            const isActive = cargoFilter === t;
            return (
              <button
                key={t}
                onClick={() => setCargoFilter(t)}
                style={{
                  background:    isActive
                    ? "linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.18) 100%)"
                    : "transparent",
                  color:         isActive ? "#93c5fd" : "#64748b",
                  border:        isActive
                    ? "1px solid rgba(59,130,246,0.35)"
                    : "1px solid transparent",
                  borderRadius:  20,
                  padding:       "4px 14px",
                  fontSize:      "0.76rem",
                  fontWeight:    isActive ? 700 : 400,
                  cursor:        "pointer",
                  transition:    "all 0.15s ease",
                  boxShadow:     isActive ? "0 0 10px rgba(59,130,246,0.15)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color      = "#94a3b8";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color      = "#64748b";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* ── Stat cards ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap:                 "0.875rem",
          marginBottom:        "1.4rem",
        }}>
          {[
            {
              label: "Total Shipments",
              value: total,
              sub:   cargoFilter !== "All" ? cargoFilter : null,
              color: "#3b82f6",
            },
            {
              label: "At Risk",
              value: atRisk,
              sub:   `${total > 0 ? ((atRisk / total) * 100).toFixed(1) : 0}% of fleet`,
              color: "#ef4444",
            },
            {
              label: "Rerouting",
              value: rerouting,
              sub:   null,
              color: "#f59e0b",
            },
            {
              label: "On-Time Rate",
              value: `${onTimePct}%`,
              sub:   "last 24 h",
              color: "#10b981",
            },
          ].map((s) => (
            <AnalyticsStatCard key={s.label} {...s} />
          ))}
        </div>

        {/* ── Charts row ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap:                 "1rem",
        }}>
          {/* Cargo Breakdown */}
          <ChartCard title="Cargo Breakdown" accentColor="#3b82f6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={cargoData}
                margin={{ top: 4, right: 8, bottom: 20, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#142035"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#64748b", fontFamily: "Inter, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  name="Count"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Risk Distribution donut */}
          <ChartCard title="Risk Distribution" accentColor="#ef4444">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={78}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {riskData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  formatter={(v, e) => (
                    <span style={{
                      color:    e.color,
                      fontSize: "0.73rem",
                      fontFamily: "Inter, sans-serif",
                    }}>
                      {v} · {Math.round((e.payload.value / (total || 1)) * 100)}%
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top Risk Carriers */}
          <ChartCard title="Top Risk Carriers" accentColor="#f59e0b">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={carrierData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#142035"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar
                  dataKey="avg"
                  name="Avg Risk"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={14}
                >
                  {carrierData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.avg > 60 ? "#ef4444"
                        : entry.avg > 40 ? "#f59e0b"
                        : "#10b981"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
