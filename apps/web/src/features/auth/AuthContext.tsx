import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearAuthSession, getAuthSession, subscribeAuthSession } from "@/features/auth/session";
import { bootstrapAuthSession, fallbackToUserSession, loginAsAdmin } from "@/features/auth/authSessionManager";
import type { LoginResponseDto, RoleCode } from "@/types/api";

interface AuthContextValue {
  accessToken: string | null;
  role: RoleCode | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  loginAsAdmin: (accessCode: string) => Promise<LoginResponseDto>;
  logout: () => void;
  hasRole: (role: RoleCode) => boolean;
  canWrite: () => boolean;
  canRead: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState(getAuthSession());
  const [isBootstrapping, setIsBootstrapping] = useState(() => !(session.accessToken && session.role));

  useEffect(() => subscribeAuthSession(setSession), []);

  useEffect(() => {
    let active = true;

    void bootstrapAuthSession().finally(() => {
      if (active) {
        setIsBootstrapping(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleAdminLogin = useCallback(async (accessCode: string) => {
    return loginAsAdmin(accessCode);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    void fallbackToUserSession();
  }, []);

  const hasRole = useCallback(
    (role: RoleCode) => {
      return session.role === role;
    },
    [session.role]
  );

  const canWrite = useCallback(() => session.role === "ADMIN", [session.role]);

  const canRead = useCallback(() => true, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session.accessToken,
      role: session.role,
      isBootstrapping,
      isAuthenticated: Boolean(session.accessToken && session.role),
      loginAsAdmin: handleAdminLogin,
      logout,
      hasRole,
      canWrite,
      canRead
    }),
    [canRead, canWrite, handleAdminLogin, hasRole, isBootstrapping, logout, session.accessToken, session.role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
