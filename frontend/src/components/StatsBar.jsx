import { useState, useEffect } from "react";
import { getAnalytics } from "../services/api";

export default function StatsBar() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getAnalytics().then(setData);
  }, []);

  const metrics = [
    {
      label: "Total Shipments",
      value: data?.total ?? "—",
      accent: "#1A2B4A",
      icon: "🚢",
    },
    {
      label: "At Risk",
      value: data?.at_risk ?? "—",
      accent: "#EF4444",
      icon: "⚠️",
    },
    {
      label: "Rerouting",
      value: data?.rerouting ?? "—",
      accent: "#F59E0B",
      icon: "🔄",
    },
    {
      label: "On-Time Rate",
      value: data ? `${data.on_time_pct}%` : "—",
      accent: "#10B981",
      icon: "✅",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "0.875rem",
      marginBottom: "1rem",
    }}>
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            background: "#fff",
            borderRadius: 10,
            padding: "1rem 1.25rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            borderLeft: `4px solid ${m.accent}`,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
            <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>{m.label}</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: m.accent, lineHeight: 1.1 }}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}
