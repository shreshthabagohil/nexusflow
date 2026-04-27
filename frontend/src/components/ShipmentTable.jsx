// frontend/src/components/ShipmentTable.jsx
// Full-width table below the map — sortable, with status & risk badges

import { useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS = {
  on_time:   { bg: "rgba(16,185,129,0.12)",  text: "#34d399", border: "rgba(16,185,129,0.25)",  label: "On Time" },
  delayed:   { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24", border: "rgba(245,158,11,0.25)",  label: "Delayed" },
  at_risk:   { bg: "rgba(239,68,68,0.12)",   text: "#f87171", border: "rgba(239,68,68,0.25)",   label: "At Risk" },
  rerouting: { bg: "rgba(59,130,246,0.12)",  text: "#60a5fa", border: "rgba(59,130,246,0.25)",  label: "Rerouting" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] ?? {
    bg: "rgba(148,163,184,0.08)", text: "#94a3b8", border: "rgba(148,163,184,0.2)", label: status
  };
  return (
    <span style={{
      background:   c.bg,
      color:        c.text,
      border:       `1px solid ${c.border}`,
      borderRadius: 4,
      padding:      "2px 9px",
      fontSize:     "0.65rem",
      fontWeight:   700,
      textTransform:"uppercase",
      letterSpacing:"0.6px",
      whiteSpace:   "nowrap",
    }}>
      {c.label}
    </span>
  );
}

function RiskBadge({ score }) {
  const s      = Number(score ?? 0);
  const color  = s > 60 ? "#f87171"  : s > 40 ? "#fbbf24" : "#34d399";
  const bgCol  = s > 60 ? "rgba(239,68,68,0.12)"  : s > 40 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)";
  const border = s > 60 ? "rgba(239,68,68,0.28)"  : s > 40 ? "rgba(245,158,11,0.28)" : "rgba(16,185,129,0.25)";
  const lbl    = s > 60 ? "H" : s > 40 ? "M" : "L";
  return (
    <span style={{
      background:  bgCol,
      color,
      border:      `1px solid ${border}`,
      borderRadius: 4,
      padding:     "2px 9px",
      fontSize:    "0.7rem",
      fontWeight:  700,
      display:     "inline-flex",
      alignItems:  "center",
      gap:         5,
      fontVariantNumeric: "tabular-nums",
      whiteSpace:  "nowrap",
    }}>
      <span style={{
        fontSize:    "0.58rem",
        letterSpacing: "0.5px",
        opacity:     0.7,
        fontWeight:  800,
      }}>
        {lbl}
      </span>
      {s.toFixed(1)}
    </span>
  );
}

// Shared cell style
const COL = {
  padding:  "5px 14px",
  fontSize: "0.77rem",
};

const TH = {
  ...COL,
  color:          "#64748b",
  fontWeight:     700,
  letterSpacing:  "0.9px",
  textTransform:  "uppercase",
  fontSize:       "0.6rem",
  userSelect:     "none",
  whiteSpace:     "nowrap",
};

// Tab button helper
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? "rgba(59,130,246,0.12)" : "transparent",
        color:        active ? "#93c5fd" : "#64748b",
        border:       active ? "1px solid rgba(59,130,246,0.28)" : "1px solid transparent",
        borderRadius: 5,
        padding:      "3px 12px",
        fontSize:     "0.73rem",
        fontWeight:   active ? 600 : 400,
        cursor:       "pointer",
        transition:   "all 0.15s ease",
        letterSpacing: "0.1px",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = "#94a3b8";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = "#64748b";
      }}
    >
      {children}
    </button>
  );
}

// searchTerm can be passed from parent (drawer) or left undefined to use no search
export default function ShipmentTable({ shipments = [], searchTerm = "", inDrawer = false }) {
  const navigate   = useNavigate();
  const [filter,   setFilter]   = useState("all");
  const [sortDesc, setSortDesc] = useState(true);

  const q = searchTerm.trim().toLowerCase();

  const filtered = shipments
    .filter((s) => {
      // risk tier filter
      if (filter === "high_risk"  && Number(s.risk_score) <= 60)  return false;
      if (filter === "rerouting"  && s.status !== "rerouting")    return false;
      if (filter === "on_time"    && s.status !== "on_time")      return false;
      // search filter
      if (q) {
        const hay = [s.id, s.origin_port, s.destination_port, s.carrier, s.cargo_type, s.status]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => sortDesc
      ? Number(b.risk_score) - Number(a.risk_score)
      : Number(a.risk_score) - Number(b.risk_score));

  const highCount     = shipments.filter((s) => Number(s.risk_score) > 60).length;
  const rerouteCount  = shipments.filter((s) => s.status === "rerouting").length;
  const onTimeCount   = shipments.filter((s) => s.status === "on_time").length;

  return (
    <div style={{
      flex:           inDrawer ? 1 : undefined,
      flexShrink:     0,
      height:         inDrawer ? undefined : "30vh",
      display:        "flex",
      flexDirection:  "column",
      background:     "#080f1c",
      borderTop:      inDrawer ? "none" : "1px solid #142035",
      overflow:       "hidden",
    }}>
      {/* ── Table toolbar ──────────────────────────────────────────────── */}
      <div style={{
        padding:        "0.45rem 1.1rem",
        display:        "flex",
        alignItems:     "center",
        gap:            8,
        borderBottom:   "1px solid #142035",
        background:     "#0a1628",
        flexShrink:     0,
        flexWrap:       "wrap",
        rowGap:         4,
      }}>
        <TabButton active={filter === "all"} onClick={() => setFilter("all")}>
          All <CountPill color="default">{shipments.length}</CountPill>
        </TabButton>

        <TabButton active={filter === "high_risk"} onClick={() => setFilter("high_risk")}>
          High Risk <CountPill color="danger">{highCount}</CountPill>
        </TabButton>

        <TabButton active={filter === "rerouting"} onClick={() => setFilter("rerouting")}>
          Rerouting <CountPill color="purple">{rerouteCount}</CountPill>
        </TabButton>

        <TabButton active={filter === "on_time"} onClick={() => setFilter("on_time")}>
          On Time <CountPill color="success">{onTimeCount}</CountPill>
        </TabButton>

        {/* Right side: match count */}
        <span style={{
          marginLeft: "auto",
          fontSize:   "0.67rem",
          color:      "#4b6280",
        }}>
          {filtered.length} shipments
        </span>
      </div>

      {/* ── Scrollable table ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{
          width:          "100%",
          borderCollapse: "collapse",
        }}>
          <thead style={{
            position:   "sticky",
            top:        0,
            background: "#0a1628",
            zIndex:     2,
            boxShadow:  "0 1px 0 #142035",
          }}>
            <tr>
              {["ID", "Origin", "Destination", "Carrier", "Cargo", "Status", "ETA"].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
              <th
                style={{ ...TH, cursor: "pointer", color: "#60a5fa", userSelect: "none" }}
                onClick={() => setSortDesc((v) => !v)}
              >
                Risk Score {sortDesc ? "↓" : "↑"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={s.id ?? i}
                onClick={() => navigate(`/shipments/${s.id}`)}
                style={{
                  cursor:       "pointer",
                  borderBottom: "1px solid #0d1829",
                  transition:   "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#0f1f33";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <td style={{
                  ...COL,
                  fontWeight:  700,
                  color:       "#94a3b8",
                  fontFamily:  "'JetBrains Mono', monospace",
                  fontSize:    "0.72rem",
                }}>
                  {s.id}
                </td>
                <td style={{ ...COL, color: "#94a3b8" }}>{s.origin_port}</td>
                <td style={{ ...COL, color: "#94a3b8" }}>{s.destination_port}</td>
                <td style={{ ...COL, color: "#94a3b8" }}>{s.carrier}</td>
                <td style={{ ...COL, color: "#64748b", fontSize: "0.72rem" }}>
                  {s.cargo_type ?? "—"}
                </td>
                <td style={COL}>
                  <StatusBadge status={s.status} />
                </td>
                <td style={{
                  ...COL,
                  color:   "#64748b",
                  fontSize: "0.7rem",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {s.eta}
                </td>
                <td style={COL}>
                  <RiskBadge score={s.risk_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{
            padding:   "3rem 2rem",
            textAlign: "center",
            color:     "#4b6280",
            fontSize:  "0.8rem",
          }}>
            {q ? `No shipments match "${searchTerm}"` : "No shipments match this filter."}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper inline component
function CountPill({ children, color }) {
  const cfg = {
    danger:  { bg: "rgba(239,68,68,0.14)",   text: "#f87171",  border: "rgba(239,68,68,0.25)"  },
    purple:  { bg: "rgba(139,92,246,0.14)",  text: "#a78bfa",  border: "rgba(139,92,246,0.25)" },
    success: { bg: "rgba(16,185,129,0.12)",  text: "#34d399",  border: "rgba(16,185,129,0.25)" },
    default: { bg: "rgba(255,255,255,0.05)", text: "#64748b",  border: "#1a2d47"               },
  }[color] ?? { bg: "rgba(255,255,255,0.05)", text: "#64748b", border: "#1a2d47" };
  return (
    <span style={{
      marginLeft:   5,
      background:   cfg.bg,
      color:        cfg.text,
      borderRadius: 3,
      padding:      "0 6px",
      fontSize:     "0.65rem",
      fontWeight:   700,
      border:       `1px solid ${cfg.border}`,
      fontVariantNumeric: "tabular-nums",
    }}>
      {children}
    </span>
  );
}
