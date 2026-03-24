import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { toAppError } from "@/api/httpClient";
import { matchStakesApi } from "@/api/matchStakesApi";
import type {
  CloseDebtPeriodRequest,
  CreateDebtSettlementRequest,
  DebtPeriodDetailDto,
  DebtPeriodTimelineApiDto,
  DebtPeriodTimelineDto,
  DebtPeriodTimelineMatchDto,
  ListDebtPeriodsQuery,
  MatchListItemDto,
  MatchStakesMatchesQuery,
  ModuleLedgerQuery,
  ModuleSummaryQuery
} from "@/types/api";

const PERIODS_PAGE_SIZE = 100;
const MATCHES_PAGE_SIZE = 100;

const invalidateMatchStakesQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: ["match-stakes"] });
};

const toMillis = (iso: string) => Date.parse(iso);

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

      const matchNo = typeof item.matchNo === "number" ? item.matchNo : fallbackMatchNo;
      fallbackMatchNo -= 1;

      history.push({
        matchId: item.matchId ?? `timeline-match-${history.length + 1}`,
        playedAt: item.playedAt ?? payload.period.openedAt,
        matchNo,
        label: `Match ${matchNo}`,
        players: normalizedRows
      });
    }

    return {
      period: payload.period,
      summary: payload.summary,
      players,
      history: sortTimelineDesc(history),
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

export const useDebtPeriodTimeline = (periodId?: string) =>
  useQuery({
    queryKey: queryKeys.matchStakes.periodTimeline(periodId ?? ""),
    enabled: Boolean(periodId),
    queryFn: async () => {
      const id = periodId as string;
      const timelinePayload = await matchStakesApi.periodTimeline(id, { includeInitialSnapshot: true });
      const normalizedTimeline = timelinePayload ? normalizeTimelinePayload(timelinePayload) : null;

      if (normalizedTimeline) {
        return normalizedTimeline;
      }

      const [detail, matches] = await Promise.all([matchStakesApi.periodDetail(id), fetchAllMatchesByPeriod(id)]);
      return buildTimelineFromFallback(detail, matches);
    }
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
