import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";
import ShipmentDetail from "./components/ShipmentDetail.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shipments/:id" element={<ShipmentDetail />} />
      </Routes>
    </BrowserRouter>
  );
}