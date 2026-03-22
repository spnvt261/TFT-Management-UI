import { apiGet } from "@/api/httpClient";
import type { MatchListItemDto, MatchStakesLedgerItemDto, MatchStakesSummaryDto, ModuleLedgerQuery, ModuleSummaryQuery } from "@/types/api";

export const matchStakesApi = {
  summary: async (query: ModuleSummaryQuery) => {
    const response = await apiGet<MatchStakesSummaryDto>("/match-stakes/summary", { params: query });
    return response.data;
  },
  ledger: async (query: ModuleLedgerQuery) => apiGet<MatchStakesLedgerItemDto[]>("/match-stakes/ledger", { params: query }),
  matches: async (query: ModuleLedgerQuery & { ruleSetId?: string }) =>
    apiGet<MatchListItemDto[]>("/match-stakes/matches", { params: query })
};
