import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboardApi";
import { queryKeys } from "@/api/queryKeys";

export const useDashboardOverview = () =>
  useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: dashboardApi.getOverview
  });
