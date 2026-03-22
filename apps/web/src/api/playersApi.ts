import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/httpClient";
import type {
  CreatePlayerRequest,
  ListPlayersQuery,
  PlayerDto,
  UpdatePlayerRequest
} from "@/types/api";

export const playersApi = {
  list: async (query: ListPlayersQuery) => apiGet<PlayerDto[]>("/players", { params: query }),
  detail: async (playerId: string) => {
    const response = await apiGet<PlayerDto>(`/players/${playerId}`);
    return response.data;
  },
  create: async (payload: CreatePlayerRequest) => {
    const response = await apiPost<PlayerDto, CreatePlayerRequest>("/players", payload);
    return response.data;
  },
  update: async (playerId: string, payload: UpdatePlayerRequest) => {
    const response = await apiPatch<PlayerDto, UpdatePlayerRequest>(`/players/${playerId}`, payload);
    return response.data;
  },
  deactivate: async (playerId: string) => {
    const response = await apiDelete<{ id: string; isActive: boolean }>(`/players/${playerId}`);
    return response.data;
  }
};
