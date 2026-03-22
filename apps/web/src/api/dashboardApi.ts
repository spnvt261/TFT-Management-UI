import { apiGet } from "@/api/httpClient";
import type { DashboardOverviewDto } from "@/types/api";

export const dashboardApi = {
  getOverview: async () => {
    const response = await apiGet<DashboardOverviewDto>("/dashboard/overview");
    return response.data;
  }
};
