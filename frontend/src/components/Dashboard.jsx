import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useShipments } from "../hooks/useShipments";
import { useWebSocket } from "../hooks/useWebSocket";
import { getAnalytics } from "../services/api";
import MapView from "./MapView";
import AlertsSidebar from "./AlertsSidebar";
import ShipmentTable from "./ShipmentTable";
import RerouteModal from "./RerouteModal";

const FILTER_LABELS = {
  all:       { label: "All Shipments", color: "#94a3b8" },
  critical:  { label: "Critical",      color: "#ff2d2d" },
  high:      { label: "High Risk",     color: "#ef4444" },
  medium:    { label: "Medium Risk",   color: "#f59e0b" },
  low:       { label: "Low Risk",      color: "#10b981" },
  delayed:   { label: "Delayed",       color: "#fb923c" },
  rerouting: { label: "Rerouting",     color: "#8b5cf6" },
};

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";

const FILTER_OPTIONS = [
  { key: "all",       label: "All Shipments", dot: null,      color: "#94a3b8", activeColor: "#e2e8f0" },
  { key: "critical",  label: "Critical",      dot: "#ff2d2d", color: "#ff6060", activeColor: "#ff9090" },
  { key: "high",      label: "High Risk",     dot: "#ef4444", color: "#f87171", activeColor: "#fca5a5" },
  { key: "medium",    label: "Medium",        dot: "#f59e0b", color: "#fbbf24", activeColor: "#fde68a" },
  { key: "low",       label: "Low Risk",      dot: "#10b981", color: "#34d399", activeColor: "#6ee7b7" },
  { key: "delayed",   label: "Delayed",       dot: "#fb923c", color: "#fdba74", activeColor: "#fed7aa" },
  { key: "rerouting", label: "Rerouting",     dot: "#8b5cf6", color: "#a78bfa", activeColor: "#c4b5fd" },
];

// ── Shared header ─────────────────────────────────────────────────────────────
export function NexusHeader({ active = "dashboard", connected }) {
  const navigate = useNavigate();
  return (
    <header style={{
      height: 52,
      flexShrink: 0,
      background: "linear-gradient(180deg, #102240 0%, #0d1e38 40%, #0a1628 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 1.5rem",
      borderBottom: "1px solid rgba(59,130,246,0.15)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(59,130,246,0.08), 0 8px 32px rgba(0,0,0,0.45)",
      position: "relative",
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 28, height: 28 }}>
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="12" fill="#060e1a"/>
              <line x1="21" y1="4"  x2="21" y2="60" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="32" y1="4"  x2="32" y2="60" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="43" y1="4"  x2="43" y2="60" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="4"  y1="21" x2="60" y2="21" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="4"  y1="32" x2="60" y2="32" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="4"  y1="43" x2="60" y2="43" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8"/>
              <line x1="12" y1="50" x2="27" y2="37" stroke="#94a3b8" strokeWidth="1.2" strokeOpacity="0.4"/>
              <line x1="27" y1="37" x2="37" y2="27" stroke="#94a3b8" strokeWidth="1.2" strokeOpacity="0.4"/>
              <path d="M 12,50 C 20,44 30,30 52,14" stroke="url(#hArcGrad)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <polyline points="46,12 52,14 50,20" stroke="#00d4aa" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="50" r="4"   fill="#1e3a5f" stroke="#4b6280" strokeWidth="1.2"/>
              <circle cx="27" cy="37" r="3.5" fill="#1e3a5f" stroke="#64748b" strokeWidth="1.2"/>
              <circle cx="37" cy="27" r="5"   fill="#00d4aa" fillOpacity="0.18" stroke="#00d4aa" strokeWidth="1.8"/>
              <circle cx="37" cy="27" r="2.5" fill="#00d4aa"/>
              <circle cx="52" cy="14" r="3"   fill="#1e3a5f" stroke="#00d4aa" strokeWidth="1.4" strokeOpacity="0.6"/>
              <circle cx="37" cy="27" r="8"   fill="#00d4aa" fillOpacity="0.06"/>
              <defs>
                <linearGradient id="hArcGrad" x1="12" y1="50" x2="52" y2="14" gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.6"/>
                  <stop offset="60%"  stopColor="#00d4aa"/>
                  <stop offset="100%" stopColor="#00d4aa"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span style={{
            fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.4px",
            color: "#e2e8f0", textShadow: "0 0 20px rgba(96,165,250,0.25)",
          }}>
            Nexus<span style={{ color: "#60a5fa", textShadow: "0 0 16px rgba(96,165,250,0.5)" }}>Flow</span>
          </span>
        </div>
        <div style={{ height: 16, width: 1, background: "#1a2d47", marginRight: 2 }} />
        <span style={{ fontSize: "0.7rem", color: "#4b6280", fontWeight: 400, letterSpacing: "0.2px" }}>
          Predictive Supply Chain Intelligence
        </span>
      </div>

      {/* Nav + live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {connected !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: connected ? "#10b981" : "#4b6280",
              display: "inline-block", flexShrink: 0,
              animation: connected ? "pulse-glow 2s ease infinite" : "none",
            }} />
            <span style={{
              fontSize: "0.65rem",
              color: connected ? "#34d399" : "#64748b",
              fontWeight: 500, letterSpacing: "0.5px",
            }}>
              {connected ? "LIVE" : "DEMO"}
            </span>
          </div>
        )}
        <nav style={{ display: "flex", gap: 2 }}>
          {[{ label: "Dashboard", path: "/" }, { label: "Analytics", path: "/analytics" }].map(({ label, path }) => {
            const isActive = active === label.toLowerCase();
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                style={{
                  background: isActive ? "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.12) 100%)" : "transparent",
                  color: isActive ? "#93c5fd" : "#4b6280",
                  border: isActive ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                  borderRadius: 6, padding: "5px 16px", fontSize: "0.8rem",
                  fontWeight: isActive ? 600 : 400, cursor: "pointer",
                  transition: "all 0.15s ease", position: "relative", letterSpacing: "0.1px",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "#4b6280"; e.currentTarget.style.background = "transparent"; }}}
              >
                {label}
                {isActive && (
                  <span style={{
                    position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)",
                    width: 20, height: 2, background: "linear-gradient(90deg, #60a5fa, #3b82f6)",
                    borderRadius: 2, boxShadow: "0 0 6px rgba(96,165,250,0.6)",
                  }} />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, isLast }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.85rem 1.6rem",
        borderRight: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: hov
          ? `linear-gradient(145deg, ${color}09 0%, rgba(255,255,255,0.015) 100%)`
          : "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 60%)",
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 2, position: "relative", overflow: "hidden",
        transition: "background 0.25s ease",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055), inset 0 -1px 0 rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}ee 0%, ${color}55 60%, transparent 100%)` }} />
      <div style={{ position: "absolute", top: -24, right: -12, width: 80, height: 80, borderRadius: "50%", background: color, opacity: 0.09, filter: "blur(22px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${color}33, transparent)` }} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, position: "relative" }}>
        <span style={{
          fontSize: "1.65rem", fontWeight: 800, color,
          lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.6px",
          textShadow: `0 0 28px ${color}55, 0 0 12px ${color}33, 0 2px 4px rgba(0,0,0,0.6)`,
          animation: "count-up 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}>
          {value}
        </span>
        {sub && <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 400, marginBottom: 2 }}>{sub}</span>}
      </div>
      <span style={{ fontSize: "0.58rem", color: "#4b6280", letterSpacing: "1.1px", textTransform: "uppercase", fontWeight: 700, position: "relative" }}>
        {label}
      </span>
    </div>
  );
}

// ── Left filter panel ─────────────────────────────────────────────────────────
function LeftFilterPanel({ riskFilter, onFilterChange, tierCounts }) {
  return (
    <div style={{
      width: 168,
      flexShrink: 0,
      background: "linear-gradient(180deg, #0a1829 0%, #080f1e 100%)",
      borderRight: "1px solid rgba(255,255,255,0.05)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "6px 0 24px rgba(0,0,0,0.25), inset -1px 0 0 rgba(255,255,255,0.03)",
    }}>
      {/* Map Filter section */}
      <div style={{ padding: "0.9rem 0.8rem 0.7rem", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <div style={{ fontSize: "0.53rem", color: "#3b5070", letterSpacing: "1.4px", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.65rem" }}>
          Map Filter
        </div>
        {FILTER_OPTIONS.map((f) => {
          const active = riskFilter === f.key;
          const count = f.key === "critical"  ? tierCounts.critical
                      : f.key === "high"      ? tierCounts.high
                      : f.key === "medium"    ? tierCounts.medium
                      : f.key === "low"       ? tierCounts.low
                      : f.key === "delayed"   ? tierCounts.delayed
                      : f.key === "rerouting" ? tierCounts.rerouting
                      : null;
          const accent = f.dot || "#94a3b8";
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: active
                  ? `linear-gradient(105deg, ${accent}16 0%, ${accent}06 100%)`
                  : "transparent",
                border: "1px solid transparent",
                borderLeft: active ? `3px solid ${accent}` : "3px solid transparent",
                borderRadius: "0 6px 6px 0",
                padding: "0.44rem 0.6rem 0.44rem 0.5rem",
                marginBottom: 2,
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "left",
                boxShadow: active ? `inset 0 1px 0 ${accent}18, 0 2px 8px ${accent}12` : "none",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = `${accent}0a`;
                  e.currentTarget.style.borderLeftColor = `${accent}55`;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderLeftColor = "transparent";
                }
              }}
            >
              {/* Glowing dot */}
              <span style={{
                width: active ? 8 : 6,
                height: active ? 8 : 6,
                borderRadius: "50%",
                background: active ? accent : (f.dot || "#2a3f5a"),
                flexShrink: 0,
                boxShadow: active ? `0 0 10px ${accent}cc, 0 0 4px ${accent}` : "none",
                transition: "all 0.18s",
              }} />

              {/* Label */}
              <span style={{
                flex: 1,
                fontSize: "0.74rem",
                fontWeight: active ? 700 : 400,
                color: active ? (f.activeColor || "#e2e8f0") : "#64748b",
                letterSpacing: active ? "0.05px" : "0.1px",
                transition: "color 0.15s, font-weight 0.1s",
              }}>
                {f.label}
              </span>

              {/* Count badge */}
              {count !== null && (
                <span style={{
                  background:   active ? `${accent}28` : "rgba(255,255,255,0.04)",
                  color:        active ? accent         : "#3b5070",
                  border:       `1px solid ${active ? accent + "44" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 4,
                  padding:      "0 6px",
                  fontSize:     "0.6rem",
                  fontWeight:   700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight:   "1.8",
                  transition:   "all 0.15s",
                  boxShadow:    active ? `0 0 6px ${accent}44` : "none",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Risk Scale legend — now with Critical tier */}
      <div style={{ marginTop: "auto", padding: "0.7rem 0.8rem", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ fontSize: "0.52rem", color: "#3b5070", letterSpacing: "1.1px", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem" }}>
          Risk Scale
        </div>
        {[
          { color: "#10b981", label: "< 40 · Low"      },
          { color: "#f59e0b", label: "40–60 · Watch"   },
          { color: "#ef4444", label: "61–90 · High"    },
          { color: "#ff2d2d", label: "> 90 · Critical"  },
          { color: "#fb923c", label: "Delayed status"  },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color, flexShrink: 0, boxShadow: `0 0 5px ${l.color}66` }} />
            <span style={{ fontSize: "0.63rem", color: "#4b6280" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bottom activity timeline ───────────────────────────────────────────────────
function BottomTimeline({ shipments, riskFilter, onShowTable }) {

  // Pool is determined by the current map filter — strip mirrors the map
  const events = useMemo(() => {
    if (!shipments?.length) return [];
    let pool;
    switch (riskFilter) {
      case "critical": pool = shipments.filter((s) => Number(s.risk_score) > 90); break;
      case "high":     pool = shipments.filter((s) => Number(s.risk_score) > 60 && Number(s.risk_score) <= 90); break;
      case "medium":   pool = shipments.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 60); break;
      case "low":      pool = shipments.filter((s) => Number(s.risk_score) < 40); break;
      case "delayed":   pool = shipments.filter((s) => s.status === "delayed"); break;
      case "rerouting": pool = shipments.filter((s) => s.status === "rerouting"); break;
      default:          pool = shipments.filter((s) => Number(s.risk_score) > 90); // "all" → show critical
    }
    return [...pool]
      .sort((a, b) => Number(b.risk_score) - Number(a.risk_score))
      .map((s) => {
        const score = Number(s.risk_score);
        const isDelayed = s.status === "delayed";
        return {
          id:      s.id,
          color:   score > 90 ? "#ff2d2d" : score > 60 ? "#ef4444" : score > 40 ? "#f59e0b" : "#10b981",
          score,
          origin:  s.origin_port,
          dest:    s.destination_port,
          carrier: s.carrier,
          tag:     s.status === "rerouting" ? "REROUTING"
                 : isDelayed && score <= 90 ? "DELAYED"
                 : score > 90 ? "CRITICAL"
                 : score > 60 ? "HIGH"
                 : score > 40 ? "WATCH" : "LOW",
        };
      });
  }, [shipments, riskFilter]);

  const fl = FILTER_LABELS[riskFilter] ?? FILTER_LABELS.all;
  const [paused, setPaused] = useState(false);

  // Duplicate events for seamless loop — needs at least a few to look right
  const tickerEvents = events.length > 0 ? [...events, ...events] : [];
  // Speed: longer = slower. ~80px/s feels like a news ticker.
  const durationSec = Math.max(18, events.length * 3.8);

  return (
    <div style={{
      height: 62,
      flexShrink: 0,
      background: "linear-gradient(180deg, #091526 0%, #07111f 100%)",
      borderTop: "1px solid rgba(59,130,246,0.1)",
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
      position: "relative",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 -2px 20px rgba(0,0,0,0.3)",
    }}>
      {/* ── Left anchor: label + count + View All ── */}
      <div style={{
        padding: "0 1rem",
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 3,
        minWidth: 136,
        background: "linear-gradient(90deg, rgba(0,0,0,0.18) 0%, transparent 100%)",
        position: "relative",
        zIndex: 2,
      }}>
        {/* Live pulse dot + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: fl.color,
            boxShadow: `0 0 6px ${fl.color}cc`,
            animation: "pulse-glow 2s ease infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "0.5rem", color: "#3b5070", letterSpacing: "1.3px", textTransform: "uppercase", fontWeight: 700 }}>
            {fl.label}
          </span>
        </div>

        {/* Count */}
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: fl.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.2px" }}>
          {events.length}
          <span style={{ color: "#2d4460", fontWeight: 400, fontSize: "0.58rem", marginLeft: 3 }}>shown</span>
        </div>

        {/* View All */}
        <button
          onClick={onShowTable}
          style={{
            background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)",
            color: "#4d8fd4", borderRadius: 4, padding: "1px 7px",
            fontSize: "0.57rem", fontWeight: 600, cursor: "pointer",
            transition: "all 0.14s", letterSpacing: "0.3px", whiteSpace: "nowrap",
            alignSelf: "flex-start",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.18)"; e.currentTarget.style.color = "#60a5fa"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(59,130,246,0.07)"; e.currentTarget.style.color = "#4d8fd4"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.18)"; }}
        >
          ☰ View All
        </button>
      </div>

      {/* ── Left fade edge ── */}
      <div style={{
        position: "absolute", left: 136, top: 0, bottom: 0, width: 40, zIndex: 2,
        background: "linear-gradient(90deg, #07111f 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* ── Ticker track ── */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {events.length === 0 ? (
          <span style={{ fontSize: "0.72rem", color: "#3b5070", padding: "0 1.5rem", whiteSpace: "nowrap" }}>
            No shipments in this tier
          </span>
        ) : (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
            animation: `ticker ${durationSec}s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
            paddingRight: "0.55rem",
          }}>
            {tickerEvents.map((ev, i) => (
              <div
                key={ev.id + "-" + i}
                style={{
                  flexShrink:   0,
                  background:   `${ev.color}0d`,
                  border:       `1px solid ${ev.color}22`,
                  borderLeft:   `2px solid ${ev.color}88`,
                  borderRadius: 5,
                  padding:      "0 0.75rem 0 0.6rem",
                  height:       38,
                  display:      "flex",
                  alignItems:   "center",
                  gap:          7,
                  cursor:       "default",
                  whiteSpace:   "nowrap",
                  transition:   "background 0.12s, border-color 0.12s",
                  boxShadow:    `inset 0 1px 0 ${ev.color}10`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${ev.color}1e`; e.currentTarget.style.borderColor = `${ev.color}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${ev.color}0d`; e.currentTarget.style.borderColor = `${ev.color}22`; }}
              >
                {/* Pulsing dot */}
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: ev.color, flexShrink: 0,
                  boxShadow: `0 0 5px ${ev.color}cc, 0 0 2px ${ev.color}`,
                }} />

                {/* Ship ID */}
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#d1d9e6", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.2px" }}>
                  {ev.id}
                </span>

                {/* Divider */}
                <span style={{ width: 1, height: 13, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

                {/* Tag */}
                <span style={{
                  fontSize: "0.52rem", fontWeight: 800, color: ev.color,
                  letterSpacing: "0.6px", textTransform: "uppercase",
                }}>
                  {ev.tag}
                </span>

                {/* Divider */}
                <span style={{ width: 1, height: 13, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

                {/* Route */}
                <span style={{ fontSize: "0.63rem", color: "#5a7499" }}>
                  {ev.origin}
                </span>
                <span style={{ fontSize: "0.58rem", color: "#374f6b" }}>→</span>
                <span style={{ fontSize: "0.63rem", color: "#5a7499" }}>
                  {ev.dest}
                </span>
                <span style={{ fontSize: "0.58rem", color: "#2d4460" }}>· {ev.carrier}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right fade edge ── */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: 48, zIndex: 2,
        background: "linear-gradient(270deg, #07111f 0%, transparent 100%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { shipments: fetchedShipments, loading, error, refetch } = useShipments();
  const [simulatedShipments, setSimulatedShipments] = useState(null);
  const { connected, reconnecting } = useWebSocket(WS_URL);
  const [stats,       setStats]       = useState(null);
  const [rerouteShip, setRerouteShip] = useState(null);
  const [riskFilter,  setRiskFilter]  = useState("all");
  const [showTable,   setShowTable]   = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  // Use simulated overlay if available, otherwise use live/mock data
  const shipments = simulatedShipments ?? fetchedShipments;

  // Demo-mode simulate: bump scores only for shipments touching the disrupted port
  // No refetch — keep simulated state visible until page refresh
  function handleSimulate(port) {
    setSimulatedShipments(
      (fetchedShipments ?? []).map((s) => {
        if (s.origin_port === port || s.destination_port === port) {
          const newScore = Math.min(99, Number(s.risk_score) + 45);
          return { ...s, risk_score: newScore, status: newScore > 60 ? "at_risk" : s.status };
        }
        return s;
      })
    );
  }

  useEffect(() => { getAnalytics().then(setStats); }, [shipments]);

  const tierCounts = useMemo(() => {
    if (!shipments?.length) return { critical: 0, high: 0, medium: 0, low: 0, delayed: 0, rerouting: 0 };
    return {
      critical:  shipments.filter((s) => Number(s.risk_score) > 90).length,
      high:      shipments.filter((s) => Number(s.risk_score) > 60 && Number(s.risk_score) <= 90).length,
      medium:    shipments.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 60).length,
      low:       shipments.filter((s) => Number(s.risk_score) < 40).length,
      delayed:   shipments.filter((s) => s.status === "delayed").length,
      rerouting: shipments.filter((s) => s.status === "rerouting").length,
    };
  }, [shipments]);

  // Always derive stats from local shipments state so simulation updates all cards instantly
  const total        = shipments?.length ?? stats?.total ?? 0;
  const criticalCount = shipments?.filter((s) => Number(s.risk_score) > 90).length ?? 0;
  const atRiskCount  = shipments?.filter((s) => Number(s.risk_score) > 60).length ?? 0;
  const onTimeCount  = shipments?.filter((s) => s.status === "on_time").length ?? 0;
  const atRiskPct    = total > 0 ? ((atRiskCount / total) * 100).toFixed(1) : "0.0";
  const onTimePct    = total > 0 ? ((onTimeCount / total) * 100).toFixed(1) : (stats?.on_time_pct ?? "0.0");
  const delayedCount = shipments?.filter((s) => s.status === "delayed").length ?? 0;

  const STATS = [
    { label: "Total Shipments", value: total || "—",       sub: null,                                          color: "#3b82f6" },
    { label: "At Risk",         value: atRiskCount || "—", sub: total > 0 ? `${atRiskPct}% of fleet` : null,  color: "#ef4444" },
    { label: "Critical",        value: criticalCount,      sub: "score > 90",                                  color: "#ff2d2d" },
    { label: "On-Time Rate",    value: `${onTimePct}%`,    sub: "last 24 h",                                   color: "#10b981" },
  ];

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#060e1a",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#e2e8f0",
      overflow: "hidden",
    }}>
      <NexusHeader active="dashboard" connected={connected} />

      {/* ── Stats strip ── */}
      <div style={{
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        background: "linear-gradient(180deg, #0c1a2e 0%, #091526 100%)",
        borderBottom: "1px solid rgba(59,130,246,0.1)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.35)",
      }}>
        {STATS.map((s, i) => <StatCard key={s.label} {...s} isLast={i === 3} />)}
      </div>

      {/* ── 3-column main area ── */}
      <div style={{ flex: "1 1 0", display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left filter panel */}
        <LeftFilterPanel
          riskFilter={riskFilter}
          onFilterChange={setRiskFilter}
          tierCounts={tierCounts}
        />

        {/* Map — hero, takes all remaining space */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {loading && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(6,14,26,0.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10, backdropFilter: "blur(4px)",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 32, height: 32, border: "2px solid #1a2d47",
                  borderTopColor: "#3b82f6", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite", margin: "0 auto 10px",
                }} />
                <span style={{ color: "#64748b", fontSize: "0.82rem", letterSpacing: "0.3px" }}>
                  Loading shipments…
                </span>
              </div>
            </div>
          )}
          <MapView
            shipments={shipments}
            riskFilter={riskFilter}
            onFilterChange={setRiskFilter}
            tierCounts={tierCounts}
          />
        </div>

        {/* Right alerts panel */}
        <AlertsSidebar
          shipments={shipments}
          connected={connected}
          reconnecting={reconnecting}
          onReroute={(s) => setRerouteShip(s)}
          onRefetch={refetch}
          onSimulate={handleSimulate}
        />
      </div>

      {/* ── Bottom activity timeline ── */}
      <BottomTimeline
        shipments={shipments}
        riskFilter={riskFilter}
        onShowTable={() => setShowTable(true)}
      />

      {/* ── All Shipments drawer overlay ── */}
      {showTable && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.7)",
          zIndex:         1500,
          backdropFilter: "blur(5px)",
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "flex-end",
          animation:      "fade-in 0.18s ease",
        }}
          onClick={() => { setShowTable(false); setTableSearch(""); }}
        >
          <div
            style={{
              background:   "#09152a",
              border:       "1px solid rgba(59,130,246,0.18)",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
              boxShadow:    "0 -16px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)",
              height:       "85vh",
              display:      "flex",
              flexDirection:"column",
              overflow:     "hidden",
              animation:    "slide-in-up 0.24s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              gap:            12,
              padding:        "0.9rem 1.4rem 0.75rem",
              borderBottom:   "1px solid rgba(255,255,255,0.05)",
              flexShrink:     0,
              background:     "linear-gradient(180deg,#0d1e38 0%,#09152a 100%)",
            }}>
              {/* Drag handle */}
              <div style={{ width: 36, height: 3.5, background: "rgba(255,255,255,0.13)", borderRadius: 2, flexShrink: 0 }} />

              {/* Title + count */}
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0", flexShrink: 0 }}>
                All Shipments
              </span>
              <span style={{
                background: "rgba(59,130,246,0.14)", color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.28)", borderRadius: 4,
                padding: "1px 9px", fontSize: "0.68rem", fontWeight: 700, flexShrink: 0,
              }}>
                {shipments.length}
              </span>

              {/* Live search input */}
              <div style={{
                flex:         1,
                position:     "relative",
                maxWidth:     420,
                marginLeft:   "auto",
              }}>
                <span style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  color: "#4b6280", fontSize: "0.8rem", pointerEvents: "none",
                }}>⌕</span>
                <input
                  type="text"
                  placeholder="Search by ID, port, carrier, cargo…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  autoFocus
                  style={{
                    width:        "100%",
                    background:   "#0a1628",
                    border:       "1px solid #1a2d47",
                    borderRadius: 7,
                    padding:      "0.42rem 0.75rem 0.42rem 2rem",
                    fontSize:     "0.78rem",
                    color:        "#e2e8f0",
                    outline:      "none",
                    fontFamily:   "'Inter', system-ui, sans-serif",
                    transition:   "border-color 0.15s",
                  }}
                  onFocus={(e)  => { e.target.style.borderColor = "rgba(59,130,246,0.5)"; }}
                  onBlur={(e)   => { e.target.style.borderColor = "#1a2d47"; }}
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch("")}
                    style={{
                      position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: "#4b6280",
                      cursor: "pointer", fontSize: "0.85rem", padding: "0 2px",
                    }}
                  >✕</button>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={() => { setShowTable(false); setTableSearch(""); }}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid #1a2d47",
                  color: "#64748b", borderRadius: 6, padding: "5px 11px",
                  cursor: "pointer", fontSize: "0.85rem", transition: "all 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#94a3b8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#64748b"; }}
              >✕</button>
            </div>

            {/* Table fills remaining height */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <ShipmentTable shipments={shipments} searchTerm={tableSearch} inDrawer={true} />
            </div>
          </div>
        </div>
      )}

      {rerouteShip && (
        <RerouteModal shipment={rerouteShip} onClose={() => setRerouteShip(null)} />
      )}
    </div>
  );
}
