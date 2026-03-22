import { apiGet, apiPost } from "@/api/httpClient";
import type {
  CreateGroupFundTransactionRequest,
  CreateGroupFundTransactionResultDto,
  GroupFundLedgerItemDto,
  GroupFundSummaryDto,
  GroupFundTransactionDto,
  GroupFundTransactionQuery,
  MatchListItemDto,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

export const groupFundApi = {
  summary: async (query: ModuleSummaryQuery) => {
    const response = await apiGet<GroupFundSummaryDto>("/group-fund/summary", { params: query });
    return response.data;
  },
  ledger: async (query: ModuleLedgerQuery) => apiGet<GroupFundLedgerItemDto[]>("/group-fund/ledger", { params: query }),
  matches: async (query: ModuleLedgerQuery & { ruleSetId?: string }) =>
    apiGet<MatchListItemDto[]>("/group-fund/matches", { params: query }),
  transactions: async (query: GroupFundTransactionQuery) =>
    apiGet<GroupFundTransactionDto[]>("/group-fund/transactions", { params: query }),
  createTransaction: async (payload: CreateGroupFundTransactionRequest) => {
    const response = await apiPost<CreateGroupFundTransactionResultDto, CreateGroupFundTransactionRequest>(
      "/group-fund/transactions",
      payload
    );
    return response.data;
  }
};
