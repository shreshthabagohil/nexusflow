// frontend/src/hooks/useWebSocket.js
import { useState, useEffect, useRef, useCallback } from "react";

const MAX_BACKOFF = 30000;

export function useWebSocket(wsUrl) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  const wsRef = useRef(null);
  const attemptsRef = useRef(0);
  const timeoutRef = useRef(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) return;
      setConnected(true);
      setReconnecting(false);
      attemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (unmountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data);
        setLastMessage(parsed);
      } catch (err) {
        console.error("useWebSocket: failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), MAX_BACKOFF);
      attemptsRef.current += 1;
      setReconnecting(true);
      timeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      console.error("useWebSocket error:", err);
      ws.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected, lastMessage, reconnecting };
}
