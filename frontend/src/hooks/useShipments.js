// frontend/src/hooks/useShipments.js
import { useState, useEffect, useCallback } from "react";
import { getShipments } from "../services/api";

export function useShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);

    const data = await getShipments();

    // getShipments() always returns an array (never null) after our fix.
    // An empty array here would only happen if mock data itself was empty,
    // which is a dev misconfiguration — surface it clearly.
    if (!data || data.length === 0) {
      setError("No shipment data available.");
      setShipments([]);
    } else {
      setShipments(data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return { shipments, loading, error, refetch: fetchShipments };
}