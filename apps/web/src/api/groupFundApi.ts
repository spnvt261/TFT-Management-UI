import { apiGet, apiPost, httpClient } from "@/api/httpClient";
import type {
  ApiSuccessResponse,
  CreateGroupFundAdvanceRequest,
  CreateGroupFundAdvanceResultDto,
  CreateGroupFundContributionRequest,
  CreateGroupFundContributionResultDto,
  CreateGroupFundTransactionRequest,
  CreateGroupFundTransactionResultDto,
  CreateGroupFundWithdrawalRequest,
  GroupFundHistoryItemDto,
  GroupFundHistoryQuery,
  GroupFundLedgerItemDto,
  GroupFundSummaryDto,
  GroupFundTransactionDto,
  GroupFundTransactionQuery,
  MatchListItemDto,
  ModuleLedgerQuery,
  ModuleSummaryQuery,
  PaginationMeta
} from "@/types/api";

const OPTIONAL_ENDPOINT_STATUSES = new Set([404, 405, 501]);

const getOptionalEndpoint = async <T>(url: string, params?: unknown): Promise<{ data: T; meta?: PaginationMeta } | null> => {
  const response = await httpClient.get<ApiSuccessResponse<T>>(url, {
    params,
    validateStatus: (status) => (status >= 200 && status < 300) || OPTIONAL_ENDPOINT_STATUSES.has(status)
  });

  if (response.status >= 200 && response.status < 300) {
    return {
      data: response.data.data,
      meta: response.data.meta
    };
  }

  return null;
};

const postOptionalEndpoint = async <T, B>(url: string, payload: B): Promise<T | null> => {
  const response = await httpClient.post<ApiSuccessResponse<T>>(url, payload, {
    validateStatus: (status) => (status >= 200 && status < 300) || OPTIONAL_ENDPOINT_STATUSES.has(status)
  });

  if (response.status >= 200 && response.status < 300) {
    return response.data.data;
  }

  return null;
};

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
  history: async (query: GroupFundHistoryQuery): Promise<{ data: GroupFundHistoryItemDto[]; meta?: PaginationMeta } | null> => {
    const candidateUrls = ["/group-fund/history", "/group-fund/fund-history"];
    for (const url of candidateUrls) {
      const response = await getOptionalEndpoint<GroupFundHistoryItemDto[]>(url, query);
      if (response) {
        return response;
      }
    }

    return null;
  },
  withdrawals: async (query: Omit<GroupFundTransactionQuery, "transactionType">) =>
    apiGet<GroupFundTransactionDto[]>("/group-fund/transactions", { params: { ...query, transactionType: "WITHDRAWAL" } }),
  createContribution: async (payload: CreateGroupFundContributionRequest) => {
    const response = await apiPost<CreateGroupFundContributionResultDto, CreateGroupFundContributionRequest>(
      "/group-fund/contributions",
      payload
    );
    return response.data;
  },
  createWithdrawal: async (payload: CreateGroupFundWithdrawalRequest) => {
    const response = await apiPost<CreateGroupFundTransactionResultDto, CreateGroupFundWithdrawalRequest>(
      "/group-fund/transactions",
      payload
    );
    return response.data;
  },
  createTransaction: async (payload: CreateGroupFundTransactionRequest) => {
    const response = await apiPost<CreateGroupFundTransactionResultDto, CreateGroupFundTransactionRequest>(
      "/group-fund/transactions",
      payload
    );
    return response.data;
  },
  createFundAdvance: async (payload: CreateGroupFundAdvanceRequest) => {
    const endpointCandidates = ["/group-fund/advances", "/group-fund/fund-advances"];

    for (const url of endpointCandidates) {
      const response = await postOptionalEndpoint<CreateGroupFundAdvanceResultDto, CreateGroupFundAdvanceRequest>(url, payload);
      if (response) {
        return response;
      }
    }

    const transactionFallback = await postOptionalEndpoint<CreateGroupFundTransactionResultDto, CreateGroupFundTransactionRequest>(
      "/group-fund/transactions",
      {
        transactionType: "FUND_ADVANCE",
        playerId: payload.playerId,
        amountVnd: payload.amountVnd,
        reason: payload.note?.trim() || "Fund advance",
        postedAt: payload.postedAt
      }
    );

    if (transactionFallback) {
      return {
        batchId: transactionFallback.batchId,
        postedAt: transactionFallback.postedAt,
        playerId: transactionFallback.playerId ?? payload.playerId,
        playerName: transactionFallback.playerName ?? "",
        amountVnd: transactionFallback.amountVnd,
        note: transactionFallback.reason ?? payload.note ?? null
      } satisfies CreateGroupFundAdvanceResultDto;
    }

    throw new Error("Group Fund advance endpoint is not available on backend.");
  }
};
