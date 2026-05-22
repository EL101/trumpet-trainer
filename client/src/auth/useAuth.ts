import { useContext } from "react";
import { AuthUserContext } from "./AuthUserContext";

export const useAuth = () => {
  const context = useContext(AuthUserContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthUserProvider");
  }
  return context;
};

export const loading = () => {
  
}
