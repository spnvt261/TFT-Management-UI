import { EmptyState } from "@/components/states/EmptyState";
import { Button, Tag } from "antd";
import { formatDateTime, formatVnd } from "@/lib/format";
import type { MatchStakesHistoryItemDto, DebtPeriodTimelinePlayerRowDto } from "@/types/api";

export type MatchStakesHistoryViewMode = "minimal" | "detail";

export interface MatchStakesHistoryFeedItem extends MatchStakesHistoryItemDto {
  matchRows?: DebtPeriodTimelinePlayerRowDto[];
}

interface MatchStakesHistoryFeedProps {
  items: MatchStakesHistoryFeedItem[];
  viewMode: MatchStakesHistoryViewMode;
  debtViewMode?: "match-only" | "advance-only" | "combined";
  onOpenMatch: (item: MatchStakesHistoryFeedItem) => void;
  onRequestResetAdvance?: (item: MatchStakesHistoryFeedItem) => void;
  resettingEventId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

const getAmountClassName = (value: number) => {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
};

const formatSignedAmount = (value: number) => (value > 0 ? `+${formatVnd(value)}` : formatVnd(value));

const getPlacementRank = (row: DebtPeriodTimelinePlayerRowDto) =>
  typeof row.tftPlacement === "number" ? row.tftPlacement : row.relativeRank;

const getPlacementLabel = (row: DebtPeriodTimelinePlayerRowDto) => {
  if (row.placementLabel) {
    const placementMatch = row.placementLabel.match(/top\s*(\d+)/i);
    if (placementMatch) {
      return `Top${placementMatch[1]}`;
    }

    return row.placementLabel;
  }

  const rank = getPlacementRank(row);
  return typeof rank === "number" ? `Top${rank}` : "-";
};

const getPlacementClassName = (row: DebtPeriodTimelinePlayerRowDto) => {
  const rank = getPlacementRank(row);
  if (rank === 1) {
    return "text-amber-600 font-semibold";
  }

  return "text-slate-500";
};

const isMatchParticipantRow = (row: DebtPeriodTimelinePlayerRowDto) => {
  const rank = getPlacementRank(row);
  if (typeof rank === "number") {
    return true;
  }

  const placementLabel = row.placementLabel?.trim();
  return Boolean(placementLabel && placementLabel !== "-");
};

const sortMatchRows = (rows: DebtPeriodTimelinePlayerRowDto[]) => {
  const next = [...rows];
  next.sort((left, right) => left.playerName.localeCompare(right.playerName));

  return next;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const toOptionalString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null);
const toOptionalNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const getFirstFiniteNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const getMatchRowDelta = (row: DebtPeriodTimelinePlayerRowDto) => getFirstFiniteNumber(row.matchDeltaVnd, row.matchNetVnd);
const getAdvanceRowDelta = (row: DebtPeriodTimelinePlayerRowDto) => getFirstFiniteNumber(row.advanceDeltaVnd, 0);
const getCombinedRowDelta = (row: DebtPeriodTimelinePlayerRowDto) =>
  getFirstFiniteNumber(row.combinedDeltaVnd, row.matchNetVnd, getMatchRowDelta(row) + getAdvanceRowDelta(row));
const getMatchRowCumulative = (row: DebtPeriodTimelinePlayerRowDto) => {
  const combinedCumulative = toOptionalNumber(row.cumulativeCombinedNetVnd) ?? toOptionalNumber(row.cumulativeNetVnd);
  const advanceCumulative = toOptionalNumber(row.cumulativeAdvanceNetVnd);

  if (combinedCumulative !== null && advanceCumulative !== null) {
    // Keep initial carry-forward inside match timeline projection.
    return combinedCumulative - advanceCumulative;
  }

  return getFirstFiniteNumber(row.cumulativeMatchNetVnd, combinedCumulative, row.cumulativeNetVnd);
};
const getAdvanceRowCumulative = (row: DebtPeriodTimelinePlayerRowDto) => getFirstFiniteNumber(row.cumulativeAdvanceNetVnd, 0);
const getCombinedRowCumulative = (row: DebtPeriodTimelinePlayerRowDto) =>
  getFirstFiniteNumber(
    row.cumulativeCombinedNetVnd,
    row.cumulativeNetVnd,
    getMatchRowCumulative(row) + getAdvanceRowCumulative(row)
  );

const getAdvanceCardDelta = (
  row: DebtPeriodTimelinePlayerRowDto,
  debtViewMode: "match-only" | "advance-only" | "combined"
) => (debtViewMode === "advance-only" ? getAdvanceRowDelta(row) : getCombinedRowDelta(row));

const getAdvanceCardCumulative = (
  row: DebtPeriodTimelinePlayerRowDto,
  debtViewMode: "match-only" | "advance-only" | "combined"
) => (debtViewMode === "advance-only" ? getAdvanceRowCumulative(row) : getCombinedRowCumulative(row));

const normalizeHistoryItemType = (item: MatchStakesHistoryFeedItem) => {
  const rawType = typeof item.itemType === "string" ? item.itemType.toUpperCase() : "";
  const rawEventType = typeof item.eventType === "string" ? item.eventType.toUpperCase() : "";

  if (rawType === "MATCH" || rawType === "DEBT_SETTLEMENT" || rawType === "ADVANCE" || rawType === "NOTE") {
    return rawType;
  }

  if (rawType === "MATCH_STAKES_ADVANCE") {
    return "ADVANCE";
  }

  if (rawType === "MATCH_STAKES_NOTE") {
    return "NOTE";
  }

  if (rawEventType === "MATCH_STAKES_ADVANCE") {
    return "ADVANCE";
  }

  if (rawEventType === "MATCH_STAKES_NOTE") {
    return "NOTE";
  }

  if (item.matchId) {
    return "MATCH";
  }

  return "NOTE";
};

const getMatchPrimaryTag = (item: MatchStakesHistoryFeedItem) => {
  if (typeof item.matchNo === "number") {
    return `Match#${item.matchNo}`;
  }

  return "Match";
};

const resolvePlayerImpactDelta = (impact: NonNullable<MatchStakesHistoryItemDto["playerImpacts"]>[number]) => {
  if (typeof impact.amountVnd === "number" && Number.isFinite(impact.amountVnd)) {
    return impact.amountVnd;
  }

  if (typeof impact.debtBeforeVnd === "number" && typeof impact.debtAfterVnd === "number") {
    return impact.debtAfterVnd - impact.debtBeforeVnd;
  }

  return null;
};

const getMatchRowDebtSnapshot = (
  row: DebtPeriodTimelinePlayerRowDto,
  debtViewMode: "match-only" | "advance-only" | "combined"
) => {
  const deltaVnd =
    debtViewMode === "match-only" ? getMatchRowDelta(row) : debtViewMode === "advance-only" ? getAdvanceRowDelta(row) : getCombinedRowDelta(row);
  const afterVnd =
    debtViewMode === "match-only"
      ? getMatchRowCumulative(row)
      : debtViewMode === "advance-only"
        ? getAdvanceRowCumulative(row)
        : getCombinedRowCumulative(row);

  return {
    deltaVnd,
    beforeVnd: afterVnd - deltaVnd,
    afterVnd
  };
};

type PlayerDebtSnapshot = {
  beforeVnd: number;
  afterVnd: number;
};

type ItemPlayerDebtSnapshotLookup = {
  byId: Map<string, PlayerDebtSnapshot>;
  byName: Map<string, PlayerDebtSnapshot>;
  nameById: Map<string, string>;
};

const toTimestampMs = (value: string | null | undefined) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortHistoryItemsAscending = (items: MatchStakesHistoryFeedItem[]) => {
  const next = [...items];
  next.sort((left, right) => {
    const postedDiff = toTimestampMs(left.postedAt) - toTimestampMs(right.postedAt);
    if (postedDiff !== 0) {
      return postedDiff;
    }

    const createdDiff = toTimestampMs(left.createdAt) - toTimestampMs(right.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });

  return next;
};

type HistoryItemDeltaRow = {
  playerId: string | null;
  playerName: string | null;
  deltaVnd: number;
};

const buildHistoryItemDeltaRows = (
  item: MatchStakesHistoryFeedItem,
  debtViewMode: "match-only" | "advance-only" | "combined"
): HistoryItemDeltaRow[] => {
  if (Array.isArray(item.matchRows) && item.matchRows.length > 0) {
    return item.matchRows
      .map((row) => ({
        playerId: row.playerId ?? null,
        playerName: row.playerName ?? null,
        deltaVnd: getMatchRowDebtSnapshot(row, debtViewMode).deltaVnd
      }))
      .filter((row) => Number.isFinite(row.deltaVnd) && row.deltaVnd !== 0);
  }

  const fromPlayerImpacts = (item.playerImpacts ?? [])
    .map((impact) => ({
      playerId: toOptionalString(impact.playerId),
      playerName: toOptionalString(impact.playerName),
      deltaVnd: resolvePlayerImpactDelta(impact)
    }))
    .filter((row): row is HistoryItemDeltaRow => typeof row.deltaVnd === "number" && row.deltaVnd !== 0 && Boolean(row.playerId || row.playerName));

  if (fromPlayerImpacts.length > 0) {
    return fromPlayerImpacts;
  }

  const metadataDetails = getAdvanceMetadataDetails(item);
  const metadataImpactLines = Array.isArray(metadataDetails?.["impactLines"]) ? metadataDetails["impactLines"] : [];
  const topLevelImpactLines = Array.isArray(item.impactLines) ? item.impactLines : [];
  const impactLines = topLevelImpactLines.length > 0 ? topLevelImpactLines : metadataImpactLines;

  return impactLines
    .map((line) => {
      if (!isRecord(line)) {
        return null;
      }

      const linePlayerId = toOptionalString(line["playerId"]);
      const linePlayerName =
        toOptionalString(line["playerName"]) ??
        (linePlayerId ? null : toOptionalString(item.playerName));
      const lineDelta =
        toOptionalNumber(line["netDeltaVnd"]) ??
        (() => {
          const beforeVnd = toOptionalNumber(line["debtBeforeVnd"]);
          const afterVnd = toOptionalNumber(line["debtAfterVnd"]);
          if (beforeVnd === null || afterVnd === null) {
            return null;
          }
          return afterVnd - beforeVnd;
        })();

      if (lineDelta === null || lineDelta === 0 || (!linePlayerId && !linePlayerName)) {
        return null;
      }

      return {
        playerId: linePlayerId,
        playerName: linePlayerName,
        deltaVnd: lineDelta
      };
    })
    .filter((row): row is HistoryItemDeltaRow => row !== null);
};

const buildItemPlayerDebtSnapshots = (
  items: MatchStakesHistoryFeedItem[],
  debtViewMode: "match-only" | "advance-only" | "combined"
) => {
  const snapshotsByItemId = new Map<string, ItemPlayerDebtSnapshotLookup>();
  const runningByPlayerId = new Map<string, { playerName: string; balance: number }>();
  const runningByPlayerName = new Map<string, { playerName: string; balance: number }>();

  for (const item of sortHistoryItemsAscending(items)) {
    const beforeByPlayerId = new Map<string, number>();
    const beforeByPlayerName = new Map<string, number>();
    for (const [playerId, state] of runningByPlayerId) {
      beforeByPlayerId.set(playerId, state.balance);
    }
    for (const [playerNameKey, state] of runningByPlayerName) {
      beforeByPlayerName.set(playerNameKey, state.balance);
    }

    const mergedDeltas = new Map<string, HistoryItemDeltaRow>();
    for (const row of buildHistoryItemDeltaRows(item, debtViewMode)) {
      const normalizedName = toOptionalString(row.playerName)?.toLowerCase() ?? null;
      const key = row.playerId ? `id:${row.playerId}` : normalizedName ? `name:${normalizedName}` : null;
      if (!key) {
        continue;
      }

      const current = mergedDeltas.get(key);
      if (current) {
        current.deltaVnd += row.deltaVnd;
        if (!current.playerId && row.playerId) {
          current.playerId = row.playerId;
        }
        if (!current.playerName && row.playerName) {
          current.playerName = row.playerName;
        }
      } else {
        mergedDeltas.set(key, {
          playerId: row.playerId,
          playerName: row.playerName,
          deltaVnd: row.deltaVnd
        });
      }
    }

    for (const delta of mergedDeltas.values()) {
      const normalizedName = toOptionalString(delta.playerName)?.toLowerCase() ?? null;

      if (delta.playerId) {
        const idState = runningByPlayerId.get(delta.playerId);
        const nameState = normalizedName ? runningByPlayerName.get(normalizedName) : undefined;
        const beforeVnd = idState?.balance ?? nameState?.balance ?? 0;
        const afterVnd = beforeVnd + delta.deltaVnd;
        const resolvedPlayerName = toOptionalString(delta.playerName) ?? idState?.playerName ?? nameState?.playerName ?? "Player";
        const previousNameKey = idState?.playerName.toLowerCase();
        const nextNameKey = resolvedPlayerName.toLowerCase();
        if (previousNameKey && previousNameKey !== nextNameKey) {
          runningByPlayerName.delete(previousNameKey);
        }

        runningByPlayerId.set(delta.playerId, { playerName: resolvedPlayerName, balance: afterVnd });
        runningByPlayerName.set(nextNameKey, { playerName: resolvedPlayerName, balance: afterVnd });
        continue;
      }

      if (normalizedName) {
        const nameState = runningByPlayerName.get(normalizedName);
        const beforeVnd = nameState?.balance ?? 0;
        const afterVnd = beforeVnd + delta.deltaVnd;
        const resolvedPlayerName = toOptionalString(delta.playerName) ?? nameState?.playerName ?? "Player";
        runningByPlayerName.set(normalizedName, { playerName: resolvedPlayerName, balance: afterVnd });
      }
    }

    const itemSnapshot: ItemPlayerDebtSnapshotLookup = {
      byId: new Map<string, PlayerDebtSnapshot>(),
      byName: new Map<string, PlayerDebtSnapshot>(),
      nameById: new Map<string, string>()
    };

    for (const [playerId, state] of runningByPlayerId) {
      const normalizedName = state.playerName.toLowerCase();
      const beforeVnd = beforeByPlayerId.get(playerId) ?? beforeByPlayerName.get(normalizedName) ?? state.balance;
      const playerSnapshot: PlayerDebtSnapshot = { beforeVnd, afterVnd: state.balance };

      itemSnapshot.byId.set(playerId, playerSnapshot);
      itemSnapshot.byName.set(normalizedName, playerSnapshot);
      itemSnapshot.nameById.set(playerId, state.playerName);
    }

    for (const [normalizedName, state] of runningByPlayerName) {
      if (itemSnapshot.byName.has(normalizedName)) {
        continue;
      }

      const beforeVnd = beforeByPlayerName.get(normalizedName) ?? state.balance;
      itemSnapshot.byName.set(normalizedName, { beforeVnd, afterVnd: state.balance });
    }

    snapshotsByItemId.set(item.id, itemSnapshot);
  }

  return snapshotsByItemId;
};

type AdvanceDetailRow = {
  playerId: string | null;
  playerName: string;
  deltaVnd: number;
  beforeVnd: number | null;
  afterVnd: number | null;
};

type AdvanceRenderRow = AdvanceDetailRow & {
  isPlaceholder?: boolean;
};

const isAdvanceDetailRow = (row: {
  playerId: string | null;
  playerName: string;
  deltaVnd: number | null;
  beforeVnd?: number | null;
  afterVnd?: number | null;
}): row is AdvanceDetailRow => typeof row.deltaVnd === "number";

const sortAdvanceDetailRowsByName = (rows: AdvanceDetailRow[]) => {
  const next = [...rows];
  next.sort((left, right) => left.playerName.localeCompare(right.playerName));
  return next;
};

const getAdvanceMetadataDetails = (item: MatchStakesHistoryFeedItem) => {
  if (!isRecord(item.metadata)) {
    return null;
  }

  return isRecord(item.metadata.details) ? item.metadata.details : item.metadata;
};

const buildAdvanceDetailRows = (
  item: MatchStakesHistoryFeedItem,
  debtViewMode: "match-only" | "advance-only" | "combined",
  itemDebtSnapshots?: ItemPlayerDebtSnapshotLookup | null
): AdvanceDetailRow[] => {
  const snapshotByPlayerId = new Map<string, { beforeVnd: number; afterVnd: number }>();
  for (const row of item.matchRows ?? []) {
    const afterVnd = getAdvanceCardCumulative(row, debtViewMode);
    const deltaVnd = getAdvanceCardDelta(row, debtViewMode);
    snapshotByPlayerId.set(row.playerId, {
      beforeVnd: afterVnd - deltaVnd,
      afterVnd
    });
  }

  const playerNameById = new Map<string, string>();
  for (const impact of item.playerImpacts ?? []) {
    const playerId = toOptionalString(impact.playerId);
    const playerName = toOptionalString(impact.playerName);
    if (playerId && playerName) {
      playerNameById.set(playerId, playerName);
    }
  }

  for (const row of item.matchRows ?? []) {
    if (row.playerId && row.playerName) {
      playerNameById.set(row.playerId, row.playerName);
    }
  }

  const metadataDetails = getAdvanceMetadataDetails(item);
  const metadataImpactLines = Array.isArray(metadataDetails?.["impactLines"]) ? metadataDetails["impactLines"] : [];
  const topLevelImpactLines = Array.isArray(item.impactLines) ? item.impactLines : [];
  const impactLines = topLevelImpactLines.length > 0 ? topLevelImpactLines : metadataImpactLines;
  const rowsFromImpactLines: AdvanceDetailRow[] = [];

  if (debtViewMode === "combined" && Array.isArray(item.matchRows) && item.matchRows.length > 0) {
    const rowsFromCombinedMatchRows = sortAdvanceDetailRowsByName(
      item.matchRows
        .filter((row) => getAdvanceCardDelta(row, debtViewMode) !== 0)
        .map((row) => {
          const normalizedName = row.playerName.toLowerCase();
          const combinedSnapshot =
            (row.playerId ? itemDebtSnapshots?.byId.get(row.playerId) : undefined) ?? itemDebtSnapshots?.byName.get(normalizedName);
          const deltaVnd = getAdvanceCardDelta(row, debtViewMode);
          const fallbackAfterVnd = getAdvanceCardCumulative(row, debtViewMode);
          return {
            playerId: row.playerId,
            playerName: row.playerName,
            deltaVnd,
            beforeVnd: combinedSnapshot?.beforeVnd ?? fallbackAfterVnd - deltaVnd,
            afterVnd: combinedSnapshot?.afterVnd ?? fallbackAfterVnd
          };
        })
    );

    if (rowsFromCombinedMatchRows.length > 0) {
      return rowsFromCombinedMatchRows;
    }
  }

  const resolveHistorySnapshot = (playerId: string | null, playerName: string | null) => {
    if (!itemDebtSnapshots) {
      return null;
    }

    if (playerId) {
      const byId = itemDebtSnapshots.byId.get(playerId);
      if (byId) {
        return byId;
      }
    }

    const normalizedName = toOptionalString(playerName)?.toLowerCase();
    if (normalizedName) {
      return itemDebtSnapshots.byName.get(normalizedName) ?? null;
    }

    return null;
  };

  const resolveBeforeAfterFromSources = (
    playerId: string | null,
    playerName: string | null,
    explicitBeforeVnd: number | null,
    explicitAfterVnd: number | null
  ) => {
    const historySnapshot = resolveHistorySnapshot(playerId, playerName);
    if (historySnapshot) {
      return {
        beforeVnd: historySnapshot.beforeVnd,
        afterVnd: historySnapshot.afterVnd
      };
    }

    const snapshot = playerId ? snapshotByPlayerId.get(playerId) : undefined;
    if (debtViewMode === "combined" && snapshot) {
      return {
        beforeVnd: snapshot.beforeVnd,
        afterVnd: snapshot.afterVnd
      };
    }

    return {
      beforeVnd: explicitBeforeVnd ?? snapshot?.beforeVnd ?? null,
      afterVnd: explicitAfterVnd ?? snapshot?.afterVnd ?? null
    };
  };

  const resolveDisplayName = (playerId: string | null, playerName: string | null) => {
    if (playerId) {
      const snapshotName = itemDebtSnapshots?.nameById.get(playerId);
      if (snapshotName) {
        return snapshotName;
      }
    }

    return toOptionalString(playerName) ?? null;
  };

  for (const impactLine of impactLines) {
    if (!isRecord(impactLine)) {
      continue;
    }

    const playerId = toOptionalString(impactLine["playerId"]);
    const playerName =
      toOptionalString(impactLine["playerName"]) ??
      (playerId ? playerNameById.get(playerId) ?? null : null) ??
      (playerId ? null : toOptionalString(item.playerName));
    const deltaVnd =
      toOptionalNumber(impactLine["netDeltaVnd"]) ??
      (() => {
        const beforeVnd = toOptionalNumber(impactLine["debtBeforeVnd"]);
        const afterVnd = toOptionalNumber(impactLine["debtAfterVnd"]);
        if (beforeVnd === null || afterVnd === null) {
          return null;
        }
        return afterVnd - beforeVnd;
      })();

    if (!playerId && !playerName) {
      continue;
    }

    const explicitBeforeVnd = toOptionalNumber(impactLine["debtBeforeVnd"]);
    const explicitAfterVnd = toOptionalNumber(impactLine["debtAfterVnd"]);
    const resolvedBeforeAfter = resolveBeforeAfterFromSources(playerId, playerName, explicitBeforeVnd, explicitAfterVnd);
    const displayName = resolveDisplayName(playerId, playerName) ?? (playerId ? playerNameById.get(playerId) ?? null : null) ?? "Player";

    const candidate = {
      playerId,
      playerName: displayName,
      deltaVnd,
      beforeVnd: resolvedBeforeAfter.beforeVnd,
      afterVnd: resolvedBeforeAfter.afterVnd
    };

    if (!isAdvanceDetailRow(candidate) || candidate.deltaVnd === 0) {
      continue;
    }

    rowsFromImpactLines.push(candidate);
  }

  if (rowsFromImpactLines.length > 0) {
    return sortAdvanceDetailRowsByName(rowsFromImpactLines);
  }

  const rowsFromPlayerImpacts: AdvanceDetailRow[] = [];
  for (const impact of item.playerImpacts ?? []) {
    const impactPlayerId = toOptionalString(impact.playerId);
    const impactPlayerName = toOptionalString(impact.playerName) ?? (impactPlayerId ? playerNameById.get(impactPlayerId) ?? null : null);
    if (!impactPlayerId && !impactPlayerName) {
      continue;
    }

    const resolvedBeforeAfter = resolveBeforeAfterFromSources(
      impactPlayerId,
      impactPlayerName,
      toOptionalNumber(impact.debtBeforeVnd),
      toOptionalNumber(impact.debtAfterVnd)
    );

    const candidate = {
      playerId: impactPlayerId,
      playerName: resolveDisplayName(impactPlayerId, impactPlayerName) ?? impactPlayerName ?? "Player",
      deltaVnd: resolvePlayerImpactDelta(impact),
      beforeVnd: resolvedBeforeAfter.beforeVnd,
      afterVnd: resolvedBeforeAfter.afterVnd
    };

    if (!isAdvanceDetailRow(candidate) || candidate.deltaVnd === 0) {
      continue;
    }

    rowsFromPlayerImpacts.push(candidate);
  }

  if (rowsFromPlayerImpacts.length > 0) {
    return sortAdvanceDetailRowsByName(rowsFromPlayerImpacts);
  }

  if (!Array.isArray(item.matchRows)) {
    const eventLevelBeforeVnd = toOptionalNumber(item.balanceBeforeVnd);
    const eventLevelAfterVnd = toOptionalNumber(item.balanceAfterVnd);
    const eventLevelDeltaVnd =
      (eventLevelBeforeVnd !== null && eventLevelAfterVnd !== null
        ? eventLevelAfterVnd - eventLevelBeforeVnd
        : null) ??
      toOptionalNumber(item.debtImpactVnd) ??
      toOptionalNumber(item.amountVnd) ??
      0;

    const fallbackBeforeVnd = eventLevelBeforeVnd;
    const fallbackAfterVnd =
      eventLevelAfterVnd !== null
        ? eventLevelAfterVnd
        : fallbackBeforeVnd !== null
          ? fallbackBeforeVnd + eventLevelDeltaVnd
          : null;

    return [
      {
        playerId: toOptionalString(item.playerId) ?? null,
        playerName: toOptionalString(item.playerName) ?? "Player",
        deltaVnd: eventLevelDeltaVnd,
        beforeVnd: fallbackBeforeVnd,
        afterVnd: fallbackAfterVnd
      }
    ];
  }

  const rowsFromMatchRows = sortAdvanceDetailRowsByName(
    item.matchRows
    .filter((row) => getAdvanceCardDelta(row, debtViewMode) !== 0)
    .map((row) => {
      const normalizedName = row.playerName.toLowerCase();
      const historySnapshot =
        (row.playerId ? itemDebtSnapshots?.byId.get(row.playerId) : undefined) ?? itemDebtSnapshots?.byName.get(normalizedName);
      const deltaVnd = getAdvanceCardDelta(row, debtViewMode);
      const fallbackAfterVnd = getAdvanceCardCumulative(row, debtViewMode);

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        deltaVnd,
        beforeVnd: historySnapshot?.beforeVnd ?? fallbackAfterVnd - deltaVnd,
        afterVnd: historySnapshot?.afterVnd ?? fallbackAfterVnd
      };
    })
  );

  if (rowsFromMatchRows.length > 0) {
    return rowsFromMatchRows;
  }

  const eventLevelBeforeVnd = toOptionalNumber(item.balanceBeforeVnd);
  const eventLevelAfterVnd = toOptionalNumber(item.balanceAfterVnd);
  const eventLevelDeltaVnd =
    (eventLevelBeforeVnd !== null && eventLevelAfterVnd !== null
      ? eventLevelAfterVnd - eventLevelBeforeVnd
      : null) ??
    toOptionalNumber(item.debtImpactVnd) ??
    toOptionalNumber(item.amountVnd) ??
    0;

  const fallbackBeforeVnd = eventLevelBeforeVnd;
  const fallbackAfterVnd =
    eventLevelAfterVnd !== null
      ? eventLevelAfterVnd
      : fallbackBeforeVnd !== null
        ? fallbackBeforeVnd + eventLevelDeltaVnd
        : null;

  return [
    {
      playerId: toOptionalString(item.playerId) ?? null,
      playerName: toOptionalString(item.playerName) ?? "Player",
      deltaVnd: eventLevelDeltaVnd,
      beforeVnd: fallbackBeforeVnd,
      afterVnd: fallbackAfterVnd
    }
  ];
};

type AdvancePlayerSlot = {
  playerId: string | null;
  playerName: string;
};

type AdvanceSlotFallback = {
  byId: Map<string, AdvanceDetailRow>;
  byName: Map<string, AdvanceDetailRow>;
};

const buildAdvancePlayerSlots = (items: MatchStakesHistoryFeedItem[]): AdvancePlayerSlot[] => {
  const byKey = new Map<string, AdvancePlayerSlot>();

  const upsert = (playerId: string | null | undefined, playerName: string | null | undefined) => {
    const normalizedName = toOptionalString(playerName);
    if (!normalizedName) {
      return;
    }

    const normalizedId = toOptionalString(playerId);
    const key = normalizedId ?? `name:${normalizedName.toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        playerId: normalizedId ?? null,
        playerName: normalizedName
      });
    }
  };

  for (const item of items) {
    for (const row of item.matchRows ?? []) {
      upsert(row.playerId, row.playerName);
    }

    for (const impact of item.playerImpacts ?? []) {
      upsert(impact.playerId, impact.playerName);
    }

    upsert(item.playerId, item.playerName);
  }

  const slots = Array.from(byKey.values());
  slots.sort((left, right) => left.playerName.localeCompare(right.playerName));
  return slots;
};

const buildAdvanceSlotFallback = (
  item: MatchStakesHistoryFeedItem,
  debtViewMode: "match-only" | "advance-only" | "combined",
  itemDebtSnapshots?: ItemPlayerDebtSnapshotLookup | null
): AdvanceSlotFallback => {
  const fallback: AdvanceSlotFallback = {
    byId: new Map<string, AdvanceDetailRow>(),
    byName: new Map<string, AdvanceDetailRow>()
  };

  for (const row of item.matchRows ?? []) {
    const normalizedName = row.playerName.toLowerCase();
    const historySnapshot =
      (row.playerId ? itemDebtSnapshots?.byId.get(row.playerId) : undefined) ?? itemDebtSnapshots?.byName.get(normalizedName);
    const deltaVnd = getAdvanceCardDelta(row, debtViewMode);
    const fallbackAfterVnd = getAdvanceCardCumulative(row, debtViewMode);

    const detailRow: AdvanceDetailRow = {
      playerId: row.playerId ?? null,
      playerName: row.playerName,
      deltaVnd,
      beforeVnd: historySnapshot?.beforeVnd ?? fallbackAfterVnd - deltaVnd,
      afterVnd: historySnapshot?.afterVnd ?? fallbackAfterVnd
    };

    if (row.playerId) {
      fallback.byId.set(row.playerId, detailRow);
    }

    fallback.byName.set(row.playerName.toLowerCase(), detailRow);
  }

  if (itemDebtSnapshots) {
    for (const [playerId, snapshot] of itemDebtSnapshots.byId.entries()) {
      if (fallback.byId.has(playerId)) {
        continue;
      }

      const playerName = itemDebtSnapshots.nameById.get(playerId) ?? "Player";
      const detailRow: AdvanceDetailRow = {
        playerId,
        playerName,
        deltaVnd: snapshot.afterVnd - snapshot.beforeVnd,
        beforeVnd: snapshot.beforeVnd,
        afterVnd: snapshot.afterVnd
      };
      fallback.byId.set(playerId, detailRow);
      fallback.byName.set(playerName.toLowerCase(), detailRow);
    }

    for (const [normalizedName, snapshot] of itemDebtSnapshots.byName.entries()) {
      if (fallback.byName.has(normalizedName)) {
        continue;
      }

      fallback.byName.set(normalizedName, {
        playerId: null,
        playerName: normalizedName,
        deltaVnd: snapshot.afterVnd - snapshot.beforeVnd,
        beforeVnd: snapshot.beforeVnd,
        afterVnd: snapshot.afterVnd
      });
    }
  }

  return fallback;
};

const alignAdvanceRowsWithSlots = (
  rows: AdvanceDetailRow[],
  slots: AdvancePlayerSlot[],
  fallback: AdvanceSlotFallback
): AdvanceRenderRow[] => {
  if (slots.length === 0) {
    return rows;
  }

  const byId = new Map<string, AdvanceDetailRow>();
  const byName = new Map<string, AdvanceDetailRow[]>();
  for (const row of rows) {
    if (row.playerId) {
      byId.set(row.playerId, row);
    }

    const normalizedName = row.playerName.toLowerCase();
    const sameNameRows = byName.get(normalizedName) ?? [];
    sameNameRows.push(row);
    byName.set(normalizedName, sameNameRows);
  }

  const consumedRows = new Set<AdvanceDetailRow>();
  const takeByName = (name: string) => {
    const candidates = byName.get(name.toLowerCase()) ?? [];
    for (const candidate of candidates) {
      if (!consumedRows.has(candidate)) {
        consumedRows.add(candidate);
        return candidate;
      }
    }

    return null;
  };

  const aligned: AdvanceRenderRow[] = slots.map((slot) => {
    let matched: AdvanceDetailRow | null = null;
    if (slot.playerId) {
      const matchedById = byId.get(slot.playerId);
      if (matchedById && !consumedRows.has(matchedById)) {
        consumedRows.add(matchedById);
        matched = matchedById;
      }
    }

    if (!matched) {
      matched = takeByName(slot.playerName);
    }

    if (matched) {
      return {
        ...matched,
        playerId: slot.playerId ?? matched.playerId,
        playerName: slot.playerName
      };
    }

    const fallbackDetail =
      (slot.playerId ? fallback.byId.get(slot.playerId) : null) ??
      fallback.byName.get(slot.playerName.toLowerCase()) ??
      null;

    if (fallbackDetail) {
      return {
        ...fallbackDetail,
        playerId: slot.playerId ?? fallbackDetail.playerId,
        playerName: slot.playerName,
        isPlaceholder: true
      };
    }

    return {
      playerId: slot.playerId,
      playerName: slot.playerName,
      deltaVnd: 0,
      beforeVnd: null,
      afterVnd: null,
      isPlaceholder: true
    };
  });

  // Keep any extra rows that are not present in canonical slots.
  for (const row of rows) {
    if (!consumedRows.has(row)) {
      aligned.push(row);
    }
  }

  return aligned;
};

const toResetLabel = (item: MatchStakesHistoryFeedItem) => {
  if (item.eventStatus !== "RESET") {
    return null;
  }

  const resetAtLabel = item.resetAt ? formatDateTime(item.resetAt) : null;
  const resetReasonLabel = item.resetReason?.trim() || null;

  if (resetAtLabel && resetReasonLabel) {
    return `Reset at ${resetAtLabel}: ${resetReasonLabel}`;
  }

  if (resetAtLabel) {
    return `Reset at ${resetAtLabel}`;
  }

  if (resetReasonLabel) {
    return `Reset reason: ${resetReasonLabel}`;
  }

  return "Reset";
};

const getRowDeltaLabel = (debtViewMode: "match-only" | "advance-only" | "combined") => {
  if (debtViewMode === "match-only") {
    return "Match";
  }

  if (debtViewMode === "advance-only") {
    return "Advance";
  }

  return "Combined";
};

const resolveMatchHistoryMode = (debtViewMode: "match-only" | "advance-only" | "combined") =>
  debtViewMode === "combined" ? "combined" : "match-only";

const compactTagClassName = "!text-[11px] !mr-1 !mb-0";

export const MatchStakesHistoryFeed = ({
  items,
  viewMode,
  debtViewMode = "combined",
  onOpenMatch,
  onRequestResetAdvance,
  resettingEventId,
  emptyTitle = "No history yet",
  emptyDescription = "Create matches or events to build history."
}: MatchStakesHistoryFeedProps) => {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const visibleItems =
    debtViewMode === "advance-only"
      ? items.filter((item) => normalizeHistoryItemType(item) === "ADVANCE")
      : debtViewMode === "match-only"
        ? items.filter((item) => normalizeHistoryItemType(item) !== "ADVANCE")
      : items;

  if (visibleItems.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const advancePlayerSlots = buildAdvancePlayerSlots(items);
  const itemDebtSnapshotsById =
    debtViewMode === "combined" || debtViewMode === "advance-only"
      ? buildItemPlayerDebtSnapshots(items, debtViewMode)
      : null;

  return (
    <div className="flex flex-wrap gap-2.5">
      {visibleItems.map((item) => {
        const itemType = normalizeHistoryItemType(item);
        const itemAmount = typeof item.amountVnd === "number" ? item.amountVnd : null;
        const clickable = itemType === "MATCH" && Boolean(item.matchId);
        const hasMatchRows = itemType === "MATCH" && Array.isArray(item.matchRows) && item.matchRows.length > 0;
        const sortedMatchRows = hasMatchRows ? sortMatchRows(item.matchRows ?? []) : [];
        const advanceNoteTag = itemType === "ADVANCE" ? item.note?.trim() ?? null : null;
        const itemDebtSnapshots = itemDebtSnapshotsById?.get(item.id) ?? null;
        const rawAdvanceDetailRows =
          itemType === "ADVANCE" ? buildAdvanceDetailRows(item, debtViewMode, itemDebtSnapshots) : [];
        const advanceSlotFallback =
          itemType === "ADVANCE"
            ? buildAdvanceSlotFallback(item, debtViewMode, itemDebtSnapshots)
            : { byId: new Map<string, AdvanceDetailRow>(), byName: new Map<string, AdvanceDetailRow>() };
        const advanceDetailRows =
          itemType === "ADVANCE"
            ? alignAdvanceRowsWithSlots(rawAdvanceDetailRows, advancePlayerSlots, advanceSlotFallback)
            : [];
        const resetLabel = itemType === "ADVANCE" ? toResetLabel(item) : null;
        const canResetAdvance = itemType === "ADVANCE" && item.eventStatus === "ACTIVE" && !!onRequestResetAdvance;
        const advanceHeadlineLabel =
          itemType === "ADVANCE" && itemAmount !== null ? `${item.playerName ?? "Player"}: ${formatVnd(Math.abs(itemAmount))}` : null;
        const shouldShowReasonLine = itemType !== "MATCH" && itemType !== "ADVANCE" && Boolean(item.reason);
        const shouldShowNoteLine = itemType !== "MATCH" && itemType !== "ADVANCE" && Boolean(item.note);

        return (
          <div
            key={item.id}
            className={`focus-ring w-full sm:w-[calc(50%-0.3125rem)] xl:w-[calc(33.333%-0.5rem)] rounded-lg border border-slate-200 bg-white p-3 text-left transition ${
              clickable ? "cursor-pointer hover:border-brand-500" : "cursor-default"
            }`}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={() => {
              if (clickable) {
                onOpenMatch(item);
              }
            }}
            onKeyDown={(event) => {
              if (!clickable) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenMatch(item);
              }
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {itemType === "MATCH" ? (
                  <>
                    <Tag color="blue" className={compactTagClassName}>
                      {getMatchPrimaryTag(item)}
                    </Tag>
                    <Tag color="geekblue" className={compactTagClassName}>
                      TFT
                    </Tag>
                  </>
                ) : itemType === "ADVANCE" ? (
                  <div className="flex flex-wrap items-center gap-1 [&_.ant-tag]:!m-0">
                    {advanceHeadlineLabel ? (
                      <Tag className={`${compactTagClassName} !border-fuchsia-200 !bg-fuchsia-50 !text-fuchsia-700`}>
                        {advanceHeadlineLabel}
                      </Tag>
                    ) : null}
                    {advanceNoteTag ? (
                      <Tag color="purple" className={compactTagClassName}>
                        {advanceNoteTag}
                      </Tag>
                    ) : null}
                    {item.eventStatus === "RESET" ? <Tag className={compactTagClassName}>Reset</Tag> : null}
                  </div>
                ) : itemType === "DEBT_SETTLEMENT" ? (
                  <Tag color="gold" className={compactTagClassName}>
                    Debt settlement
                  </Tag>
                ) : (
                  <Tag className={compactTagClassName}>Note</Tag>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canResetAdvance ? (
                  <Button
                    type="link"
                    size="small"
                    className="!h-auto !p-0 text-xs"
                    loading={resettingEventId === item.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestResetAdvance?.(item);
                    }}
                  >
                    Reset
                  </Button>
                ) : null}
                <div className="text-xs font-medium text-slate-600">{formatDateTime(item.postedAt)}</div>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                {itemType === "ADVANCE" && !advanceHeadlineLabel ? <div className="text-sm font-semibold text-slate-900">{item.playerName ?? "Player"}</div> : null}
                {itemType === "ADVANCE" && resetLabel ? <div className="text-xs text-rose-600">{resetLabel}</div> : null}
                {!hasMatchRows && itemType !== "ADVANCE" && item.playerName ? <div className="text-sm text-slate-700">{item.playerName}</div> : null}
                {shouldShowReasonLine ? <div className="text-xs text-slate-500">{item.reason}</div> : null}
                {shouldShowNoteLine ? <div className="text-xs text-slate-500">{item.note}</div> : null}
              </div>
              {itemAmount !== null && itemType !== "ADVANCE" && itemType !== "MATCH" ? (
                <div
                  className={`text-sm font-semibold ${getAmountClassName(itemAmount)}`}
                >
                  {formatSignedAmount(itemAmount)}
                </div>
              ) : null}
            </div>

            {(itemType === "DEBT_SETTLEMENT" || itemType === "NOTE") &&
            (typeof item.balanceBeforeVnd === "number" || typeof item.balanceAfterVnd === "number") ? (
              <div className="mt-1 text-[11px] text-slate-500">{`Debt ${formatVnd(item.balanceBeforeVnd ?? 0)} -> ${formatVnd(item.balanceAfterVnd ?? 0)}`}</div>
            ) : null}

            {hasMatchRows ? (
              <div className="mt-2 space-y-1.5">
                {sortedMatchRows.map((row) => {
                  const matchHistoryMode = resolveMatchHistoryMode(debtViewMode);
                  const debtSnapshot = getMatchRowDebtSnapshot(row, matchHistoryMode);
                  const debtAfterVnd = debtSnapshot.afterVnd;
                  const debtBeforeVnd = debtSnapshot.beforeVnd;
                  const debtDeltaVnd = debtSnapshot.deltaVnd;
                  const debtDeltaLabel = getRowDeltaLabel(matchHistoryMode);
                  const isParticipant = isMatchParticipantRow(row);

                  return (
                    <div
                      key={`${item.id}-${row.playerId}`}
                      className={`rounded-md border px-2.5 py-1.5 ${
                        isParticipant ? "border-slate-200 bg-slate-50" : "border-gray-300 bg-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs font-medium text-slate-800">{row.playerName}</div>
                        <div className={`text-sm font-semibold ${getAmountClassName(debtAfterVnd)}`}>
                          {formatSignedAmount(debtAfterVnd)}
                        </div>
                      </div>
                      {viewMode === "detail" ? (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <span className={getPlacementClassName(row)}>{getPlacementLabel(row)}</span>
                          <span className={getAmountClassName(debtDeltaVnd)}>{`${debtDeltaLabel}: ${formatSignedAmount(debtDeltaVnd)}`}</span>
                          <span>{`Before: ${formatSignedAmount(debtBeforeVnd)}`}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {itemType === "ADVANCE" ? (
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-500">
                {advanceDetailRows.map((row, index) => {
                  const isPlaceholder = Boolean(row.isPlaceholder);
                  const afterVnd = row.afterVnd ?? row.deltaVnd;
                  const beforeVnd = row.beforeVnd ?? (afterVnd - row.deltaVnd);
                  const shouldShowCumulativeHeadline =
                    debtViewMode === "combined" || debtViewMode === "advance-only";
                  const headlineVnd = shouldShowCumulativeHeadline ? afterVnd : row.deltaVnd;
                  return (
                    <div
                      key={`${item.id}-advance-${row.playerId ?? index}`}
                      className={`rounded-md border px-2.5 py-1.5 ${isPlaceholder ? "border-gray-300 bg-gray-200" : "border-slate-200 bg-slate-50/80"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs font-medium text-slate-800">{row.playerName}</div>
                        <div className={`text-sm font-semibold ${getAmountClassName(headlineVnd)}`}>
                          {formatSignedAmount(headlineVnd)}
                        </div>
                      </div>
                      {viewMode === "detail" ? (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <span className={getAmountClassName(row.deltaVnd)}>{`Advance: ${formatSignedAmount(row.deltaVnd)}`}</span>
                          <span>{`Before: ${formatSignedAmount(beforeVnd)}`}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {resetLabel ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700">{resetLabel}</div>
                ) : null}
              </div>
            ) : null}

            {viewMode === "detail" && itemType === "DEBT_SETTLEMENT" && Array.isArray(item.settlementLines) ? (
              <div className="mt-2 space-y-1">
                {item.settlementLines.map((line, index) => (
                  <div key={`${item.id}-line-${index}`} className="text-[11px] text-slate-500">
                    {`${line.payerPlayerName} -> ${line.receiverPlayerName}: ${formatVnd(line.amountVnd)}`}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
