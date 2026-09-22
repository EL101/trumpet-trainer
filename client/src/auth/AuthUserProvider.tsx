import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import type { AuthData } from "./AuthUserContext";
import { AuthUserContext } from "./AuthUserContext";

export default function AuthUserProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<AuthData>({ user: null, loading: true });
  useEffect(() => {
    // onIdTokenChanged rather than onAuthStateChanged: it fires on sign-in and
    // sign-out like the latter, but also when the token itself changes. That is
    // what carries a guest linking a Google account through to the rest of the
    // app -- the uid never changes, so onAuthStateChanged stays silent.
    return auth.onIdTokenChanged((userAuth) => {
      setUser({ user: userAuth, loading: false });
    });
  }, []);

  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}
