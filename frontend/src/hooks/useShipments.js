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
    if (data === null) {
      setError("Failed to load shipments.");
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
