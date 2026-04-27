// frontend/src/hooks/useShipments.js
import { useState, useEffect, useCallback } from "react";
import { getShipments, getMockShipments } from "../services/api";

export function useShipments() {
  // ── Instant initial state: mock data rendered on first paint, no loading wait ──
  const [shipments, setShipments] = useState(getMockShipments);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const fetchShipments = useCallback(async () => {
    // Don't show a spinner — we already have mock data on screen.
    // Silently try the backend; if it responds with real data, swap it in.
    try {
      const data = await getShipments();
      if (data && data.length > 0) {
        setShipments(data);
      }
    } catch (err) {
      // Backend unreachable — mock data is already showing, nothing to do.
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return { shipments, loading, error, refetch: fetchShipments };
}
