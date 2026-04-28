import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import { useMemo, useState } from "react";

// Note: riskFilter + onFilterChange + tierCounts can be passed as props (controlled mode)
// or omitted to use internal state (standalone mode).

const PORT_COORDS = {
  "Singapore":          [1.3521,   103.8198],
  "Mumbai":             [18.9254,   72.8242],
  "Rotterdam":          [51.9244,    4.4777],
  "Mombasa":            [-4.0435,   39.6682],
  "Los Angeles":        [33.7395, -118.2592],
  "Vancouver":          [49.2827, -123.1207],
  "Hamburg":            [53.5753,    9.9690],
  "Dubai (Jebel Ali)":  [24.9857,   55.0272],
  "Busan":              [35.1796,  129.0756],
  "Yokohama":           [35.4437,  139.6380],
  "Antwerp":            [51.2213,    4.3997],
  "New York":           [40.6840,  -74.0445],
  "Durban":             [-29.8587,  31.0218],
  "Colombo":            [6.9333,    79.8428],
  "Hong Kong":          [22.3193,  114.1694],
  "Felixstowe":         [51.9559,    1.3512],
  "Port Klang":         [3.0000,   101.4000],
  "Long Beach":         [33.7543, -118.1890],
  "Santos":             [-23.9608, -46.3336],
  "Tanjung Pelepas":    [1.3630,   103.5534],
  "Shenzhen":           [22.5431,  114.0579],
  "Shanghai":           [31.2304,  121.4737],
  "Qingdao":            [36.0671,  120.3826],
  "Tianjin":            [38.9142,  117.2804],
  "Jeddah":             [21.4858,   39.1925],
};

function riskColor(score, status) {
  if (score > 90) return "#ff2d2d";   // Critical — brighter scarlet
  if (score > 60) return "#ef4444";   // High
  if (score > 40) return "#f59e0b";   // Medium
  return "#10b981";                   // Low
}

function riskTier(score) {
  if (score > 90) return "critical";
  if (score > 60) return "high";
  if (score > 40) return "medium";
  return "low";
}

function arcPoints(lat1, lng1, lat2, lng2, n = 28) {
  const midLat  = (lat1 + lat2) / 2;
  const midLng  = (lng1 + lng2) / 2;
  const dist    = Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
  const ctrlLat = midLat + dist * 0.4;
  const pts     = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * ctrlLat + t ** 2 * lat2,
      (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * midLng  + t ** 2 * lng2,
    ]);
  }
  return pts;
}

const FILTERS = [
  { key: "all",       label: "All",       dot: null,      color: "#94a3b8", activeColor: "#e2e8f0" },
  { key: "critical",  label: "Critical",  dot: "#ff2d2d", color: "#ff6060", activeColor: "#ff9090" },
  { key: "high",      label: "High",      dot: "#ef4444", color: "#f87171", activeColor: "#fca5a5" },
  { key: "medium",    label: "Medium",    dot: "#f59e0b", color: "#fbbf24", activeColor: "#fde68a" },
  { key: "low",       label: "Low",       dot: "#10b981", color: "#34d399", activeColor: "#6ee7b7" },
  { key: "delayed",   label: "Delayed",   dot: "#fb923c", color: "#fdba74", activeColor: "#fed7aa" },
  { key: "rerouting", label: "Rerouting", dot: "#8b5cf6", color: "#a78bfa", activeColor: "#c4b5fd" },
];

const PREVIEW_COUNT = 5; // dots shown per tier in "all" mode

export default function MapView({ shipments, riskFilter: riskFilterProp, onFilterChange, tierCounts: tierCountsProp }) {
  // Support controlled (from Dashboard) or standalone (internal state) mode
  const [internalFilter, setInternalFilter] = useState("all");
  const riskFilter    = riskFilterProp    ?? internalFilter;
  const setRiskFilter = onFilterChange    ?? setInternalFilter;
  const controlled    = riskFilterProp    !== undefined;

  // Hovered ship ID — drives route-on-hover behavior
  const [hoveredId, setHoveredId] = useState(null);

  const isPreviewMode = riskFilter === "all";

  // Count per tier — use prop if provided (avoids duplicate computation)
  const tierCountsLocal = useMemo(() => {
    if (tierCountsProp) return tierCountsProp;
    if (!shipments?.length) return { critical: 0, high: 0, medium: 0, low: 0, delayed: 0, rerouting: 0 };
    return {
      critical:  shipments.filter((s) => Number(s.risk_score) > 90).length,
      high:      shipments.filter((s) => Number(s.risk_score) > 60 && Number(s.risk_score) <= 90).length,
      medium:    shipments.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 60).length,
      low:       shipments.filter((s) => Number(s.risk_score) < 40).length,
      delayed:   shipments.filter((s) => s.status === "delayed").length,
      rerouting: shipments.filter((s) => s.status === "rerouting").length,
    };
  }, [shipments, tierCountsProp]);
  const tierCounts = tierCountsProp ?? tierCountsLocal;

  // What dots to show
  const visibleShipments = useMemo(() => {
    if (!shipments?.length) return [];

    const sortDesc = (arr) =>
      [...arr].sort((a, b) => Number(b.risk_score) - Number(a.risk_score));

    if (riskFilter === "all") {
      // Preview mode: top 5 from each score tier
      return [
        ...sortDesc(shipments.filter((s) => Number(s.risk_score) > 90)).slice(0, PREVIEW_COUNT),
        ...sortDesc(shipments.filter((s) => Number(s.risk_score) > 60 && Number(s.risk_score) <= 90)).slice(0, PREVIEW_COUNT),
        ...sortDesc(shipments.filter((s) => Number(s.risk_score) >= 40 && Number(s.risk_score) <= 60)).slice(0, PREVIEW_COUNT),
        ...sortDesc(shipments.filter((s) => Number(s.risk_score) < 40)).slice(0, PREVIEW_COUNT),
      ];
    }

    if (riskFilter === "delayed")   return shipments.filter((s) => s.status === "delayed");
    if (riskFilter === "rerouting") return shipments.filter((s) => s.status === "rerouting");

    return shipments.filter((s) => riskTier(Number(s.risk_score)) === riskFilter);
  }, [shipments, riskFilter]);

  // Ambient arc lines — only shown in preview "all" mode (top high-risk routes as context)
  // In filter mode: NO ambient arcs. Routes only appear on hover.
  const ambientArcs = useMemo(() => {
    if (!isPreviewMode || !shipments?.length) return [];
    return shipments
      .filter((s) => Number(s.risk_score) > 60)
      .slice(0, 12)
      .map((s) => {
        const o = PORT_COORDS[s.origin_port];
        const d = PORT_COORDS[s.destination_port];
        if (!o || !d) return null;
        const score = Number(s.risk_score);
        return { id: s.id, points: arcPoints(o[0], o[1], d[0], d[1]), color: riskColor(score, s.status), score };
      })
      .filter(Boolean);
  }, [shipments, isPreviewMode]);

  // Hovered route — split into completed (origin→current, faded) and remaining (current→dest, bright)
  // Ship dot sits exactly at the seam between the two arcs.
  const hoveredRoute = useMemo(() => {
    if (!hoveredId) return null;
    const allShips = shipments ?? [];
    const s = allShips.find((x) => x.id === hoveredId);
    if (!s) return null;
    const o     = PORT_COORDS[s.origin_port];
    const d     = PORT_COORDS[s.destination_port];
    const color = riskColor(Number(s.risk_score), s.status);
    const hasPos = s.current_lat != null && s.current_lng != null;
    const cur   = hasPos ? [s.current_lat, s.current_lng] : null;

    return {
      // Completed portion: origin port → current position (faded dashed)
      completed: o && cur  ? arcPoints(o[0], o[1], cur[0], cur[1], 18) : null,
      // Remaining portion: current position → destination port (bright solid)
      remaining: cur && d  ? arcPoints(cur[0], cur[1], d[0], d[1], 18) : null,
      // Fallback full arc if no position data
      fullArc:   (!cur && o && d) ? arcPoints(o[0], o[1], d[0], d[1]) : null,
      origin:    o,
      dest:      d,
      color,
      score:     Number(s.risk_score),
    };
  }, [hoveredId, shipments]);

  if (!shipments?.length) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "#060e1a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "#4b6280", fontSize: "0.85rem" }}>Awaiting data…</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={[22, 12]}
        zoom={2}
        style={{ height: "100%", width: "100%", background: "#060e1a" }}
        preferCanvas={true}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Ambient arcs — only in preview "all" mode, top 12 high-risk routes */}
        {ambientArcs.map((arc) => (
          <Polyline
            key={arc.id + "-ambient"}
            positions={arc.points}
            pathOptions={{
              color:     arc.color,
              weight:    1.2,
              opacity:   arc.score > 85 ? 0.45 : 0.22,
              dashArray: "6 10",
            }}
          />
        ))}

        {/* Hover route — completed portion (origin → current ship pos, faded dashed) */}
        {hoveredRoute?.completed && (
          <Polyline
            positions={hoveredRoute.completed}
            pathOptions={{
              color:     hoveredRoute.color,
              weight:    1.8,
              opacity:   0.35,
              dashArray: "5 7",
            }}
          />
        )}

        {/* Hover route — remaining portion (current ship pos → destination, bright solid) */}
        {hoveredRoute?.remaining && (
          <Polyline
            positions={hoveredRoute.remaining}
            pathOptions={{
              color:   hoveredRoute.color,
              weight:  2.5,
              opacity: 0.88,
            }}
          />
        )}

        {/* Fallback full arc when no GPS position available */}
        {hoveredRoute?.fullArc && (
          <Polyline
            positions={hoveredRoute.fullArc}
            pathOptions={{
              color:     hoveredRoute.color,
              weight:    2.5,
              opacity:   0.75,
              dashArray: "7 5",
            }}
          />
        )}

        {/* Origin port dot */}
        {hoveredRoute?.origin && (
          <CircleMarker
            center={hoveredRoute.origin}
            radius={4}
            pathOptions={{
              color:       hoveredRoute.color,
              fillColor:   hoveredRoute.color,
              fillOpacity: 0.35,
              weight:      1.5,
              opacity:     0.6,
              dashArray:   "3 3",
            }}
          />
        )}

        {/* Destination port dot */}
        {hoveredRoute?.dest && (
          <CircleMarker
            center={hoveredRoute.dest}
            radius={4}
            pathOptions={{
              color:       hoveredRoute.color,
              fillColor:   hoveredRoute.color,
              fillOpacity: 0.55,
              weight:      2,
              opacity:     0.8,
            }}
          />
        )}

        {/* Ship markers */}
        {visibleShipments.map((s) => {
          if (s.current_lat == null || s.current_lng == null) return null;
          const score     = Number(s.risk_score ?? 0);
          const isReroute = s.status === "rerouting";
          const color     = riskColor(score, s.status);
          const isHovered = s.id === hoveredId;

          // Base dot sizing
          let radius, strokeWeight, strokeOpacity;
          if (isPreviewMode) {
            if (isReroute || score > 60)  { radius = 10; strokeWeight = 7; strokeOpacity = 0.18; }
            else if (score > 40)           { radius = 7;  strokeWeight = 5; strokeOpacity = 0.15; }
            else                           { radius = 5;  strokeWeight = 4; strokeOpacity = 0.12; }
          } else {
            if (riskFilter === "rerouting") { radius = 4.5; strokeWeight = 4; strokeOpacity = 0.2; }
            else if (score > 60)            { radius = 4;   strokeWeight = 3; strokeOpacity = 0.2; }
            else if (score > 40)            { radius = 3.5; strokeWeight = 2; strokeOpacity = 0.18; }
            else                            { radius = 3;   strokeWeight = 2; strokeOpacity = 0.15; }
          }
          // Hovered dot: bigger + brighter ring
          if (isHovered) { radius += 3; strokeWeight = 8; strokeOpacity = 0.35; }

          return (
            <CircleMarker
              key={s.id}
              center={[s.current_lat, s.current_lng]}
              radius={radius}
              pathOptions={{
                color:       color,
                fillColor:   color,
                fillOpacity: isHovered ? 1 : 0.88,
                weight:      strokeWeight,
                opacity:     strokeOpacity,
              }}
              eventHandlers={{
                mouseover: () => setHoveredId(s.id),
                mouseout:  () => setHoveredId(null),
              }}
            >
              <Popup>
                <div style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize:   "0.78rem",
                  lineHeight: 1.65,
                  minWidth:   165,
                  color:      "#e2e8f0",
                }}>
                  <div style={{
                    fontWeight: 700, marginBottom: 5,
                    color:      "#e2e8f0",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize:   "0.8rem",
                    display:    "flex", alignItems: "center", gap: 6,
                  }}>
                    {s.id}
                    {isReroute && (
                      <span style={{
                        background: "rgba(139,92,246,0.2)",
                        color:      "#a78bfa",
                        border:     "1px solid rgba(139,92,246,0.3)",
                        borderRadius: 3,
                        padding:    "0 5px",
                        fontSize:   "0.6rem",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}>
                        REROUTING
                      </span>
                    )}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "0.73rem", display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    {s.origin_port}
                    <span style={{ color: "#3b82f6" }}>→</span>
                    {s.destination_port}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.7rem", marginBottom: 7 }}>
                    {s.carrier}{s.cargo_type ? ` · ${s.cargo_type}` : ""}
                  </div>
                  <div style={{
                    display:     "inline-flex",
                    alignItems:  "center", gap: 5,
                    background:  `${color}18`,
                    border:      `1px solid ${color}33`,
                    borderRadius: 4,
                    padding:     "2px 8px",
                    fontSize:    "0.72rem", fontWeight: 700, color,
                  }}>
                    ⚠ Risk: {score.toFixed(1)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* ── Filter bar — only shown in standalone (uncontrolled) mode ── */}
      {!controlled && (
        <div style={{
          position:       "absolute",
          top:            10,
          left:           50,
          zIndex:         1000,
          display:        "flex",
          alignItems:     "center",
          gap:            3,
          background:     "linear-gradient(135deg, rgba(10,22,40,0.97) 0%, rgba(6,14,26,0.97) 100%)",
          borderRadius:   9,
          padding:        "5px 10px",
          border:         "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(16px)",
          boxShadow:      "inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(0,0,0,0.4)",
        }}>
          <span style={{
            fontSize: "0.58rem", color: "#4b6280", fontWeight: 700,
            letterSpacing: "1.2px", textTransform: "uppercase",
            paddingRight: 7, borderRight: "1px solid rgba(255,255,255,0.06)", marginRight: 2,
          }}>
            Filter
          </span>
          {FILTERS.map((f) => {
            const active = riskFilter === f.key;
            const count  = f.key === "critical" ? tierCounts.critical : f.key === "high" ? tierCounts.high : f.key === "medium" ? tierCounts.medium : f.key === "low" ? tierCounts.low : f.key === "rerouting" ? tierCounts.rerouting : null;
            return (
              <button key={f.key} onClick={() => setRiskFilter(f.key)} style={{
                background: active ? (f.key === "all" ? "rgba(148,163,184,0.12)" : `${f.dot}20`) : "transparent",
                color: active ? f.activeColor : "#4b6280",
                border: active ? `1px solid ${f.key === "all" ? "rgba(148,163,184,0.25)" : f.dot + "44"}` : "1px solid transparent",
                borderRadius: 5, padding: "3px 9px", fontSize: "0.7rem", fontWeight: active ? 700 : 400,
                cursor: "pointer", transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 4,
                boxShadow: active && f.dot ? `0 0 8px ${f.dot}30` : "none",
              }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#94a3b8"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#4b6280"; }}
              >
                {f.dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: f.dot, display: "inline-block", flexShrink: 0, opacity: active ? 1 : 0.45, boxShadow: active ? `0 0 6px ${f.dot}` : "none" }} />}
                {f.label}
                {count !== null && <span style={{ background: active ? `${f.dot}22` : "rgba(255,255,255,0.05)", color: active ? f.color : "#4b6280", borderRadius: 3, padding: "0 5px", fontSize: "0.6rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Preview mode hint ─────────────────────────────────────── */}
      {isPreviewMode && (
        <div style={{
          position:       "absolute",
          top:            10,
          right:          10,
          zIndex:         1000,
          background:     "linear-gradient(135deg, rgba(10,22,40,0.96) 0%, rgba(6,14,26,0.96) 100%)",
          border:         "1px solid rgba(255,255,255,0.06)",
          borderRadius:   8,
          padding:        "6px 12px",
          backdropFilter: "blur(12px)",
          boxShadow:      "inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.5)",
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
        }}>
          <div style={{
            fontSize: "0.58rem", color: "#4b6280", fontWeight: 700,
            letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2,
          }}>
            Preview · Top 5 per tier
          </div>
          {[
            { label: `${PREVIEW_COUNT} of ${tierCounts.critical} Critical`, color: "#ff2d2d" },
            { label: `${PREVIEW_COUNT} of ${tierCounts.high} High`,         color: "#ef4444" },
            { label: `${PREVIEW_COUNT} of ${tierCounts.medium} Medium`,     color: "#f59e0b" },
            { label: `${PREVIEW_COUNT} of ${tierCounts.low} Low`,           color: "#10b981" },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: r.color, flexShrink: 0,
                boxShadow: `0 0 5px ${r.color}88`,
              }} />
              <span style={{ fontSize: "0.67rem", color: "#64748b" }}>{r.label}</span>
            </div>
          ))}
          <div style={{
            marginTop:  3,
            fontSize:   "0.6rem",
            color:      "#3b5c80",
            fontStyle:  "italic",
          }}>
            Click a filter to see all →
          </div>
        </div>
      )}

      {/* ── Legend (bottom-right) ─────────────────────────────────── */}
      <div style={{
        position:       "absolute",
        bottom:         30,
        right:          10,
        zIndex:         1000,
        background:     "linear-gradient(145deg, rgba(12,26,44,0.97) 0%, rgba(6,14,26,0.97) 100%)",
        border:         "1px solid rgba(255,255,255,0.06)",
        borderRadius:   9,
        padding:        "0.6rem 0.85rem",
        backdropFilter: "blur(12px)",
        boxShadow:      "inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.55)",
      }}>
        <div style={{
          fontSize: "0.56rem", color: "#4b6280", fontWeight: 700,
          letterSpacing: "1.1px", textTransform: "uppercase", marginBottom: 6,
        }}>
          Risk Level
        </div>
        {[
          { color: "#10b981", label: "Low  ·  < 40"    },
          { color: "#f59e0b", label: "Watch  ·  40–60" },
          { color: "#ef4444", label: "High  ·  > 60"   },
          { color: "#8b5cf6", label: "Rerouting"       },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: l.color, flexShrink: 0,
              boxShadow: `0 0 6px ${l.color}77`,
            }} />
            <span style={{ fontSize: "0.67rem", color: "#94a3b8", letterSpacing: "0.2px" }}>
              {l.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
