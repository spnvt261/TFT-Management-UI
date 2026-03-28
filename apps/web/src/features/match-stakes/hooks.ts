import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { toAppError } from "@/api/httpClient";
import { matchStakesApi } from "@/api/matchStakesApi";
import type {
  CloseDebtPeriodRequest,
  CreateMatchStakesHistoryEventRequest,
  CreateDebtSettlementRequest,
  DebtPeriodDetailDto,
  MatchStakesHistoryQuery,
  DebtPeriodTimelineApiDto,
  DebtPeriodTimelineDto,
  DebtPeriodTimelineEventDto,
  DebtPeriodTimelineMatchDto,
  ListDebtPeriodsQuery,
  MatchListItemDto,
  MatchStakesMatchesQuery,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

const PERIODS_PAGE_SIZE = 100;
const MATCHES_PAGE_SIZE = 100;
const HISTORY_PERIODS_PAGE_SIZE = 3;

const invalidateMatchStakesQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: ["match-stakes"] });
};

const toMillis = (iso: string) => Date.parse(iso);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const toOptionalString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null);
const toOptionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const toOptionalBoolean = (value: unknown) => (typeof value === "boolean" ? value : null);
const getHighestPositiveImpactRow = (rows: ReturnType<typeof normalizeTimelineRow>[]) => {
  let candidate: ReturnType<typeof normalizeTimelineRow> | null = null;

  for (const row of rows) {
    if (row.matchNetVnd <= 0) {
      continue;
    }

    if (!candidate || row.matchNetVnd > candidate.matchNetVnd) {
      candidate = row;
    }
  }

  return candidate;
};

const sortMatchesAsc = (matches: MatchListItemDto[]) => {
  const sorted = [...matches];
  sorted.sort((left, right) => {
    const playedDiff = toMillis(left.playedAt) - toMillis(right.playedAt);
    if (playedDiff !== 0) {
      return playedDiff;
    }

    return toMillis(left.createdAt) - toMillis(right.createdAt);
  });

  return sorted;
};

const sortTimelineDesc = (history: DebtPeriodTimelineMatchDto[]) => {
  const sorted = [...history];
  sorted.sort((left, right) => {
    const playedDiff = toMillis(right.playedAt) - toMillis(left.playedAt);
    if (playedDiff !== 0) {
      return playedDiff;
    }

    return (right.matchNo ?? 0) - (left.matchNo ?? 0);
  });

  return sorted;
};

const fetchAllDebtPeriods = async () => {
  const firstPage = await matchStakesApi.periods({ page: 1, pageSize: PERIODS_PAGE_SIZE });
  const totalPages = Math.max(1, firstPage.meta?.totalPages ?? 1);

  if (totalPages <= 1) {
    return firstPage.data;
  }

  const remainingResults = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => matchStakesApi.periods({ page: index + 2, pageSize: PERIODS_PAGE_SIZE }))
  );

  return [firstPage.data, ...remainingResults.map((result) => result.data)].flat();
};

const fetchAllMatchesByPeriod = async (periodId: string) => {
  const firstPage = await matchStakesApi.matches({ periodId, page: 1, pageSize: MATCHES_PAGE_SIZE });
  const totalPages = Math.max(1, firstPage.meta?.totalPages ?? 1);

  if (totalPages <= 1) {
    return firstPage.data;
  }

  const remainingResults = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => matchStakesApi.matches({ periodId, page: index + 2, pageSize: MATCHES_PAGE_SIZE }))
  );

  return [firstPage.data, ...remainingResults.map((result) => result.data)].flat();
};

const toPlacementLabel = (placement: number | null, relativeRank: number | null) => {
  const rank = typeof placement === "number" ? placement : typeof relativeRank === "number" ? relativeRank : null;
  return typeof rank === "number" ? `top${rank}` : null;
};

const normalizeTimelineRow = (row: {
  playerId: string;
  playerName: string;
  tftPlacement: number | null;
  relativeRank: number | null;
  matchNetVnd: number;
  cumulativeNetVnd: number;
  placementLabel?: string | null;
}) => {
  const tftPlacement = typeof row.tftPlacement === "number" ? row.tftPlacement : null;
  const relativeRank = typeof row.relativeRank === "number" ? row.relativeRank : null;

  return {
    playerId: row.playerId,
    playerName: row.playerName,
    tftPlacement,
    relativeRank,
    placementLabel: row.placementLabel ?? toPlacementLabel(tftPlacement, relativeRank),
    matchNetVnd: Number(row.matchNetVnd ?? 0),
    cumulativeNetVnd: Number(row.cumulativeNetVnd ?? 0)
  };
};

const normalizeTimelinePayload = (payload: DebtPeriodTimelineApiDto): DebtPeriodTimelineDto | null => {
  const players = payload.currentPlayers ?? payload.players ?? [];
  const timeline = payload.timeline;

  if (Array.isArray(timeline)) {
    const history: DebtPeriodTimelineMatchDto[] = [];
    const events: DebtPeriodTimelineEventDto[] = [];
    let initialRows = players.map((player) =>
      normalizeTimelineRow({
        playerId: player.playerId,
        playerName: player.playerName,
        tftPlacement: null,
        relativeRank: null,
        matchNetVnd: 0,
        cumulativeNetVnd: 0
      })
    );

    let fallbackMatchNo = timeline.filter((item) => item.type === "MATCH").length;

    for (const item of timeline) {
      const normalizedRows = (item.rows ?? []).map((row) =>
        normalizeTimelineRow({
          playerId: row.playerId,
          playerName: row.playerName,
          tftPlacement: row.tftPlacement,
          relativeRank: row.relativeRank,
          matchNetVnd: row.matchNetVnd,
          cumulativeNetVnd: row.cumulativeNetVnd,
          placementLabel: row.placementLabel
        })
      );

      if (item.type === "INITIAL") {
        if (normalizedRows.length > 0) {
          initialRows = normalizedRows;
        }
        continue;
      }

      if (item.type === "MATCH") {
        const matchNo = typeof item.matchNo === "number" ? item.matchNo : fallbackMatchNo;
        fallbackMatchNo -= 1;

        history.push({
          matchId: item.matchId ?? `timeline-match-${history.length + 1}`,
          playedAt: item.playedAt ?? payload.period.openedAt,
          matchNo,
          label: `Match ${matchNo}`,
          players: normalizedRows
        });
        continue;
      }

      const metadata = isRecord(item.metadata) ? item.metadata : null;
      const fallbackEventType =
        item.type === "ADVANCE" ? "MATCH_STAKES_ADVANCE" : item.type === "NOTE" ? "MATCH_STAKES_NOTE" : null;
      const fallbackEventId = `${payload.period.id}:${item.type}:${events.length + 1}`;
      const metadataPeriodMatchNo = metadata ? toOptionalNumber(metadata["periodMatchNo"]) : null;
      const metadataPlayerId =
        metadata &&
        (toOptionalString(metadata["playerId"]) ??
          toOptionalString(metadata["actorPlayerId"]) ??
          toOptionalString(metadata["ownerPlayerId"]));
      const metadataPlayerName =
        metadata &&
        (toOptionalString(metadata["playerName"]) ??
          toOptionalString(metadata["actorPlayerName"]) ??
          toOptionalString(metadata["ownerPlayerName"]));
      const fallbackImpactRow =
        item.type === "ADVANCE"
          ? getHighestPositiveImpactRow(normalizedRows) ?? normalizedRows.find((row) => row.matchNetVnd !== 0) ?? normalizedRows[0]
          : normalizedRows.find((row) => row.matchNetVnd !== 0) ?? normalizedRows[0];

      events.push({
        id: item.eventId ?? fallbackEventId,
        itemType: item.type,
        postedAt: item.playedAt ?? payload.period.openedAt,
        eventType: item.eventType ?? fallbackEventType,
        matchId: item.matchId ?? null,
        matchNo: item.matchNo ?? metadataPeriodMatchNo,
        label: item.type === "ADVANCE" ? "Ứng tiền" : "Note",
        playerId: metadataPlayerId ?? fallbackImpactRow?.playerId ?? null,
        playerName: metadataPlayerName ?? fallbackImpactRow?.playerName ?? null,
        amountVnd: typeof item.amountVnd === "number" ? item.amountVnd : null,
        note: item.note ?? null,
        impactMode: item.impactMode ?? null,
        affectsDebt: toOptionalBoolean(item.affectsDebt),
        rows: normalizedRows,
        metadata
      });
    }

    return {
      period: payload.period,
      summary: payload.summary,
      players,
      history: sortTimelineDesc(history),
      events,
      initialRows
    };
  }

  if (!Array.isArray(payload.history)) {
    return null;
  }

  const history: DebtPeriodTimelineMatchDto[] = payload.history.map((match, index) => {
    const matchNo = typeof match.matchNo === "number" ? match.matchNo : index + 1;

    return {
      matchId: match.matchId,
      playedAt: match.playedAt,
      matchNo,
      label: match.label ?? `Match ${matchNo}`,
      players: (match.players ?? []).map((player) =>
        normalizeTimelineRow({
          playerId: player.playerId,
          playerName: player.playerName,
          tftPlacement: player.tftPlacement,
          relativeRank: player.relativeRank,
          matchNetVnd: player.matchNetVnd,
          cumulativeNetVnd: player.cumulativeNetVnd,
          placementLabel: player.placementLabel
        })
      )
    };
  });

  return {
    period: payload.period,
    summary: payload.summary,
    players,
    history: sortTimelineDesc(history),
    events: [],
    initialRows: players.map((player) =>
      normalizeTimelineRow({
        playerId: player.playerId,
        playerName: player.playerName,
        tftPlacement: null,
        relativeRank: null,
        matchNetVnd: 0,
        cumulativeNetVnd: 0
      })
    )
  };
};

const buildTimelineFromFallback = (detail: DebtPeriodDetailDto, matches: MatchListItemDto[]): DebtPeriodTimelineDto => {
  const cumulativeByPlayer = new Map<string, number>();

  for (const player of detail.players) {
    cumulativeByPlayer.set(player.playerId, 0);
  }

  const sortedMatches = sortMatchesAsc(matches);

  const historyAsc: DebtPeriodTimelineMatchDto[] = sortedMatches.map((match, index) => {
    const participants = [...match.participants].sort((left, right) => {
      const placementDiff = left.tftPlacement - right.tftPlacement;
      if (placementDiff !== 0) {
        return placementDiff;
      }

      return left.playerName.localeCompare(right.playerName);
    });

    const players = participants.map((participant) => {
      const previousCumulative = cumulativeByPlayer.get(participant.playerId) ?? 0;
      const cumulativeNetVnd = previousCumulative + participant.settlementNetVnd;
      cumulativeByPlayer.set(participant.playerId, cumulativeNetVnd);

      return {
        playerId: participant.playerId,
        playerName: participant.playerName,
        tftPlacement: participant.tftPlacement,
        relativeRank: participant.relativeRank,
        placementLabel: toPlacementLabel(participant.tftPlacement, participant.relativeRank),
        matchNetVnd: participant.settlementNetVnd,
        cumulativeNetVnd
      };
    });

    const matchNo = index + 1;

    return {
      matchId: match.id,
      playedAt: match.playedAt,
      matchNo,
      label: `Match ${matchNo}`,
      players
    };
  });

  return {
    period: detail.period,
    summary: detail.summary,
    players: detail.players,
    history: sortTimelineDesc(historyAsc),
    events: [],
    initialRows: detail.players.map((player) =>
      normalizeTimelineRow({
        playerId: player.playerId,
        playerName: player.playerName,
        tftPlacement: null,
        relativeRank: null,
        matchNetVnd: 0,
        cumulativeNetVnd: 0
      })
    )
  };
};

const fetchDebtPeriodTimeline = async (periodId: string) => {
  const timelinePayload = await matchStakesApi.periodTimeline(periodId, { includeInitialSnapshot: true });
  const normalizedTimeline = timelinePayload ? normalizeTimelinePayload(timelinePayload) : null;

  if (normalizedTimeline) {
    return normalizedTimeline;
  }

  const [detail, matches] = await Promise.all([matchStakesApi.periodDetail(periodId), fetchAllMatchesByPeriod(periodId)]);
  return buildTimelineFromFallback(detail, matches);
};

export interface DebtPeriodHistoryPage {
  page: number;
  totalPages: number;
  periodTimelines: DebtPeriodTimelineDto[];
}

export const useMatchStakesSummary = (query: ModuleSummaryQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.summary(query),
    queryFn: () => matchStakesApi.summary(query)
  });

export const useMatchStakesLedger = (query: ModuleLedgerQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.ledger(query),
    queryFn: () => matchStakesApi.ledger(query)
  });

export const useMatchStakesMatches = (query: MatchStakesMatchesQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.matchStakes.matches(query),
    queryFn: () => matchStakesApi.matches(query),
    enabled
  });

export const useMatchStakesHistory = (query: MatchStakesHistoryQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.matchStakes.history(query),
    queryFn: () => matchStakesApi.history(query),
    enabled
  });

export const useCurrentDebtPeriod = () =>
  useQuery({
    queryKey: queryKeys.matchStakes.currentPeriod,
    queryFn: async () => {
      try {
        return await matchStakesApi.currentPeriod();
      } catch (error) {
        const appError = toAppError(error);
        if (appError.code === "DEBT_PERIOD_NOT_FOUND") {
          return null;
        }

        throw error;
      }
    }
  });

export const useDebtPeriodDetail = (periodId?: string) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periodDetail(periodId ?? ""),
    queryFn: () => matchStakesApi.periodDetail(periodId!),
    enabled: Boolean(periodId)
  });

export const useDebtPeriods = (query: ListDebtPeriodsQuery) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periods(query),
    queryFn: () => matchStakesApi.periods(query)
  });

export const useAllDebtPeriods = () =>
  useQuery({
    queryKey: queryKeys.matchStakes.allPeriods,
    queryFn: fetchAllDebtPeriods
  });

export const useInfiniteDebtPeriodHistory = (enabled = true) =>
  useInfiniteQuery({
    queryKey: queryKeys.matchStakes.allPeriodsHistory({ pageSize: HISTORY_PERIODS_PAGE_SIZE }),
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      const periodResult = await matchStakesApi.periods({ page, pageSize: HISTORY_PERIODS_PAGE_SIZE });
      const totalPages = Math.max(1, periodResult.meta?.totalPages ?? 1);
      const periodTimelines = await Promise.all(periodResult.data.map((period) => fetchDebtPeriodTimeline(period.id)));

      return {
        page,
        totalPages,
        periodTimelines
      } satisfies DebtPeriodHistoryPage;
    },
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined)
  });

export const useDebtPeriodTimeline = (periodId?: string) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periodTimeline(periodId ?? ""),
    enabled: Boolean(periodId),
    queryFn: () => fetchDebtPeriodTimeline(periodId as string)
  });

export const useCreateDebtPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: matchStakesApi.createPeriod,
    onSuccess: async () => {
      await invalidateMatchStakesQueries(queryClient);
    }
  });
};

export const useCreateDebtSettlement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: CreateDebtSettlementRequest }) =>
      matchStakesApi.createSettlement(periodId, payload),
    onSuccess: async (_, variables) => {
      await invalidateMatchStakesQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matchStakes.periodDetail(variables.periodId)
      });
    }
  });
};

export const useCloseDebtPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: CloseDebtPeriodRequest }) =>
      matchStakesApi.closePeriod(periodId, payload),
    onSuccess: async (_, variables) => {
      await invalidateMatchStakesQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matchStakes.periodDetail(variables.periodId)
      });
    }
  });
};

export const useCreateMatchStakesHistoryEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMatchStakesHistoryEventRequest) => matchStakesApi.createHistoryEvent(payload),
    onSuccess: async (_, variables) => {
      await invalidateMatchStakesQueries(queryClient);

      if (variables.periodId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.matchStakes.periodDetail(variables.periodId)
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.matchStakes.periodTimeline(variables.periodId)
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.matchStakes.periodHistory(variables.periodId)
        });
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.overview
      });
    }
  });
};
