import axios from "axios";
import { env } from "@/lib/env";
import type { AdminAccessCodeLoginRequest, ApiSuccessResponse, LoginResponseDto } from "@/types/api";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
};

const authHttpClient = axios.create({
  baseURL: normalizeBaseUrl(env.apiBaseUrl),
  timeout: 15_000
});

export const authApi = {
  loginUser: async () => {
    const response = await authHttpClient.post<ApiSuccessResponse<LoginResponseDto>>("/auth/login");
    return response.data.data;
  },
  loginAdmin: async (payload: AdminAccessCodeLoginRequest) => {
    const response = await authHttpClient.post<ApiSuccessResponse<LoginResponseDto>>("/auth/check-access-code", payload);
    return response.data.data;
  }
};
