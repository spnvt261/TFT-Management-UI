import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/api/authApi";
import { clearAuthSession, getAuthSession, setAuthSession, subscribeAuthSession } from "@/features/auth/session";
import type { LoginResponseDto, RoleCode } from "@/types/api";

interface AuthContextValue {
  accessToken: string | null;
  role: RoleCode | null;
  isAuthenticated: boolean;
  login: (accessCode: string) => Promise<LoginResponseDto>;
  logout: () => void;
  hasRole: (role: RoleCode) => boolean;
  canWrite: () => boolean;
  canRead: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState(getAuthSession());

  useEffect(() => subscribeAuthSession(setSession), []);

  const login = useCallback(async (accessCode: string) => {
    const result = await authApi.login({ accessCode: accessCode.trim() });
    setAuthSession({
      accessToken: result.accessToken,
      role: result.role
    });

    return result;
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
  }, []);

  const hasRole = useCallback(
    (role: RoleCode) => {
      return session.role === role;
    },
    [session.role]
  );

  const canWrite = useCallback(() => session.role === "ADMIN", [session.role]);

  const canRead = useCallback(() => session.role === "ADMIN" || session.role === "USER", [session.role]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session.accessToken,
      role: session.role,
      isAuthenticated: Boolean(session.accessToken && session.role),
      login,
      logout,
      hasRole,
      canWrite,
      canRead
    }),
    [canRead, canWrite, hasRole, login, logout, session.accessToken, session.role]
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
