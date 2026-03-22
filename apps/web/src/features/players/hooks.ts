import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { playersApi } from "@/api/playersApi";
import { queryKeys } from "@/api/queryKeys";
import type { ListPlayersQuery, UpdatePlayerRequest } from "@/types/api";
import { invalidateAfterPlayerMutation } from "@/lib/invalidation";

export const usePlayers = (query: ListPlayersQuery) =>
  useQuery({
    queryKey: queryKeys.players.list(query),
    queryFn: () => playersApi.list(query)
  });

export const usePlayerDetail = (playerId?: string) =>
  useQuery({
    queryKey: queryKeys.players.detail(playerId ?? ""),
    queryFn: () => playersApi.detail(playerId!),
    enabled: Boolean(playerId)
  });

export const useActivePlayers = () =>
  useQuery({
    queryKey: queryKeys.players.activeOptions,
    queryFn: async () => {
      const response = await playersApi.list({ isActive: true, page: 1, pageSize: 100 });
      return response.data;
    }
  });

export const useCreatePlayer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: playersApi.create,
    onSuccess: async () => {
      await invalidateAfterPlayerMutation(queryClient);
    }
  });
};

export const useUpdatePlayer = (playerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePlayerRequest) => playersApi.update(playerId, payload),
    onSuccess: async () => {
      await invalidateAfterPlayerMutation(queryClient);
      await queryClient.invalidateQueries({ queryKey: queryKeys.players.detail(playerId) });
    }
  });
};

export const useDeactivatePlayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (playerId: string) => playersApi.deactivate(playerId),
    onSuccess: async () => {
      await invalidateAfterPlayerMutation(queryClient);
    }
  });
};
