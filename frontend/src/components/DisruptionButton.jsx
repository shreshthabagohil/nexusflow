// frontend/src/components/DisruptionButton.jsx
import { useState } from "react";
import { postSimulateDisruption } from "../services/api";

export default function DisruptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await postSimulateDisruption({ type: "storm" });
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        background: loading ? "#a93226" : "#c0392b",
        color: "#fff",
        border: "none",
        borderRadius: "6px",
        padding: "0.6rem 1.25rem",
        cursor: loading ? "not-allowed" : "pointer",
        fontSize: "0.9rem",
        fontWeight: 600,
        opacity: loading ? 0.75 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {loading ? "Simulating..." : "Simulate Disruption"}
    </button>
  );
}
