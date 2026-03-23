import { apiGet, apiPost } from "@/api/httpClient";
import type {
  CreateMatchRequest,
  MatchDetailDto,
  MatchListItemDto,
  MatchListQuery,
  PreviewMatchRequest,
  PreviewMatchResultDto,
  VoidMatchRequest,
  VoidMatchResultDto
} from "@/types/api";

export const matchesApi = {
  preview: async (payload: PreviewMatchRequest) => {
    const response = await apiPost<PreviewMatchResultDto, PreviewMatchRequest>("/matches/preview", payload);
    return response.data;
  },
  list: async (query: MatchListQuery) => apiGet<MatchListItemDto[]>("/matches", { params: query }),
  create: async (payload: CreateMatchRequest) => {
    const response = await apiPost<MatchDetailDto, CreateMatchRequest>("/matches", payload);
    return response.data;
  },
  detail: async (matchId: string) => {
    const response = await apiGet<MatchDetailDto>(`/matches/${matchId}`);
    return response.data;
  },
  void: async (matchId: string, payload: VoidMatchRequest) => {
    const response = await apiPost<VoidMatchResultDto, VoidMatchRequest>(`/matches/${matchId}/void`, payload);
    return response.data;
  }
};
