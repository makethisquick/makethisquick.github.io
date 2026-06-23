import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastHost } from "./components/Toast";

const Landlord = lazy(() => import("./routes/Landlord"));
const Apply = lazy(() => import("./routes/Apply"));
const Lease = lazy(() => import("./routes/Lease"));

function Fallback() {
  return (
    <div className="app-main" style={{ display: "grid", placeItems: "center" }}>
      <div className="kicker">Loading…</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Landlord />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/lease" element={<Lease />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </BrowserRouter>
  );
}
