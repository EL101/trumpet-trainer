import "./App.css";
import AuthUserProvider from "./auth/AuthUserProvider";
import ProfileProvider from "./profile/ProfileProvider";
import EtudesProvider from "./etudes/EtudesProvider";
import { Toaster } from "@/components/primitives";
import LandingPage from "./pages/LandingPage";
import PitchTest from "./pages/PitchTest";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import Profile from "./pages/Profile";
// Today and Progress aren't built yet; their routes go to Generate until they are.
// import Today from "./pages/Today";
import { SheetMusic } from "./components/SheetMusic";
import { Generate } from "./pages/Generate";
import { Library } from "./pages/Library";
import Tools from "./pages/Tools";
// import Progress from "./pages/Progress";
import DesignPreview from "./pages/DesignPreview";
import Practice from "./pages/Practice";
import { PRACTICE_PATH } from "./lib/practice";

function App() {
  return (
    <BrowserRouter>
      <AuthUserProvider>
        <ProfileProvider>
          <EtudesProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/test" element={<PitchTest />} />
              {import.meta.env.DEV && <Route path="/design" element={<DesignPreview />} />}
              <Route
                path="/sheet-test"
                element={
                  <SheetMusic
                    notes="C#5/q, B4, A4, G#4, G4/32, G4/16., G4/h."
                    timeSig="4/4"
                    musicKey="C major"
                    border="1px solid red"
                  />
                }
              />
              {/* <Route element={<ProtectedRoute />}>
                <Route path="/today" element={<Today />} />
              </Route> */}
              <Route path="/today" element={<Navigate to="/generate" replace />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/generate" element={<Generate />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/library" element={<Library />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path={`${PRACTICE_PATH}/:exerciseId`} element={<Practice />} />
                {/* No exercise named: go and make one. */}
                <Route path={PRACTICE_PATH} element={<Navigate to="/generate" replace />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/tools" element={<Tools />} />
              </Route>
              {/* The tuner and metronome had pages of their own before Tools. */}
              <Route path="/tuner" element={<Navigate to="/tools" replace />} />
              <Route path="/metronome" element={<Navigate to="/tools" replace />} />
              {/* <Route element={<ProtectedRoute />}>
                <Route path="/progress" element={<Progress />} />
              </Route> */}
              <Route path="/progress" element={<Navigate to="/generate" replace />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Routes>
            <Toaster />
          </EtudesProvider>
        </ProfileProvider>
      </AuthUserProvider>
    </BrowserRouter>
  );
}

export default App;
