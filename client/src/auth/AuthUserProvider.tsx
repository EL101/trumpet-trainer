import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import type { AuthData } from "./AuthUserContext";
import { AuthUserContext } from "./AuthUserContext";

export default function AuthUserProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<AuthData>({ user: null, loading: true });
  useEffect(() => {
    auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser({ user: userAuth, loading: false });
      } else {
        setUser({ user: null, loading: false });
      }
    });
  }, []);

  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}
