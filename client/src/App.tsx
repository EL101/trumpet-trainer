import "./App.css";
import LandingPage from "./LandingPage";
import PitchTest from "./PitchTest";

import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/test" element={<PitchTest />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
