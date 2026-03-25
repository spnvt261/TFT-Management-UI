import { apiPost } from "@/api/httpClient";
import type { LoginRequest, LoginResponseDto } from "@/types/api";

export const authApi = {
  login: async (payload: LoginRequest) => {
    const response = await apiPost<LoginResponseDto, LoginRequest>("/auth/login", payload);
    return response.data;
  }
};
