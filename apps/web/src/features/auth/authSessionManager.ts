import { authApi } from "@/api/authApi";
import { clearAuthSession, getAuthSession, setAuthSession } from "@/features/auth/session";
import type { LoginResponseDto, RoleCode } from "@/types/api";

let userLoginInFlight: Promise<LoginResponseDto> | null = null;

const setSession = (accessToken: string, role: RoleCode) => {
  setAuthSession({
    accessToken,
    role
  });
};

export const loginAsAdmin = async (accessCode: string) => {
  const result = await authApi.loginAdmin({ accessCode: accessCode.trim() });
  setSession(result.accessToken, "ADMIN");
  return result;
};

export const loginAsUserSilently = async () => {
  if (userLoginInFlight) {
    return userLoginInFlight;
  }

  userLoginInFlight = authApi
    .loginUser()
    .then((result) => {
      setSession(result.accessToken, "USER");
      return result;
    })
    .catch((error) => {
      clearAuthSession();
      throw error;
    })
    .finally(() => {
      userLoginInFlight = null;
    });

  return userLoginInFlight;
};

export const bootstrapAuthSession = async () => {
  const currentSession = getAuthSession();
  if (currentSession.accessToken && currentSession.role) {
    return currentSession;
  }

  try {
    await loginAsUserSilently();
  } catch {
    clearAuthSession();
  }

  return getAuthSession();
};

export const fallbackToUserSession = async () => {
  clearAuthSession();

  try {
    await loginAsUserSilently();
  } catch {
    clearAuthSession();
  }

  return getAuthSession();
};
