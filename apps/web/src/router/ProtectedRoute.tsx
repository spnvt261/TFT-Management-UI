import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

interface RequireAdminRouteProps {
  children: ReactNode;
  fallbackTo?: string;
}

export const RequireAdminRoute = ({ children, fallbackTo = "/dashboard" }: RequireAdminRouteProps) => {
  const { canWrite } = useAuth();

  if (!canWrite()) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
};
