import React from "react";

/**
 * RiskBadge — colored badge showing risk score.
 *   0-30  → green (low risk)
 *   31-60 → amber (medium)
 *   61+   → red (high risk)
 */
export default function RiskBadge({ score }) {
  const numScore = parseFloat(score) || 0;
  let bg, label;
  if (numScore <= 30) {
    bg = "#22c55e";
    label = "LOW";
  } else if (numScore <= 60) {
    bg = "#f59e0b";
    label = "MEDIUM";
  } else {
    bg = "#ef4444";
    label = "HIGH";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        color: "#fff",
        background: bg,
      }}
    >
      {numScore.toFixed(1)} — {label}
    </span>
  );
}
