import "./App.css";
import AuthUserProvider from "./auth/AuthUserProvider";
import Dashboard from "./components/Dashboard";
import LandingPage from "./components/LandingPage";
import PitchTest from "./components/PitchTest";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <AuthUserProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/test" element={<PitchTest />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </AuthUserProvider>
    </BrowserRouter>
  );
}

export default App;
