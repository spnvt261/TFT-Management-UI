import type { RoleCode } from "@/types/api";

const ACCESS_TOKEN_STORAGE_KEY = "tft2.auth.accessToken";
const ROLE_STORAGE_KEY = "tft2.auth.role";

export interface AuthSession {
  accessToken: string | null;
  role: RoleCode | null;
}

const EMPTY_SESSION: AuthSession = {
  accessToken: null,
  role: null
};

const toRoleCode = (value: unknown): RoleCode | null => {
  if (value === "ADMIN" || value === "USER") {
    return value;
  }

  return null;
};

const readSessionFromStorage = (): AuthSession => {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  const role = toRoleCode(window.localStorage.getItem(ROLE_STORAGE_KEY));

  if (!accessToken || !role) {
    return EMPTY_SESSION;
  }

  return {
    accessToken,
    role
  };
};

const persistSession = (session: AuthSession) => {
  if (typeof window === "undefined") {
    return;
  }

  if (session.accessToken && session.role) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken);
    window.localStorage.setItem(ROLE_STORAGE_KEY, session.role);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
};

let currentSession = readSessionFromStorage();
const listeners = new Set<(session: AuthSession) => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(currentSession));
};

export const getAuthSession = () => currentSession;

export const setAuthSession = (session: AuthSession) => {
  if (!session.accessToken || !session.role) {
    currentSession = EMPTY_SESSION;
    persistSession(EMPTY_SESSION);
    notifyListeners();
    return;
  }

  currentSession = {
    accessToken: session.accessToken,
    role: session.role
  };
  persistSession(currentSession);
  notifyListeners();
};

export const clearAuthSession = () => {
  currentSession = EMPTY_SESSION;
  persistSession(EMPTY_SESSION);
  notifyListeners();
};

export const subscribeAuthSession = (listener: (session: AuthSession) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
