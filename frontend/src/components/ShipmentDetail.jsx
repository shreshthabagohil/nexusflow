import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getShipment } from "../services/api";
import RerouteModal from "./RerouteModal";
import { NexusHeader } from "./Dashboard";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

function riskColor(score) {
  if (score > 90) return "#ff2d2d";   // Critical — matches MapView
  if (score > 60) return "#ef4444";   // High
  if (score > 40) return "#f59e0b";   // Medium
  return "#10b981";                   // Low
}
function riskLabel(score) {
  if (score > 90) return "Critical";
  if (score > 60) return "High Risk";
  if (score > 40) return "Medium Risk";
  return "Low Risk";
}

// ── Feature bar ───────────────────────────────────────────────────────────────
function FeatureBar({ label, value, max = 1, unit = "", color = "#3b82f6" }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        marginBottom:   5,
        alignItems:     "baseline",
      }}>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{label}</span>
        <span style={{
          fontSize:   "0.83rem",
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
        }}>
          {typeof value === "number" ? value.toFixed(value < 10 ? 2 : 0) : value}{unit}
        </span>
      </div>
      <div style={{
        height:       5,
        background:   "#0a1628",
        borderRadius: 4,
        overflow:     "hidden",
        border:       "1px solid #142035",
      }}>
        <div style={{
          height:        "100%",
          width:         `${pct}%`,
          background:    `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius:  4,
          transition:    "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow:     `0 0 8px ${color}55`,
        }} />
      </div>
    </div>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      alignItems:     "center",
      padding:        "0.55rem 0",
      borderBottom:   "1px solid #142035",
    }}>
      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{label}</span>
      <span style={{
        fontSize:   "0.82rem",
        fontWeight: 600,
        color:      "#e2e8f0",
        textAlign:  "right",
        maxWidth:   "55%",
        fontFamily: label.includes("Position") ? "'JetBrains Mono', monospace" : "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    on_time:   { bg: "rgba(16,185,129,0.12)",  text: "#34d399", border: "rgba(16,185,129,0.25)" },
    delayed:   { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24", border: "rgba(245,158,11,0.25)" },
    at_risk:   { bg: "rgba(239,68,68,0.12)",   text: "#f87171", border: "rgba(239,68,68,0.25)"  },
    rerouting: { bg: "rgba(59,130,246,0.12)",  text: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  };
  const c = colors[status] ?? { bg: "rgba(148,163,184,0.08)", text: "#94a3b8", border: "#1a2d47" };
  return (
    <span style={{
      background:    c.bg,
      color:         c.text,
      border:        `1px solid ${c.border}`,
      padding:       "3px 12px",
      borderRadius:  999,
      fontSize:      "0.7rem",
      fontWeight:    700,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    }}>
      {status?.replace("_", " ") ?? "unknown"}
    </span>
  );
}

// ── Risk gauge (circular) ─────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const color    = riskColor(score);
  const label    = riskLabel(score);
  const pct      = Math.min(100, score);
  const radius   = 36;
  const circ     = 2 * Math.PI * radius;
  const dash     = (pct / 100) * circ;
  const gap      = circ - dash;

  return (
    <div style={{ textAlign: "right", position: "relative" }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        {/* Track */}
        <circle
          cx="45" cy="45" r={radius}
          fill="none"
          stroke="#142035"
          strokeWidth="6"
        />
        {/* Progress */}
        <circle
          cx="45" cy="45" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circ * 0.25}
          style={{
            filter:     `drop-shadow(0 0 6px ${color}66)`,
            transition: "stroke-dasharray 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
        {/* Score text */}
        <text
          x="45" y="42"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="14"
          fontWeight="800"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {Math.round(score)}
        </text>
        <text
          x="45" y="58"
          textAnchor="middle"
          fill="#64748b"
          fontSize="7"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing="0.5"
          textTransform="uppercase"
        >
          RISK
        </text>
      </svg>
      <div style={{
        fontSize:   "0.7rem",
        color,
        fontWeight: 600,
        marginTop:  -4,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShipmentDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [shipment,     setShipment]    = useState(null);
  const [features,     setFeatures]    = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [showReroute,  setShowReroute] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef(null);

  const handleContainerScroll = useCallback(() => {
    if (containerRef.current) {
      setShowScrollTop(containerRef.current.scrollTop > 200);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight:      "100vh",
        background:     "#060e1a",
        display:        "flex",
        flexDirection:  "column",
        fontFamily:     "'Inter', system-ui, sans-serif",
      }}>
        <NexusHeader />
        <div style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width:        40,
              height:       40,
              borderRadius: "50%",
              border:       "3px solid #1a2d47",
              borderTopColor: "#3b82f6",
              animation:    "spin 0.8s linear infinite",
              margin:       "0 auto 12px",
            }} />
            <p style={{
              color:    "#64748b",
              margin:   0,
              fontSize: "0.88rem",
            }}>
              Loading shipment {id}…
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not found
  if (!shipment) {
    return (
      <div style={{
        minHeight:      "100vh",
        background:     "#060e1a",
        display:        "flex",
        flexDirection:  "column",
        fontFamily:     "'Inter', system-ui, sans-serif",
      }}>
        <NexusHeader />
        <div style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}>
          <div style={{
            textAlign:    "center",
            background:   "#0f1f33",
            border:       "1px solid #1a2d47",
            borderRadius: 12,
            padding:      "2rem 2.5rem",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚠</div>
            <p style={{
              color:        "#f87171",
              fontWeight:   600,
              marginBottom: "1rem",
              fontSize:     "1rem",
            }}>
              Shipment "{id}" not found
            </p>
            <button
              onClick={() => navigate("/")}
              style={{
                background:   "#2563eb",
                color:        "#fff",
                border:       "none",
                borderRadius: 7,
                padding:      "0.6rem 1.5rem",
                cursor:       "pointer",
                fontSize:     "0.88rem",
                fontWeight:   600,
                transition:   "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const riskScore     = Number(shipment.risk_score ?? 0);
  const rColor        = riskColor(riskScore);
  const formattedEta  = shipment.eta
    ? new Date(shipment.eta).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

  return (
    <div
      ref={containerRef}
      onScroll={handleContainerScroll}
      style={{
        height:     "100vh",
        overflowY:  "auto",
        background: "#060e1a",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color:      "#e2e8f0",
      }}
    >
      <NexusHeader />

      <main style={{
        padding:   "1.4rem 1.6rem",
        maxWidth:  1000,
        margin:    "0 auto",
      }}>

        {/* ── Breadcrumb ── */}
        <div style={{
          display:     "flex",
          alignItems:  "center",
          gap:         "0.75rem",
          marginBottom:"1.25rem",
        }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background:   "rgba(59,130,246,0.1)",
              color:        "#60a5fa",
              border:       "1px solid rgba(59,130,246,0.25)",
              borderRadius: 6,
              padding:      "4px 14px",
              cursor:       "pointer",
              fontSize:     "0.78rem",
              fontWeight:   600,
              transition:   "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(59,130,246,0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(59,130,246,0.1)";
            }}
          >
            ← Dashboard
          </button>
          <span style={{ color: "#4b6280", fontSize: "0.75rem" }}>/</span>
          <span style={{
            fontSize:   "1rem",
            fontWeight: 700,
            color:      "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {id}
          </span>
          <StatusBadge status={shipment.status} />
        </div>

        {/* ── SHAP risk factors ── */}
        {shipment.top_risk_factors?.length > 0 && (
          <div style={{
            background:  "#0f1f33",
            border:      `1px solid #1a2d47`,
            borderLeft:  `4px solid ${rColor}`,
            borderRadius: 10,
            padding:     "1rem 1.25rem",
            marginBottom:"1rem",
            animation:   "fade-in 0.35s ease both",
          }}>
            <h2 style={{
              margin:    "0 0 0.9rem",
              fontSize:  "0.85rem",
              fontWeight: 700,
              color:     "#94a3b8",
              letterSpacing: "0.3px",
            }}>
              Why this risk score?
            </h2>
            <div style={{
              display:  "flex",
              gap:      "0.75rem",
              flexWrap: "wrap",
            }}>
              {shipment.top_risk_factors.map((rf, i) => {
                const isIncrease = rf.direction === "increase";
                const abs        = Math.abs(rf.contribution).toFixed(2);
                return (
                  <div key={i} style={{
                    flex:         "1 1 220px",
                    background:   isIncrease ? "#1f0d0d" : "#0b1a10",
                    border:       `1px solid ${isIncrease ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.2)"}`,
                    borderRadius: 8,
                    padding:      "0.65rem 0.9rem",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "0.6rem",
                    animation:    `fade-in ${0.3 + i * 0.08}s ease both`,
                  }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
                      {isIncrease ? "⬆" : "⬇"}
                    </span>
                    <div>
                      <div style={{
                        fontSize:  "0.82rem",
                        fontWeight: 600,
                        color:     isIncrease ? "#f87171" : "#34d399",
                      }}>
                        {rf.factor}
                      </div>
                      <div style={{
                        fontSize:  "0.7rem",
                        color:     "#64748b",
                        marginTop: 2,
                      }}>
                        {isIncrease ? "Increasing" : "Reducing"} risk · SHAP {abs}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Two-column: details + ML features ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:                 "1rem",
        }}>

          {/* Shipment Details */}
          <div style={{
            background:   "#0f1f33",
            border:       "1px solid #1a2d47",
            borderRadius: 10,
            padding:      "1.25rem",
            animation:    "fade-in 0.4s ease both",
          }}>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "flex-start",
              marginBottom:   "1.1rem",
            }}>
              <h2 style={{
                margin:    0,
                fontSize:  "0.9rem",
                fontWeight: 700,
                color:     "#94a3b8",
                letterSpacing: "0.3px",
              }}>
                Shipment Details
              </h2>
              <RiskGauge score={riskScore} />
            </div>

            <DetailRow label="Origin Port"       value={shipment.origin_port} />
            <DetailRow label="Destination Port"  value={shipment.destination_port} />
            <DetailRow label="Carrier"           value={shipment.carrier} />
            <DetailRow label="Cargo Type"        value={shipment.cargo_type || "—"} />
            <DetailRow label="ETA"               value={formattedEta} />
            <DetailRow label="Departure"         value={shipment.departure_date || "—"} />
            <DetailRow
              label="Position"
              value={
                shipment.current_lat != null
                  ? `${Number(shipment.current_lat).toFixed(3)}°, ${Number(shipment.current_lng).toFixed(3)}°`
                  : "—"
              }
            />

            <button
              onClick={() => setShowReroute(true)}
              style={{
                marginTop:     "1.25rem",
                width:         "100%",
                background:    "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color:         "#fff",
                border:        "1px solid rgba(96,165,250,0.25)",
                borderRadius:  7,
                padding:       "0.65rem",
                cursor:        "pointer",
                fontSize:      "0.88rem",
                fontWeight:    700,
                letterSpacing: "0.3px",
                transition:    "all 0.15s ease",
                boxShadow:     "0 4px 14px rgba(37,99,235,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #1d4ed8, #1e40af)";
                e.currentTarget.style.boxShadow  = "0 6px 20px rgba(37,99,235,0.45)";
                e.currentTarget.style.transform  = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)";
                e.currentTarget.style.boxShadow  = "0 4px 14px rgba(37,99,235,0.3)";
                e.currentTarget.style.transform  = "translateY(0)";
              }}
            >
              Reroute Shipment
            </button>
          </div>

          {/* ML Feature Vector */}
          <div style={{
            background:   "#0f1f33",
            border:       "1px solid #1a2d47",
            borderRadius: 10,
            padding:      "1.25rem",
            animation:    "fade-in 0.5s ease both",
          }}>
            <h2 style={{
              margin:    "0 0 1.1rem",
              fontSize:  "0.9rem",
              fontWeight: 700,
              color:     "#94a3b8",
              letterSpacing: "0.3px",
            }}>
              ML Feature Vector
            </h2>

            {features ? (
              <>
                <FeatureBar label="Weather Severity"      value={features.weather_severity}       max={1}  unit=" / 1.0" color="#f59e0b" />
                <FeatureBar label="Origin Congestion"     value={features.origin_congestion}       max={1}  unit=" / 1.0" color="#ef4444" />
                <FeatureBar label="Dest. Congestion"      value={features.dest_congestion}         max={1}  unit=" / 1.0" color="#ef4444" />
                <FeatureBar label="Carrier On-Time Rate"  value={features.carrier_ontime_rate}     max={1}  unit=" / 1.0" color="#10b981" />
                <FeatureBar label="Cargo Priority"        value={features.cargo_priority_weight}   max={10} unit=" / 10"  color="#8b5cf6" />
                <FeatureBar label="Days Until ETA"        value={features.days_until_eta}          max={60} unit=" days"  color="#3b82f6" />

                <div style={{
                  marginTop:      "0.5rem",
                  padding:        "0.6rem 0.85rem",
                  background:     "#0a1628",
                  borderRadius:   7,
                  border:         "1px solid #1a2d47",
                  display:        "flex",
                  justifyContent: "space-between",
                  alignItems:     "center",
                }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Route Distance</span>
                  <span style={{
                    fontSize:  "0.9rem",
                    fontWeight: 700,
                    color:     "#e2e8f0",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {Number(features.route_distance_km).toFixed(0)} km
                  </span>
                </div>
              </>
            ) : (
              <div style={{
                padding:   "2rem 0",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: 0.4 }}>⚙</div>
                <p style={{
                  color:    "#64748b",
                  fontSize: "0.85rem",
                  margin:   0,
                }}>
                  Feature vector unavailable.<br />
                  <span style={{ fontSize: "0.78rem", color: "#4b6280" }}>
                    ML engine is initialising.
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showReroute && (
        <RerouteModal shipment={shipment} onClose={() => setShowReroute(false)} />
      )}

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          title="Back to top"
          style={{
            position:     "fixed",
            bottom:       28,
            right:        28,
            width:        40,
            height:       40,
            borderRadius: "50%",
            background:   "linear-gradient(135deg, #1e3a5f, #0f2240)",
            border:       "1px solid rgba(59,130,246,0.35)",
            color:        "#60a5fa",
            fontSize:     "1rem",
            cursor:       "pointer",
            boxShadow:    "0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(59,130,246,0.18)",
            animation:    "fade-in 0.2s ease",
            zIndex:       500,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            transition:   "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform  = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.28)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform  = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(59,130,246,0.18)";
          }}
        >↑</button>
      )}
    </div>
  );
}
