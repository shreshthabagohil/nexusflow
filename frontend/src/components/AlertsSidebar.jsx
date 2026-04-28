// frontend/src/components/AlertsSidebar.jsx — wider, more spacious, scroll-to-top

import { useState, useRef, useEffect, useCallback } from "react";
import { postSimulateDisruption } from "../services/api";

// ── Risk score badge ───────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const s      = Number(score);
  const isHigh = s > 60;
  const color  = isHigh ? "#ef4444" : "#f59e0b";
  return (
    <span style={{
      background:    `${color}18`,
      color,
      border:        `1px solid ${color}35`,
      borderRadius:  5,
      padding:       "2px 9px",
      fontSize:      "0.73rem",
      fontWeight:    800,
      whiteSpace:    "nowrap",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.3px",
      boxShadow:     `0 0 10px ${color}22`,
    }}>
      {s.toFixed(1)}
    </span>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({ s, onReroute }) {
  const [hov, setHov] = useState(false);
  const score        = Number(s.risk_score);
  const isHigh       = score > 60;
  const accent       = isHigh ? "#ef4444" : "#f59e0b";
  const statusLabel  = s.status?.replace(/_/g, " ").toUpperCase() ?? "ALERT";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        margin:       "0 0.75rem 0.55rem",
        background:   hov
          ? `linear-gradient(135deg, ${accent}0a 0%, rgba(10,22,40,0.95) 100%)`
          : "linear-gradient(135deg, rgba(12,24,44,0.7) 0%, rgba(8,15,30,0.7) 100%)",
        border:       `1px solid ${hov ? accent + "40" : "rgba(255,255,255,0.06)"}`,
        borderLeft:   `3px solid ${hov ? accent : accent + "60"}`,
        borderRadius: "0 8px 8px 0",
        padding:      "0.85rem 0.95rem",
        cursor:       "default",
        transition:   "all 0.18s ease",
        boxShadow:    hov ? `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${accent}15` : "0 2px 8px rgba(0,0,0,0.2)",
        animation:    "fade-in 0.2s ease both",
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {/* Glow layer on hover */}
      {hov && (
        <div style={{
          position:     "absolute",
          left: 0, top: 0, bottom: 0, width: 60,
          background:   `linear-gradient(90deg, ${accent}0c, transparent)`,
          pointerEvents:"none",
        }} />
      )}

      {/* Header row: ID + score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{
            fontSize:   "0.85rem",
            fontWeight: 800,
            color:      "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.3px",
          }}>
            {s.id}
          </span>
          <span style={{
            fontSize:     "0.58rem",
            fontWeight:   700,
            color:        accent,
            background:   `${accent}15`,
            border:       `1px solid ${accent}28`,
            borderRadius: 3,
            padding:      "1px 6px",
            letterSpacing:"0.4px",
          }}>
            {statusLabel}
          </span>
        </div>
        <ScoreBadge score={s.risk_score} />
      </div>

      {/* Route */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        fontSize: "0.77rem", color: "#94a3b8", marginBottom: "0.35rem",
      }}>
        <span>{s.origin_port}</span>
        <span style={{ color: "#3b82f6", fontSize: "0.7rem", fontWeight: 700 }}>→</span>
        <span>{s.destination_port}</span>
      </div>

      {/* Carrier + cargo */}
      <div style={{ fontSize: "0.7rem", color: "#4b6280", marginBottom: "0.75rem" }}>
        {s.carrier}{s.cargo_type ? ` · ${s.cargo_type}` : ""}
      </div>

      {/* Action button */}
      <button
        onClick={() => onReroute(s)}
        style={{
          width:         "100%",
          background:    hov
            ? "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.12) 100%)"
            : "rgba(59,130,246,0.08)",
          border:        "1px solid rgba(59,130,246,0.25)",
          color:         "#60a5fa",
          borderRadius:  6,
          padding:       "0.45rem 0",
          fontSize:      "0.74rem",
          fontWeight:    600,
          cursor:        "pointer",
          transition:    "all 0.15s ease",
          letterSpacing: "0.2px",
          boxShadow:     hov ? "0 0 14px rgba(59,130,246,0.15)" : "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background  = "linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.18) 100%)";
          e.currentTarget.style.borderColor = "rgba(59,130,246,0.42)";
          e.currentTarget.style.color       = "#93c5fd";
          e.currentTarget.style.boxShadow   = "0 0 18px rgba(59,130,246,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background  = hov ? "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.12) 100%)" : "rgba(59,130,246,0.08)";
          e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)";
          e.currentTarget.style.color       = "#60a5fa";
          e.currentTarget.style.boxShadow   = "none";
        }}
      >
        View Reroute Options
      </button>
    </div>
  );
}

// ── Rerouting card ────────────────────────────────────────────────────────────
function RerouteCard({ s, onReroute }) {
  const [hov, setHov] = useState(false);
  const score = Number(s.risk_score);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        margin:       "0 0.75rem 0.55rem",
        background:   hov
          ? "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(10,22,40,0.95) 100%)"
          : "linear-gradient(135deg, rgba(12,24,44,0.7) 0%, rgba(8,15,30,0.7) 100%)",
        border:       `1px solid ${hov ? "rgba(139,92,246,0.38)" : "rgba(255,255,255,0.06)"}`,
        borderLeft:   `3px solid ${hov ? "#8b5cf6" : "#8b5cf666"}`,
        borderRadius: "0 8px 8px 0",
        padding:      "0.85rem 0.95rem",
        cursor:       "default",
        transition:   "all 0.18s ease",
        boxShadow:    hov ? "0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.12)" : "0 2px 8px rgba(0,0,0,0.2)",
        animation:    "fade-in 0.2s ease both",
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {hov && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 60,
          background: "linear-gradient(90deg, rgba(139,92,246,0.08), transparent)",
          pointerEvents: "none",
        }} />
      )}

      {/* Header: ID + REROUTING badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <span style={{
          fontSize: "0.85rem", fontWeight: 800, color: "#e2e8f0",
          fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.3px",
        }}>
          {s.id}
        </span>
        <span style={{
          background:   "rgba(139,92,246,0.16)",
          color:        "#a78bfa",
          border:       "1px solid rgba(139,92,246,0.32)",
          borderRadius: 5,
          padding:      "2px 9px",
          fontSize:     "0.62rem",
          fontWeight:   700,
          letterSpacing:"0.5px",
          boxShadow:    "0 0 10px rgba(139,92,246,0.2)",
        }}>
          REROUTING
        </span>
      </div>

      {/* Route */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.77rem", color: "#94a3b8", marginBottom: "0.35rem" }}>
        <span>{s.origin_port}</span>
        <span style={{ color: "#8b5cf6", fontSize: "0.7rem", fontWeight: 700 }}>→</span>
        <span>{s.destination_port}</span>
      </div>

      {/* Carrier + risk score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.7rem", color: "#4b6280" }}>
          {s.carrier}{s.cargo_type ? ` · ${s.cargo_type}` : ""}
        </span>
        <span style={{
          fontSize: "0.7rem", color: "#a78bfa", fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}>
          ⚠ {score.toFixed(1)}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={() => onReroute(s)}
        style={{
          width:         "100%",
          background:    hov ? "rgba(139,92,246,0.16)" : "rgba(139,92,246,0.08)",
          border:        "1px solid rgba(139,92,246,0.28)",
          color:         "#a78bfa",
          borderRadius:  6,
          padding:       "0.45rem 0",
          fontSize:      "0.74rem",
          fontWeight:    600,
          cursor:        "pointer",
          transition:    "all 0.15s ease",
          letterSpacing: "0.2px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background  = "rgba(139,92,246,0.24)";
          e.currentTarget.style.borderColor = "rgba(139,92,246,0.45)";
          e.currentTarget.style.color       = "#c4b5fd";
          e.currentTarget.style.boxShadow   = "0 0 14px rgba(139,92,246,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background  = hov ? "rgba(139,92,246,0.16)" : "rgba(139,92,246,0.08)";
          e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)";
          e.currentTarget.style.color       = "#a78bfa";
          e.currentTarget.style.boxShadow   = "none";
        }}
      >
        Adjust Route
      </button>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export default function AlertsSidebar({ shipments = [], connected, reconnecting, onReroute, onRefetch, onSimulate }) {
  const [simLoading, setSimLoading] = useState(false);
  const [simResult,  setSimResult]  = useState(null);
  const [activeTab,  setActiveTab]  = useState("alerts");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);

  const alerts = [...shipments]
    .filter((s) => Number(s.risk_score) > 40)
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

  const reroutingShips = [...shipments]
    .filter((s) => s.status === "rerouting")
    .sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

  const highCount = alerts.filter((s) => Number(s.risk_score) > 60).length;

  // Show scroll-to-top button after scrolling 120px
  const handleScroll = useCallback(() => {
    setShowScrollTop((scrollRef.current?.scrollTop ?? 0) > 120);
  }, []);

  async function handleSimulate() {
    setSimLoading(true);
    setSimResult(null);
    const res = await postSimulateDisruption({ type: "port_closure", port: "Rotterdam" });
    setSimLoading(false);
    setSimResult(res ? "success" : "error");
    if (res) {
      onSimulate?.("Rotterdam"); // locally bump Rotterdam ships in demo mode
    } else {
      onRefetch?.();
    }
    setTimeout(() => setSimResult(null), 3000);
  }

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const TABS = [
    { key: "alerts",    label: "Alerts",    count: alerts.length,        high: highCount,         dot: null,      activeColor: "#3b82f6" },
    { key: "rerouting", label: "Rerouting", count: reroutingShips.length, high: 0,                dot: "#8b5cf6", activeColor: "#8b5cf6" },
  ];

  return (
    <div style={{
      width:         320,
      flexShrink:    0,
      background:    "linear-gradient(180deg, #0a1829 0%, #080f1e 100%)",
      borderLeft:    "1px solid rgba(255,255,255,0.05)",
      display:       "flex",
      flexDirection: "column",
      overflow:      "hidden",
      boxShadow:     "-8px 0 40px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.03)",
      position:      "relative",
    }}>

      {/* ── Simulate + live status ── */}
      <div style={{
        padding:      "0.9rem 0.85rem 0.8rem",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink:   0,
        background:   "rgba(0,0,0,0.15)",
      }}>
        <button
          onClick={handleSimulate}
          disabled={simLoading}
          style={{
            width:         "100%",
            background:    simLoading
              ? "rgba(239,68,68,0.06)"
              : "linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(185,28,28,0.08) 100%)",
            color:         simLoading ? "#f87171" : "#ef4444",
            border:        "1px solid rgba(239,68,68,0.3)",
            borderRadius:  7,
            padding:       "0.6rem 0",
            fontSize:      "0.77rem",
            fontWeight:    700,
            cursor:        simLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.2px",
            transition:    "all 0.15s ease",
            animation:     simLoading ? "none" : "pulse-danger 2.5s ease infinite",
            boxShadow:     simLoading ? "none" : "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(239,68,68,0.1)",
          }}
          onMouseEnter={(e) => {
            if (!simLoading) {
              e.currentTarget.style.background  = "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(185,28,28,0.14) 100%)";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
              e.currentTarget.style.boxShadow   = "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px rgba(239,68,68,0.22)";
            }
          }}
          onMouseLeave={(e) => {
            if (!simLoading) {
              e.currentTarget.style.background  = "linear-gradient(135deg, rgba(239,68,68,0.14) 0%, rgba(185,28,28,0.08) 100%)";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              e.currentTarget.style.boxShadow   = "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(239,68,68,0.1)";
            }
          }}
        >
          {simLoading ? "⚡ Simulating…" : "⚠ Simulate Rotterdam Closure"}
        </button>

        {simResult && (
          <div style={{
            marginTop: 8,
            padding:   "6px 12px",
            borderRadius: 6,
            fontSize:  "0.71rem",
            fontWeight:600,
            background: simResult === "success"
              ? "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.07) 100%)"
              : "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.07) 100%)",
            color:     simResult === "success" ? "#34d399" : "#f87171",
            border:    `1px solid ${simResult === "success" ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`,
            animation: "fade-in 0.2s ease",
          }}>
            {simResult === "success" ? "✓ Disruption event triggered" : "✕ API unavailable"}
          </div>
        )}

        {/* Live status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", display: "inline-block", flexShrink: 0,
            background: connected ? "#10b981" : "#2a3f5a",
            boxShadow:  connected ? "0 0 7px #10b981" : "none",
            animation:  connected ? "pulse-glow 2s ease infinite" : "none",
          }} />
          <span style={{ fontSize: "0.66rem", color: connected ? "#34d399" : "#4b6280" }}>
            {connected ? "Live · real-time updates" : "Demo mode · mock data"}
          </span>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{
        display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0, background: "rgba(0,0,0,0.1)",
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const lineColor = tab.activeColor;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex:          1,
                background:    isActive ? `linear-gradient(180deg, ${lineColor}10 0%, transparent 100%)` : "transparent",
                border:        "none",
                borderBottom:  `2px solid ${isActive ? lineColor : "transparent"}`,
                color:         isActive ? (tab.key === "rerouting" ? "#a78bfa" : "#93c5fd") : "#4b6280",
                padding:       "0.6rem 0.5rem",
                fontSize:      "0.75rem",
                fontWeight:    isActive ? 700 : 400,
                cursor:        "pointer",
                transition:    "all 0.15s ease",
                display:       "flex",
                alignItems:    "center",
                justifyContent:"center",
                gap:           7,
                letterSpacing: "0.1px",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#4b6280"; }}
            >
              {tab.dot && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: tab.dot, display: "inline-block",
                  boxShadow: isActive ? `0 0 6px ${tab.dot}` : "none",
                }} />
              )}
              {tab.label}
              <span style={{
                background:   isActive
                  ? tab.key === "rerouting"
                    ? "rgba(139,92,246,0.2)"
                    : tab.count > 0 ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"
                  : "rgba(255,255,255,0.05)",
                color:        isActive
                  ? tab.key === "rerouting" ? "#a78bfa" : tab.high > 0 ? "#f87171" : "#94a3b8"
                  : "#4b6280",
                border:       `1px solid ${isActive
                  ? tab.key === "rerouting" ? "rgba(139,92,246,0.32)" : tab.high > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"
                  : "#1a2d47"}`,
                borderRadius: 4,
                padding:      "0 7px",
                fontSize:     "0.63rem",
                fontWeight:   700,
                lineHeight:   1.8,
                fontVariantNumeric: "tabular-nums",
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content (scrollable) ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", position: "relative" }}
      >
        {/* Section header */}
        <div style={{
          padding:      "0.6rem 0.85rem 0.3rem",
          fontSize:     "0.62rem",
          color:        "#3b5070",
          letterSpacing:"0.8px",
          textTransform:"uppercase",
          fontWeight:   700,
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          display:      "flex",
          justifyContent:"space-between",
          alignItems:   "center",
        }}>
          <span>
            {activeTab === "alerts"
              ? `${alerts.length} shipments at risk`
              : `${reroutingShips.length} actively rerouting`}
          </span>
          {activeTab === "alerts" && highCount > 0 && (
            <span style={{
              color: "#f87171", fontSize: "0.59rem", fontWeight: 700,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.22)",
              borderRadius: 3, padding: "1px 6px",
            }}>
              {highCount} CRITICAL
            </span>
          )}
        </div>

        <div style={{ paddingTop: "0.5rem", paddingBottom: "3rem" }}>
          {/* Alerts tab */}
          {activeTab === "alerts" && (
            alerts.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.4 }}>✓</div>
                <p style={{ color: "#34d399", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>All clear</p>
                <p style={{ color: "#4b6280", fontSize: "0.71rem", margin: "5px 0 0" }}>No active alerts</p>
              </div>
            ) : (
              alerts.map((s) => <AlertCard key={s.id} s={s} onReroute={onReroute} />)
            )
          )}

          {/* Rerouting tab */}
          {activeTab === "rerouting" && (
            reroutingShips.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 10, opacity: 0.4 }}>🛸</div>
                <p style={{ color: "#a78bfa", fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>No rerouting in progress</p>
                <p style={{ color: "#4b6280", fontSize: "0.71rem", margin: "5px 0 0" }}>All shipments on primary routes</p>
              </div>
            ) : (
              reroutingShips.map((s) => <RerouteCard key={s.id} s={s} onReroute={onReroute} />)
            )
          )}
        </div>
      </div>

      {/* ── Scroll-to-top FAB — floats over sidebar, positioned relative to sidebar wrapper ── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position:     "absolute",
            bottom:       18,
            right:        16,
            width:        34,
            height:       34,
            borderRadius: "50%",
            background:   "linear-gradient(135deg, #1e3a5f, #0f2240)",
            border:       "1px solid rgba(59,130,246,0.35)",
            color:        "#60a5fa",
            fontSize:     "0.85rem",
            cursor:       "pointer",
            display:      "flex",
            alignItems:   "center",
            justifyContent:"center",
            boxShadow:    "0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(59,130,246,0.15)",
            transition:   "all 0.15s ease",
            animation:    "fade-in 0.2s ease",
            zIndex:       10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #2a4f7f, #152e55)";
            e.currentTarget.style.boxShadow  = "0 6px 20px rgba(0,0,0,0.5), 0 0 18px rgba(59,130,246,0.25)";
            e.currentTarget.style.transform  = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, #1e3a5f, #0f2240)";
            e.currentTarget.style.boxShadow  = "0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(59,130,246,0.15)";
            e.currentTarget.style.transform  = "translateY(0)";
          }}
        >
          ↑
        </button>
      )}
    </div>
  );
}
