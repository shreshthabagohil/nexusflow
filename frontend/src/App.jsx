import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import ShipmentDetail from "./components/ShipmentDetail.jsx";
import AnalyticsDashboard from "./components/AnalyticsDashboard.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Dashboard />} />
        <Route path="/shipments/:id" element={<ShipmentDetail />} />
        <Route path="/analytics"   element={<AnalyticsDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
