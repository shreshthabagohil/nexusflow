// frontend/src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000",
});

export async function getShipments() {
  try {
    const res = await api.get("/shipments");
    return res.data;
  } catch (err) {
    console.error("getShipments error:", err);
    return null;
  }
}

export async function getShipment(id) {
  try {
    const res = await api.get(`/shipments/${id}`);
    return res.data;
  } catch (err) {
    console.error(`getShipment(${id}) error:`, err);
    return null;
  }
}

export async function getAnalytics() {
  try {
    const res = await api.get("/analytics");
    return res.data;
  } catch (err) {
    console.error("getAnalytics error:", err);
    return null;
  }
}

export async function postSimulateDisruption(event) {
  try {
    const res = await api.post("/simulate/disruption", event);
    return res.data;
  } catch (err) {
    console.error("postSimulateDisruption error:", err);
    return null;
  }
}

export default api;
