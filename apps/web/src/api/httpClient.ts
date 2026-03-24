import axios from "axios";
import type { AxiosError, AxiosRequestConfig } from "axios";
import { message } from "antd";
import { env } from "@/lib/env";
import { getErrorMessage } from "@/lib/error-messages";
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

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!axios.isCancel(error)) {
      notifyApiError(error);
    }

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
