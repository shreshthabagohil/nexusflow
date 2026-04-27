import React, { useState } from "react";
import { postSimulateDisruption } from "../services/api";

/**
 * DisruptionButton — big red button to simulate Rotterdam port closure.
 *
 * On click: calls POST /api/simulation/disrupt with { port: "Rotterdam", severity: 9.5 }
 * Shows success/error feedback for 3 seconds.
 */
export default function DisruptionButton() {
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState(null); // { type: "success"|"error", message }

  const handleClick = async () => {
    setSimulating(true);
    setResult(null);

    try {
      const res = await postSimulateDisruption({
        port: "Rotterdam",
        severity: 9.5,
      });

      if (res) {
        setResult({
          type: "success",
          message: `Disruption simulated! ${res.shipments_queued || 0} shipments queued.`,
        });
      } else {
        setResult({ type: "error", message: "Error: could not connect to API" });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: "Error: could not connect to API",
      });
    } finally {
      setSimulating(false);
      // Clear feedback after 3 seconds
      setTimeout(() => setResult(null), 3000);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <button
        style={{
          ...styles.button,
          opacity: simulating ? 0.6 : 1,
          cursor: simulating ? "not-allowed" : "pointer",
        }}
        onClick={handleClick}
        disabled={simulating}
      >
        {simulating ? "Simulating..." : "Simulate Rotterdam Closure"}
      </button>

      {result && (
        <div
          style={{
            ...styles.feedback,
            background: result.type === "success" ? "#065f46" : "#7f1d1d",
            borderColor: result.type === "success" ? "#10b981" : "#ef4444",
          }}
        >
          {result.type === "success" ? "✅" : "✕"} {result.message}
        </div>
      )}
    </div>
  );
}

const styles = {
  button: {
    width: "100%",
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 700,
    background: "#dc2626",
    color: "#fff",
    border: "2px solid #ef4444",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  feedback: {
    marginTop: 8,
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid",
    animation: "fadeIn 0.3s ease",
  },
};
