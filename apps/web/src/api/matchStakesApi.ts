import { apiGet, apiPost, httpClient } from "@/api/httpClient";
import type {
  ApiSuccessResponse,
  CloseDebtPeriodRequest,
  CloseDebtPeriodResultDto,
  CreateDebtPeriodRequest,
  CreateDebtSettlementRequest,
  CreateDebtSettlementResultDto,
  DebtPeriodCurrentDto,
  DebtPeriodDetailDto,
  DebtPeriodDto,
  DebtPeriodListItemDto,
  DebtPeriodTimelineApiDto,
  ListDebtPeriodsQuery,
  MatchListItemDto,
  MatchStakesLedgerItemDto,
  MatchStakesMatchesQuery,
  MatchStakesSummaryDto,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

export const matchStakesApi = {
  summary: async (query: ModuleSummaryQuery) => {
    const response = await apiGet<MatchStakesSummaryDto>("/match-stakes/summary", { params: query });
    return response.data;
  },
  ledger: async (query: ModuleLedgerQuery) => apiGet<MatchStakesLedgerItemDto[]>("/match-stakes/ledger", { params: query }),
  matches: async (query: MatchStakesMatchesQuery) => apiGet<MatchListItemDto[]>("/match-stakes/matches", { params: query }),
  currentPeriod: async () => {
    const response = await apiGet<DebtPeriodCurrentDto>("/match-stakes/debt-periods/current");
    return response.data;
  },
  periods: async (query: ListDebtPeriodsQuery) => apiGet<DebtPeriodListItemDto[]>("/match-stakes/debt-periods", { params: query }),
  periodDetail: async (periodId: string) => {
    const response = await apiGet<DebtPeriodDetailDto>(`/match-stakes/debt-periods/${periodId}`);
    return response.data;
  },
  periodTimeline: async (periodId: string, options?: { includeInitialSnapshot?: boolean }): Promise<DebtPeriodTimelineApiDto | null> => {
    const response = await httpClient.get<ApiSuccessResponse<DebtPeriodTimelineApiDto>>(`/match-stakes/debt-periods/${periodId}/timeline`, {
      params: options,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404 || status === 405 || status === 501
    });

    if (response.status >= 200 && response.status < 300) {
      return response.data.data;
    }

    return null;
  },
  createPeriod: async (payload: CreateDebtPeriodRequest) => {
    const response = await apiPost<DebtPeriodDto, CreateDebtPeriodRequest>("/match-stakes/debt-periods", payload);
    return response.data;
  },
  createSettlement: async (periodId: string, payload: CreateDebtSettlementRequest) => {
    const response = await apiPost<CreateDebtSettlementResultDto, CreateDebtSettlementRequest>(
      `/match-stakes/debt-periods/${periodId}/settlements`,
      payload
    );
    return response.data;
  },
  closePeriod: async (periodId: string, payload: CloseDebtPeriodRequest) => {
    const response = await apiPost<CloseDebtPeriodResultDto, CloseDebtPeriodRequest>(
      `/match-stakes/debt-periods/${periodId}/close`,
      payload
    );
    return response.data;
  }
};
