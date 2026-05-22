import type { User } from "firebase/auth";
import { createContext } from "react";

export type AuthData = {
  user?: User | null;
  loading: boolean;
};

export const AuthUserContext = createContext<AuthData>({ user: null, loading: true });
