import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
};

interface RequireAdminRouteProps {
  children: ReactNode;
  fallbackTo?: string;
}

export const RequireAdminRoute = ({ children, fallbackTo = "/dashboard" }: RequireAdminRouteProps) => {
  const { isAuthenticated, canWrite } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (!canWrite()) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
};
