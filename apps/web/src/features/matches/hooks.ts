import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { matchesApi } from "@/api/matchesApi";
import { queryKeys } from "@/api/queryKeys";
import { toAppError } from "@/api/httpClient";
import { invalidateAfterMatchVoid } from "@/lib/invalidation";

export const useMatchDetail = (matchId?: string) =>
  useQuery({
    queryKey: queryKeys.matches.detail(matchId ?? ""),
    queryFn: () => matchesApi.detail(matchId!),
    enabled: Boolean(matchId)
  });

export const useVoidMatch = (matchId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => matchesApi.void(matchId, { reason }),
    onSuccess: async () => {
      await invalidateAfterMatchVoid(queryClient);
    },
    throwOnError: false,
    meta: {
      mapError: toAppError
    }
  });
};
