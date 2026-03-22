import { apiGet, apiPut } from "@/api/httpClient";
import type { ModuleType, RecentPresetDto, UpsertPresetRequest } from "@/types/api";

export const presetsApi = {
  getByModule: async (module: ModuleType) => {
    const response = await apiGet<RecentPresetDto>(`/recent-match-presets/${module}`);
    return response.data;
  },
  update: async (module: ModuleType, payload: UpsertPresetRequest) => {
    const response = await apiPut<RecentPresetDto, UpsertPresetRequest>(`/recent-match-presets/${module}`, payload);
    return response.data;
  }
};
