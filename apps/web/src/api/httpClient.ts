import axios, { AxiosError, AxiosHeaders } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { message } from "antd";
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/error-messages";
import { getAuthSession } from "@/features/auth/session";
import { fallbackToUserSession, loginAsUserSilently } from "@/features/auth/authSessionManager";
import type { ApiErrorResponse, ApiSuccessResponse, PaginatedResult } from "@/types/api";
import type { AppError } from "@/types/error";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
};

export const httpClient = axios.create({
  baseURL: normalizeBaseUrl(env.apiBaseUrl),
  timeout: 15_000
});

type AuthRetryConfig = InternalAxiosRequestConfig & {
  _authRecovered?: boolean;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_METHODS = new Set(["GET", "HEAD"]);

const resolveRequestPath = (url?: string) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  return url;
};

const isAuthEndpoint = (url?: string) => {
  const path = resolveRequestPath(url);
  return path.endsWith("/auth/login") || path.endsWith("/auth/check-access-code");
};

const getMethod = (config?: AxiosRequestConfig) => (config?.method ?? "get").toUpperCase();
const isWriteMethod = (config?: AxiosRequestConfig) => WRITE_METHODS.has(getMethod(config));
const isReadMethod = (config?: AxiosRequestConfig) => READ_METHODS.has(getMethod(config));

const createClientForbiddenError = (config: InternalAxiosRequestConfig) =>
  new AxiosError<ApiErrorResponse>(
    "Admin access is required for write actions.",
    "AUTH_FORBIDDEN",
    config,
    undefined,
    {
      status: 403,
      statusText: "Forbidden",
      headers: {},
      config,
      data: {
        success: false,
        error: {
          code: "AUTH_FORBIDDEN",
          message: "Admin access is required for write actions."
        }
      }
    }
  );

const notifyOnce = (signature: string, level: "error" | "warning", content: string, key: string) => {
  if (!shouldNotifyApiError(signature)) {
    return;
  }

  const fn = level === "warning" ? message.warning : message.error;
  fn({
    content,
    key,
    duration: 4
  });
};

export const toAppError = (error: unknown): AppError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const status = axiosError.response?.status ?? 500;
    const payload = axiosError.response?.data;

    if (payload && payload.success === false) {
      return {
        status,
        code: payload.error.code,
        message: payload.error.message,
        details: payload.error.details
      };
    }

    return {
      status,
      code: "NETWORK_ERROR",
      message: axiosError.message || "Network request failed"
    };
  }

  return {
    status: 500,
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unknown error"
  };
};

const API_ERROR_NOTIFY_COOLDOWN_MS = 1_500;
let lastApiErrorSignature = "";
let lastApiErrorTimestamp = 0;

const shouldNotifyApiError = (signature: string) => {
  const now = Date.now();
  const isDuplicate = signature === lastApiErrorSignature && now - lastApiErrorTimestamp < API_ERROR_NOTIFY_COOLDOWN_MS;

  if (isDuplicate) {
    return false;
  }

  lastApiErrorSignature = signature;
  lastApiErrorTimestamp = now;
  return true;
};

const notifyApiError = (error: unknown) => {
  const appError = toAppError(error);
  const signature = `${appError.status}|${appError.code}|${appError.message}`;

  if (!shouldNotifyApiError(signature)) {
    return;
  }

  message.error({
    content: getErrorMessage(appError),
    key: "api-error",
    duration: 4
  });
};

httpClient.interceptors.request.use((config) => {
  const session = getAuthSession();
  if (isWriteMethod(config) && !isAuthEndpoint(config.url) && session.role !== "ADMIN") {
    return Promise.reject(createClientForbiddenError(config));
  }

  const token = session.accessToken;
  if (!token) {
    return config;
  }

  const headers = AxiosHeaders.from(config.headers);
  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (!axios.isAxiosError(error)) {
      notifyApiError(error);
      return Promise.reject(error);
    }

    const requestConfig = error.config as AuthRetryConfig | undefined;
    if (isAuthEndpoint(requestConfig?.url)) {
      return Promise.reject(error);
    }

    const appError = toAppError(error);
    const isUnauthorized = appError.status === 401 || appError.code === "AUTH_UNAUTHORIZED";
    if (isUnauthorized) {
      if (requestConfig && !requestConfig._authRecovered) {
        requestConfig._authRecovered = true;
        const roleBeforeRecovery = getAuthSession().role;

        try {
          if (roleBeforeRecovery === "ADMIN") {
            await fallbackToUserSession();

            notifyOnce(
              "401|AUTH_ADMIN_EXPIRED|fallback-user",
              "warning",
              "Admin session expired. Switched to USER mode. Login as Admin again from Settings for write actions.",
              "auth-admin-expired"
            );

            if (isWriteMethod(requestConfig)) {
              return Promise.reject(error);
            }
          } else {
            await loginAsUserSilently();
          }

          return httpClient(requestConfig);
        } catch {
          notifyOnce(
            "401|AUTH_RECOVERY_FAILED|public-mode",
            "warning",
            "Session refresh failed. Continuing in public read mode.",
            "auth-recovery-failed"
          );
          return Promise.reject(error);
        }
      }

      notifyOnce("401|AUTH_UNAUTHORIZED|retry-failed", "warning", "Session expired or invalid token.", "auth-unauthorized");
      return Promise.reject(error);
    }

    const isForbidden = appError.status === 403 || appError.code === "AUTH_FORBIDDEN";
    if (isForbidden) {
      const signature = `${appError.status}|AUTH_FORBIDDEN|permission-denied|${isReadMethod(requestConfig) ? "read" : "write"}`;
      notifyOnce(
        signature,
        "warning",
        isWriteMethod(requestConfig)
          ? "Admin access required for write actions. Use Settings -> Login as Admin."
          : "You do not have permission for this action.",
        "auth-forbidden"
      );

      return Promise.reject(error);
    }

    notifyApiError(error);
    return Promise.reject(error);
  }
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResult<T>> {
  const response = await httpClient.get<ApiSuccessResponse<T>>(url, config);
  return {
    data: response.data.data,
    meta: response.data.meta
  };
}

export async function apiPost<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<PaginatedResult<T>> {
  const response = await httpClient.post<ApiSuccessResponse<T>>(url, body, config);
  return {
    data: response.data.data,
    meta: response.data.meta
  };
}

export async function apiPatch<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<PaginatedResult<T>> {
  const response = await httpClient.patch<ApiSuccessResponse<T>>(url, body, config);
  return {
    data: response.data.data,
    meta: response.data.meta
  };
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResult<T>> {
  const response = await httpClient.delete<ApiSuccessResponse<T>>(url, config);
  return {
    data: response.data.data,
    meta: response.data.meta
  };
}

export async function apiPut<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<PaginatedResult<T>> {
  const response = await httpClient.put<ApiSuccessResponse<T>>(url, body, config);
  return {
    data: response.data.data,
    meta: response.data.meta
  };
}
