// frontend/src/components/RerouteModal.jsx — dark theme with real route fetching

import { useState, useEffect } from "react";
import { getRoutes } from "../services/api";

function riskColor(score) {
  if (score > 60) return "#ef4444";
  if (score > 40) return "#f59e0b";
  return "#10b981";
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

  const score = Number(shipment.risk_score ?? 0);
  const rColor = riskColor(score);

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0, 0, 0, 0.75)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        zIndex:         2000,
        backdropFilter: "blur(6px)",
        animation:      "fade-in 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:   "#0f1f33",
          border:       "1px solid #1a2d47",
          borderRadius: 14,
          padding:      "1.75rem",
          width:        "min(580px, 94vw)",
          maxHeight:    "88vh",
          overflowY:    "auto",
          boxShadow:    "0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03)",
          color:        "#e2e8f0",
          animation:    "fade-in 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "flex-start",
          marginBottom:   "1.4rem",
        }}>
          <div>
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        8,
              marginBottom: 6,
            }}>
              <div style={{
                width:        3,
                height:       18,
                background:   "#3b82f6",
                borderRadius: 2,
                boxShadow:    "0 0 8px rgba(59,130,246,0.5)",
              }} />
              <h2 style={{
                margin:    0,
                fontSize:  "1rem",
                fontWeight: 700,
                color:     "#e2e8f0",
                letterSpacing: "-0.2px",
              }}>
                Reroute Options
              </h2>
            </div>
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        10,
              fontSize:   "0.8rem",
              color:      "#94a3b8",
              paddingLeft: 11,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color:      "#e2e8f0",
              }}>
                {shipment.id}
              </span>
              <span style={{ color: "#3b82f6", opacity: 0.7 }}>·</span>
              <span>{shipment.origin_port} → {shipment.destination_port}</span>
              <span style={{
                background:  score > 60 ? "rgba(239,68,68,0.14)" : "rgba(245,158,11,0.14)",
                color:       rColor,
                border:      `1px solid ${rColor}44`,
                borderRadius: 4,
                padding:     "2px 9px",
                fontSize:    "0.7rem",
                fontWeight:  700,
                fontVariantNumeric: "tabular-nums",
              }}>
                {score.toFixed(1)} {score > 60 ? "HIGH" : "MED"}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid #1a2d47",
              color:        "#64748b",
              fontSize:     "1rem",
              cursor:       "pointer",
              padding:      "5px 10px",
              borderRadius: 6,
              transition:   "all 0.15s",
              lineHeight:   1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color      = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.color      = "#64748b";
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{
            textAlign:  "center",
            padding:    "2.5rem 0",
            color:      "#64748b",
          }}>
            <div style={{
              width:        28,
              height:       28,
              border:       "2px solid #1a2d47",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              animation:    "spin 0.8s linear infinite",
              margin:       "0 auto 12px",
            }} />
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Computing optimal routes…</p>
          </div>
        )}

        {/* ── Success state ── */}
        {applied && (
          <div style={{
            padding:      "1.1rem",
            background:   "rgba(16,185,129,0.1)",
            border:       "1px solid rgba(16,185,129,0.25)",
            borderRadius: 8,
            color:        "#34d399",
            textAlign:    "center",
            fontWeight:   700,
            fontSize:     "0.88rem",
          }}>
            ✓ Rerouted via {routes?.[selected]?.route_name}. Closing…
          </div>
        )}

        {/* ── Route options ── */}
        {!loading && !applied && routes?.map((r, idx) => {
          const isSelected = selected === idx;
          const colors     = ["#3b82f6", "#f97316", "#8b5cf6"];
          const c          = r.color ?? colors[idx] ?? "#3b82f6";

          return (
            <div
              key={idx}
              onClick={() => setSelected(idx)}
              style={{
                background:   isSelected
                  ? `linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(30,58,95,0.8) 100%)`
                  : "#0a1628",
                border:       `1px solid ${isSelected ? c + "55" : "#1a2d47"}`,
                borderRadius: 9,
                padding:      "1rem 1.1rem",
                marginBottom: "0.75rem",
                cursor:       "pointer",
                transition:   "all 0.18s ease",
                boxShadow:    isSelected ? `0 0 0 1px ${c}22, 0 4px 16px rgba(0,0,0,0.3)` : "none",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "#0f1f33";
                  e.currentTarget.style.borderColor = "#243f63";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background  = "#0a1628";
                  e.currentTarget.style.borderColor = "#1a2d47";
                }
              }}
            >
              <div style={{
                display:     "flex",
                alignItems:  "center",
                gap:         8,
                marginBottom: 8,
                flexWrap:    "wrap",
              }}>
                <span style={{
                  background:   c,
                  color:        "#fff",
                  borderRadius: 4,
                  padding:      "2px 9px",
                  fontSize:     "0.68rem",
                  fontWeight:   700,
                  fontFamily:   "'JetBrains Mono', monospace",
                  letterSpacing:"0.3px",
                }}>
                  R{String(idx + 1).padStart(3, "0")}
                </span>
                <span style={{
                  fontSize:   "0.85rem",
                  fontWeight: 600,
                  color:      "#e2e8f0",
                  flex:       1,
                }}>
                  {r.waypoints?.map((w) => w.port).join(" → ")}
                </span>
                {idx === 0 && (
                  <span style={{
                    background:    "rgba(16,185,129,0.14)",
                    color:         "#34d399",
                    border:        "1px solid rgba(16,185,129,0.28)",
                    borderRadius:  4,
                    padding:       "2px 9px",
                    fontSize:      "0.65rem",
                    fontWeight:    700,
                    letterSpacing: "0.5px",
                  }}>
                    ★ RECOMMENDED
                  </span>
                )}
              </div>

              <div style={{
                display: "flex",
                gap:     "1.25rem",
                fontSize: "0.78rem",
                color:   "#94a3b8",
              }}>
                <span>⏱ {r.eta_days} days</span>
                <span style={{
                  color: r.cost_delta > 0 ? "#f87171"
                    : r.cost_delta < 0 ? "#34d399" : "#94a3b8",
                }}>
                  💰 {r.cost_delta === 0
                    ? "Baseline"
                    : r.cost_delta > 0
                      ? `+$${r.cost_delta}K`
                      : `-$${Math.abs(r.cost_delta)}K`}
                </span>
                <span style={{
                  color: r.risk_delta < 0 ? "#34d399"
                    : r.risk_delta > 0 ? "#f87171" : "#94a3b8",
                }}>
                  ⚠ {r.risk_delta === 0
                    ? "Same risk"
                    : r.risk_delta > 0
                      ? `+${r.risk_delta} pts`
                      : `${r.risk_delta}% risk`}
                </span>
              </div>
            </div>
          );
        })}

        {/* ── No options ── */}
        {!loading && !applied && routes?.length === 0 && (
          <div style={{
            padding:   "2rem",
            textAlign: "center",
            color:     "#4b6280",
            fontSize:  "0.85rem",
          }}>
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
              border:        "1px solid rgba(96,165,250,0.25)",
              borderRadius:  8,
              padding:       "0.7rem",
              fontSize:      "0.9rem",
              fontWeight:    700,
              cursor:        "pointer",
              marginTop:     4,
              transition:    "all 0.15s ease",
              boxShadow:     "0 4px 14px rgba(37,99,235,0.35)",
              letterSpacing: "0.2px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #1d4ed8, #1e40af)";
              e.currentTarget.style.boxShadow  = "0 6px 20px rgba(37,99,235,0.5)";
              e.currentTarget.style.transform  = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)";
              e.currentTarget.style.boxShadow  = "0 4px 14px rgba(37,99,235,0.35)";
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
