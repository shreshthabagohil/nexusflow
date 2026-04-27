// frontend/src/components/AnalyticsPanel.jsx
// Fleet-wide analytics: risk zone summary + carrier risk bar chart (Recharts).

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from "recharts";

const CARRIERS = ["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "Evergreen", "ONE", "Yang Ming"];

function buildCarrierStats(shipments) {
  const map = {};
  for (const carrier of CARRIERS) {
    map[carrier] = { total: 0, riskSum: 0 };
  }
  for (const s of shipments) {
    const c = s.carrier;
    if (!map[c]) map[c] = { total: 0, riskSum: 0 };
    map[c].total   += 1;
    map[c].riskSum += Number(s.risk_score ?? 0);
  }
  return CARRIERS
    .filter((c) => map[c].total > 0)
    .map((c) => ({
      name:    c.length > 10 ? c.slice(0, 9) + "…" : c,
      fullName: c,
      avgRisk: map[c].total > 0 ? Math.round(map[c].riskSum / map[c].total) : 0,
      count:   map[c].total,
    }))
    .sort((a, b) => b.avgRisk - a.avgRisk);
}

function barColor(avgRisk) {
  if (avgRisk > 70) return "#EF4444";
  if (avgRisk > 40) return "#F59E0B";
  return "#10B981";
}

// ── Risk Zone Summary ─────────────────────────────────────────────────────────
function RiskZoneSummary({ green, yellow, red }) {
  const total = green + yellow + red || 1;
  const zones = [
    { label: "Low Risk",    count: green,  color: "#10B981", bg: "#d1fae5", range: "< 40" },
    { label: "Medium Risk", count: yellow, color: "#F59E0B", bg: "#fef3c7", range: "40–70" },
    { label: "High Risk",   count: red,    color: "#EF4444", bg: "#fee2e2", range: "> 70" },
  ];

  return (
    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
      {zones.map((z) => (
        <div
          key={z.label}
          style={{
            flex: "1 1 120px",
            background: z.bg,
            border: `1px solid ${z.color}30`,
            borderRadius: 10,
            padding: "0.8rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: z.color, fontWeight: 600 }}>{z.label}</span>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Score {z.range}</span>
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: z.color, lineHeight: 1.1 }}>
            {z.count}
          </div>
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((z.count / total) * 100)}%`, background: z.color, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
            {Math.round((z.count / total) * 100)}% of fleet
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.6rem 0.9rem", fontSize: "0.82rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 700, color: "#1A2B4A", marginBottom: 4 }}>{d.fullName}</div>
      <div style={{ color: "#64748b" }}>Avg risk: <strong style={{ color: barColor(d.avgRisk) }}>{d.avgRisk}</strong></div>
      <div style={{ color: "#64748b" }}>Shipments: <strong>{d.count}</strong></div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsPanel({ shipments = [] }) {
  if (!shipments || shipments.length === 0) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
        Loading analytics…
      </div>
    );
  }

  const green  = shipments.filter((s) => Number(s.risk_score) < 40).length;
  const yellow = shipments.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 70).length;
  const red    = shipments.filter((s) => Number(s.risk_score) > 70).length;

  const carrierData = buildCarrierStats(shipments);

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#1A2B4A", fontWeight: 700 }}>
          📊 Fleet Analytics
        </h3>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
          {shipments.length} shipments
        </span>
      </div>

      {/* Risk zone summary chips */}
      <RiskZoneSummary green={green} yellow={yellow} red={red} />

      {/* Carrier risk bar chart */}
      <div>
        <p style={{ margin: "0 0 0.6rem", fontSize: "0.82rem", color: "#64748b", fontWeight: 500 }}>
          Average Risk Score by Carrier
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={carrierData} margin={{ top: 4, right: 16, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="avgRisk" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {carrierData.map((entry, idx) => (
                <Cell key={idx} fill={barColor(entry.avgRisk)} />
              ))}
              <LabelList
                dataKey="avgRisk"
                position="top"
                style={{ fontSize: 10, fill: "#64748b" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
