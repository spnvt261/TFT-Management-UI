import { apiGet, apiPost, httpClient } from "@/api/httpClient";
import type {
  ApiSuccessResponse,
  CloseDebtPeriodRequest,
  CloseDebtPeriodResultDto,
  CreateDebtPeriodRequest,
  CreateMatchStakesHistoryEventRequest,
  CreateMatchStakesHistoryEventResultDto,
  CreateDebtSettlementRequest,
  CreateDebtSettlementResultDto,
  DebtPeriodCurrentDto,
  DebtPeriodDetailDto,
  DebtPeriodDto,
  DebtPeriodListItemDto,
  DebtPeriodTimelineApiDto,
  ListDebtPeriodsQuery,
  MatchListItemDto,
  MatchStakesHistoryItemDto,
  MatchStakesHistoryQuery,
  MatchStakesLedgerItemDto,
  MatchStakesMatchesQuery,
  MatchStakesSummaryDto,
  ModuleLedgerQuery,
  ModuleSummaryQuery,
  PaginationMeta,
  ResetMatchStakesHistoryEventRequest,
  ResetMatchStakesHistoryEventResultDto
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

const postOptionalJsonEndpoint = async <T>(url: string, payload: unknown): Promise<T | null> => {
  const response = await httpClient.post<ApiSuccessResponse<T>>(url, JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    },
    transformRequest: [(data) => data as string],
    validateStatus: (status) => (status >= 200 && status < 300) || OPTIONAL_ENDPOINT_STATUSES.has(status)
  });

  if (response.status >= 200 && response.status < 300) {
    return response.data.data;
  }

  return null;
};

type MatchStakesHistoryEventV2Payload =
  | {
      eventType: "MATCH_STAKES_ADVANCE";
      postedAt?: string;
      playerId: string;
      participantPlayerIds: string[];
      amountVnd: number;
      note?: string | null;
      impactMode?: "AFFECTS_DEBT" | "INFORMATIONAL";
      debtPeriodId?: string;
    }
  | {
      eventType: "MATCH_STAKES_NOTE";
      postedAt?: string;
      note: string;
      playerId?: string;
      debtPeriodId?: string;
    };

const toOptionalIso = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  return value;
};

const toPositiveInteger = (value: unknown) => {
  const candidate =
    typeof value === "string"
      ? Number(value.replace(/[,\s]/g, ""))
      : value;

  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return null;
  }

  const normalized = Math.trunc(candidate);
  return normalized > 0 ? normalized : null;
};

const normalizeIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const candidate = item.trim();
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
};

const mergeUniqueIds = (...groups: Array<Array<string | null | undefined>>) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const group of groups) {
    for (const rawId of group) {
      if (typeof rawId !== "string") {
        continue;
      }

      const candidate = rawId.trim();
      if (!candidate || seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);
      merged.push(candidate);
    }
  }

  return merged;
};

const normalizeHistoryEventPayload = (payload: CreateMatchStakesHistoryEventRequest): CreateMatchStakesHistoryEventRequest => {
  const normalizedAmountVnd = toPositiveInteger(payload.amountVnd);
  const participantPlayerIds = normalizeIdArray(payload.participantPlayerIds);
  const beneficiaryPlayerIds = normalizeIdArray(payload.beneficiaryPlayerIds);

  return {
    ...payload,
    amountVnd: normalizedAmountVnd,
    participantPlayerIds,
    beneficiaryPlayerIds
  };
};

const toMatchStakesHistoryEventV2Payload = (payload: CreateMatchStakesHistoryEventRequest): MatchStakesHistoryEventV2Payload | null => {
  if (payload.eventType === "ADVANCE") {
    const amountVnd = toPositiveInteger(payload.amountVnd);
    const advancerPlayerId = typeof payload.playerId === "string" ? payload.playerId.trim() : "";
    if (!advancerPlayerId || amountVnd === null) {
      return null;
    }

    const normalizedParticipantPlayerIds = normalizeIdArray(payload.participantPlayerIds);
    const participantPlayerIds =
      normalizedParticipantPlayerIds.length > 0
        ? normalizedParticipantPlayerIds
        : mergeUniqueIds([advancerPlayerId], normalizeIdArray(payload.beneficiaryPlayerIds));

    if (participantPlayerIds.length === 0 || !participantPlayerIds.includes(advancerPlayerId)) {
      return null;
    }

    return {
      eventType: "MATCH_STAKES_ADVANCE",
      postedAt: toOptionalIso(payload.postedAt),
      playerId: advancerPlayerId,
      participantPlayerIds,
      amountVnd,
      note: payload.note?.trim() || null,
      impactMode: payload.impactMode,
      debtPeriodId: payload.periodId ?? undefined
    };
  }

  if (payload.eventType === "NOTE") {
    return {
      eventType: "MATCH_STAKES_NOTE",
      postedAt: toOptionalIso(payload.postedAt),
      note: payload.note?.trim() || payload.reason?.trim() || "Note",
      playerId: payload.playerId ?? undefined,
      debtPeriodId: payload.periodId ?? undefined
    };
  }

  return null;
};

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
  history: async (query: MatchStakesHistoryQuery): Promise<{ data: MatchStakesHistoryItemDto[]; meta?: PaginationMeta } | null> => {
    const candidateUrls = query.periodId
      ? [`/match-stakes/debt-periods/${query.periodId}/history`, "/match-stakes/history"]
      : ["/match-stakes/history"];

    for (const url of candidateUrls) {
      const response = await getOptionalEndpoint<MatchStakesHistoryItemDto[]>(url, query);
      if (response) {
        return response;
      }
    }

    return null;
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
  },
  createHistoryEvent: async (payload: CreateMatchStakesHistoryEventRequest) => {
    const normalizedPayload = normalizeHistoryEventPayload(payload);
    const preferredPayload = toMatchStakesHistoryEventV2Payload(normalizedPayload);
    if (preferredPayload) {
      const response = await postOptionalJsonEndpoint<CreateMatchStakesHistoryEventResultDto>(
        "/match-stakes/history-events",
        preferredPayload.eventType === "MATCH_STAKES_ADVANCE"
          ? {
              ...preferredPayload,
              amountVnd: Number(preferredPayload.amountVnd)
            }
          : preferredPayload
      );

      if (response) {
        return response;
      }
    }

    const candidateUrls = normalizedPayload.periodId
      ? [`/match-stakes/debt-periods/${normalizedPayload.periodId}/history`, "/match-stakes/history"]
      : ["/match-stakes/history"];

    for (const url of candidateUrls) {
      const response = await postOptionalJsonEndpoint<CreateMatchStakesHistoryEventResultDto>(url, normalizedPayload);
      if (response) {
        return response;
      }
    }

    throw new Error("Match Stakes history-event endpoint is not available on backend.");
  },
  resetHistoryEvent: async (eventId: string, payload: ResetMatchStakesHistoryEventRequest) => {
    const response = await apiPost<ResetMatchStakesHistoryEventResultDto, ResetMatchStakesHistoryEventRequest>(
      `/match-stakes/history-events/${eventId}/reset`,
      payload
    );
    return response.data;
  }
};
