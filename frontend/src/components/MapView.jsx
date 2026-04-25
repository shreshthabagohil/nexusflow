/**
 * MapView — SVG world map with risk-coloured port pins.
 *
 * Uses react-simple-maps so country outlines render from bundled TopoJSON
 * data — no external tile CDN needed, works in any network environment.
 *
 * Props:
 *   shipments     {Array}    Live shipment list (updated via WebSocket)
 *   onViewReroute {Function} Called with shipment object when a pin is clicked
 */

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps";

// Public TopoJSON world file (110m resolution — tiny, fast)
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Port coordinates [lng, lat] — react-simple-maps uses [lng, lat] order
const PORT_COORDS = {
  "Shanghai":          [121.47,  31.23],
  "Singapore":         [103.82,   1.35],
  "Rotterdam":         [  4.48,  51.92],
  "Los Angeles":       [-118.26, 33.74],
  "Dubai (Jebel Ali)": [ 55.03,  24.99],
  "Hamburg":           [  9.97,  53.58],
  "Mumbai":            [ 72.82,  18.93],
  "Busan":             [129.08,  35.18],
  "Hong Kong":         [114.17,  22.32],
  "Antwerp":           [  4.40,  51.22],
  "New York":          [-74.04,  40.68],
  "Colombo":           [ 79.84,   6.93],
  "Port Klang":        [101.40,   3.00],
  "Long Beach":        [-118.19, 33.75],
  "Tanjung Pelepas":   [103.55,   1.36],
  "Yokohama":          [139.64,  35.44],
  "Durban":            [ 31.02, -29.86],
  "Santos":            [-46.33, -23.96],
  "Mombasa":           [ 39.67,  -4.04],
  "Jeddah":            [ 39.19,  21.49],
  "Felixstowe":        [  1.35,  51.96],
  "Vancouver":         [-123.12, 49.28],
  "Shenzhen":          [114.06,  22.54],
  "Qingdao":           [120.38,  36.07],
  "Tianjin":           [117.28,  38.91],
};

function riskColour(score) {
  if (score > 60) return "#ef4444";   // red-500
  if (score > 40) return "#f97316";   // orange-500
  return "#22c55e";                   // green-500
}

function aggregateByPort(shipments) {
  const portMap = {};
  for (const s of shipments) {
    const score = parseFloat(s.risk_score ?? 0);
    for (const field of ["origin_port", "destination_port"]) {
      const port = s[field];
      if (!port || !PORT_COORDS[port]) continue;
      if (!portMap[port]) portMap[port] = { maxScore: 0, shipments: [] };
      if (score > portMap[port].maxScore) portMap[port].maxScore = score;
      portMap[port].shipments.push(s);
    }
  }
  return portMap;
}

export default function MapView({ shipments = [], onViewReroute }) {
  const [tooltip, setTooltip] = useState(null);
  const portMap = aggregateByPort(shipments);

  const riskLines = shipments
    .filter((s) => parseFloat(s.risk_score ?? 0) > 60)
    .map((s) => {
      const from = PORT_COORDS[s.origin_port];
      const to   = PORT_COORDS[s.destination_port];
      if (!from || !to) return null;
      return { id: s.id, from, to };
    })
    .filter(Boolean);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0f172a" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [10, 15], scale: 140 }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Country fills + visible borders — no CDN tiles needed */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill:        "#1e293b",
                    stroke:      "#334155",
                    strokeWidth: 0.5,
                    outline:     "none",
                  },
                  hover:   { fill: "#1e293b", outline: "none" },
                  pressed: { fill: "#1e293b", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* Dashed red lines for at-risk shipment routes */}
        {riskLines.map((line) => (
          <Line
            key={line.id}
            from={line.from}
            to={line.to}
            stroke="#ef4444"
            strokeWidth={1}
            strokeOpacity={0.35}
            strokeDasharray="4 3"
          />
        ))}

        {/* One marker per port — colour/size by worst risk score */}
        {Object.entries(portMap).map(([portName, { maxScore, shipments: ps }]) => {
          const coords = PORT_COORDS[portName];
          const colour = riskColour(maxScore);
          const r      = maxScore > 60 ? 6 : maxScore > 40 ? 4.5 : 3.5;
          const worstShipment = ps.reduce(
            (best, s) =>
              parseFloat(s.risk_score ?? 0) > parseFloat(best.risk_score ?? 0) ? s : best,
            ps[0]
          );

          return (
            <Marker
              key={portName}
              coordinates={coords}
              onMouseEnter={(evt) =>
                setTooltip({ portName, maxScore, count: ps.length, x: evt.clientX, y: evt.clientY })
              }
              onMouseLeave={() => setTooltip(null)}
              onClick={() => {
                if (onViewReroute && maxScore > 60) onViewReroute(worstShipment);
              }}
              style={{ cursor: maxScore > 60 ? "pointer" : "default" }}
            >
              {/* Outer ring for high-risk ports */}
              {maxScore > 60 && (
                <circle r={r + 5} fill="none" stroke={colour} strokeWidth={1} strokeOpacity={0.35} />
              )}
              <circle r={r} fill={colour} fillOpacity={0.9} stroke="#0f172a" strokeWidth={0.8} />
            </Marker>
          );
        })}
      </ComposableMap>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          style={{
            position:      "fixed",
            left:          tooltip.x + 14,
            top:           tooltip.y - 12,
            background:    "rgba(15,23,42,0.95)",
            border:        `1px solid ${riskColour(tooltip.maxScore)}`,
            borderRadius:  6,
            padding:       "6px 10px",
            pointerEvents: "none",
            zIndex:        9999,
            fontFamily:    "monospace",
            fontSize:      12,
            color:         "#e2e8f0",
            whiteSpace:    "nowrap",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 2 }}>{tooltip.portName}</div>
          <div>{tooltip.count} shipment{tooltip.count !== 1 ? "s" : ""}</div>
          <div>
            Max risk:{" "}
            <span style={{ color: riskColour(tooltip.maxScore), fontWeight: "bold" }}>
              {tooltip.maxScore.toFixed(1)}
            </span>
          </div>
          {tooltip.maxScore > 60 && (
            <div style={{ color: "#94a3b8", marginTop: 2 }}>Click to reroute</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position:   "absolute",
          bottom:     12,
          right:      12,
          background: "rgba(15,23,42,0.85)",
          border:     "1px solid #334155",
          borderRadius: 6,
          padding:    "8px 12px",
          fontSize:   11,
          color:      "#94a3b8",
        }}
      >
        {[
          ["#22c55e", "Low risk  (<40)"],
          ["#f97316", "Watch  (40–60)"],
          ["#ef4444", "At risk  (>60)"],
        ].map(([c, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
