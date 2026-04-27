// frontend/src/components/RerouteModal.jsx — matches target UI (medium-blue theme)

import { useState, useEffect } from "react";
import { getRoutes } from "../services/api";

function riskColor(score) {
  if (score > 90) return "#ff2d2d";
  if (score > 60) return "#ef4444";
  if (score > 40) return "#f59e0b";
  return "#10b981";
}

function riskLabel(score) {
  if (score > 60) return "HIGH";
  if (score > 40) return "MED";
  return "LOW";
}

export default function RerouteModal({ shipment, onClose }) {
  const [routes,   setRoutes]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [applied,  setApplied]  = useState(false);

  useEffect(() => {
    if (!shipment?.id) return;
    setLoading(true);
    setApplied(false);
    setSelected(null);
    getRoutes(shipment.id).then((data) => {
      setRoutes(data?.reroute_options ?? []);
      if (data?.reroute_options?.length) setSelected(0);
      setLoading(false);
    });
  }, [shipment?.id]);

  if (!shipment) return null;

  const score  = Number(shipment.risk_score ?? 0);
  const rColor = riskColor(score);
  const rLabel = riskLabel(score);

  return (
    <div
      onClick={onClose}
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0,0,0,0.65)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        zIndex:         2000,
        backdropFilter: "blur(4px)",
        animation:      "fade-in 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   "#162b46",
          border:       "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding:      "1.5rem",
          width:        "min(520px, 92vw)",
          maxHeight:    "86vh",
          overflowY:    "auto",
          boxShadow:    "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          color:        "#e2e8f0",
          animation:    "fade-in 0.22s ease",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "flex-start",
          marginBottom:   "1.25rem",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 18, background: "#3b82f6", borderRadius: 2 }} />
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>
                Reroute Options
              </h2>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.8rem", paddingLeft: 11,
            }}>
              <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{shipment.id}</span>
              <span style={{ color: "#94a3b8" }}>
                {shipment.origin_port} → {shipment.destination_port}
              </span>
              <span style={{
                background:   `${rColor}20`,
                color:        rColor,
                border:       `1px solid ${rColor}50`,
                borderRadius: 4,
                padding:      "2px 9px",
                fontSize:     "0.7rem",
                fontWeight:   700,
              }}>
                {score.toFixed(1)} {rLabel}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background:     "rgba(255,255,255,0.07)",
              border:         "1px solid rgba(255,255,255,0.12)",
              color:          "#94a3b8",
              width:          28,
              height:         28,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              borderRadius:   "50%",
              cursor:         "pointer",
              fontSize:       "0.85rem",
              transition:     "all 0.15s",
              flexShrink:     0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color      = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.color      = "#94a3b8";
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "2.5rem 0", color: "#64748b" }}>
            <div style={{
              width:        28,
              height:       28,
              border:       "2px solid rgba(255,255,255,0.08)",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              animation:    "spin 0.8s linear infinite",
              margin:       "0 auto 12px",
            }} />
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Computing optimal routes…</p>
          </div>
        )}

        {/* ── Success ── */}
        {applied && (
          <div style={{
            padding:      "1rem",
            background:   "rgba(16,185,129,0.1)",
            border:       "1px solid rgba(16,185,129,0.25)",
            borderRadius: 8,
            color:        "#34d399",
            textAlign:    "center",
            fontWeight:   700,
            fontSize:     "0.88rem",
          }}>
            ✓ Rerouted via Low-Risk Route. Closing…
          </div>
        )}

        {/* ── Route options ── */}
        {!loading && !applied && routes?.map((r, idx) => {
          const isSelected = selected === idx;
          const COLORS     = ["#3b82f6", "#f97316", "#6b7280"];
          const c          = r.color ?? COLORS[idx] ?? "#3b82f6";

          return (
            <div
              key={idx}
              onClick={() => setSelected(idx)}
              style={{
                background:   isSelected
                  ? `linear-gradient(135deg, ${c}15 0%, rgba(12,24,48,0.85) 100%)`
                  : "rgba(9,18,36,0.55)",
                border:       `1px solid ${isSelected ? c + "55" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 8,
                padding:      "0.9rem 1rem",
                marginBottom: "0.6rem",
                cursor:       "pointer",
                transition:   "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = "rgba(9,18,36,0.55)";
              }}
            >
              {/* Route header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{
                  background:   c,
                  color:        "#fff",
                  borderRadius: 4,
                  padding:      "2px 8px",
                  fontSize:     "0.67rem",
                  fontWeight:   700,
                  fontFamily:   "'JetBrains Mono', monospace",
                  flexShrink:   0,
                }}>
                  R{String(idx + 1).padStart(3, "0")}
                </span>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0", flex: 1 }}>
                  {r.waypoints?.map((w) => w.port).join(" → ")}
                </span>
                {idx === 0 && (
                  <span style={{
                    background:   "rgba(16,185,129,0.15)",
                    color:        "#34d399",
                    border:       "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 4,
                    padding:      "2px 9px",
                    fontSize:     "0.65rem",
                    fontWeight:   700,
                    letterSpacing:"0.3px",
                    flexShrink:   0,
                  }}>
                    ★ RECOMMENDED
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: "1.1rem", fontSize: "0.77rem", color: "#94a3b8" }}>
                <span>⏱ {r.eta_days} days</span>
                <span style={{
                  color: r.cost_delta > 0 ? "#f87171"
                       : r.cost_delta < 0 ? "#34d399" : "#94a3b8",
                }}>
                  💰 {r.cost_delta === 0 ? "Baseline"
                      : r.cost_delta > 0 ? `+$${r.cost_delta}K`
                      : `-$${Math.abs(r.cost_delta)}K`}
                </span>
                <span style={{
                  color: r.risk_delta < 0 ? "#34d399"
                       : r.risk_delta > 0 ? "#f87171" : "#94a3b8",
                }}>
                  ⚠ {r.risk_delta === 0 ? "Same risk"
                     : r.risk_delta > 0 ? `+${r.risk_delta} pts`
                     : `${r.risk_delta} pts`}
                </span>
              </div>
            </div>
          );
        })}

        {/* ── No options ── */}
        {!loading && !applied && routes?.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#4b6280", fontSize: "0.85rem" }}>
            No reroute options available for this shipment.
          </div>
        )}

        {/* ── Apply button ── */}
        {!loading && !applied && routes?.length > 0 && (
          <button
            onClick={() => {
              setApplied(true);
              setTimeout(onClose, 1800);
            }}
            style={{
              width:         "100%",
              background:    "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color:         "#fff",
              border:        "none",
              borderRadius:  8,
              padding:       "0.75rem",
              fontSize:      "0.92rem",
              fontWeight:    700,
              cursor:        "pointer",
              marginTop:     4,
              transition:    "all 0.15s ease",
              boxShadow:     "0 4px 14px rgba(37,99,235,0.4)",
              letterSpacing: "0.2px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #1d4ed8, #1e40af)";
              e.currentTarget.style.boxShadow  = "0 6px 20px rgba(37,99,235,0.55)";
              e.currentTarget.style.transform  = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)";
              e.currentTarget.style.boxShadow  = "0 4px 14px rgba(37,99,235,0.4)";
              e.currentTarget.style.transform  = "translateY(0)";
            }}
          >
            Apply Route
          </button>
        )}
      </div>
    </div>
  );
}
