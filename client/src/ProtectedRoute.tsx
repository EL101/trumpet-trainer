import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner, Center } from "@chakra-ui/react";
import { useAuth } from "./auth/useAuth";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center height="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}