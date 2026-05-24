import "./App.css";
import AuthUserProvider from "./auth/AuthUserProvider";
import LandingPage from "./components/LandingPage";
import PitchTest from "./components/PitchTest";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import Profile from "./components/Profile";
import Today from "./components/Today";
import SheetMusic from "./components/SheetMusic";

function App() {
  return (
    <BrowserRouter>
      <AuthUserProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/test" element={<PitchTest />} />
          <Route
            path="/sheet-test"
            element={
              <SheetMusic
                notes="C#5/q, B4, A4, G#4, G4/32, G4/16., G4/h."
                timeSig="4/4"
                border="1px solid red"
              />
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<Today />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </AuthUserProvider>
    </BrowserRouter>
  );
}

export default App;
