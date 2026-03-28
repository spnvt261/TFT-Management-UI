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

type AdvanceDetailRow = {
  playerId: string | null;
  playerName: string;
  deltaVnd: number;
  beforeVnd: number | null;
  afterVnd: number | null;
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

const buildAdvanceDetailRows = (item: MatchStakesHistoryFeedItem): AdvanceDetailRow[] => {
  const combinedSnapshotByPlayerId = new Map<string, { beforeVnd: number; afterVnd: number }>();
  for (const row of item.matchRows ?? []) {
    const afterVnd = getCombinedRowCumulative(row);
    const deltaVnd = getCombinedRowDelta(row);
    combinedSnapshotByPlayerId.set(row.playerId, {
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

  for (const impactLine of impactLines) {
    if (!isRecord(impactLine)) {
      continue;
    }

    const playerId = toOptionalString(impactLine["playerId"]);
    const playerName =
      toOptionalString(impactLine["playerName"]) ?? (playerId ? playerNameById.get(playerId) ?? null : null) ?? "Player";
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

    const candidate = {
      playerId,
      playerName,
      deltaVnd,
      beforeVnd:
        toOptionalNumber(impactLine["debtBeforeVnd"]) ??
        (playerId ? combinedSnapshotByPlayerId.get(playerId)?.beforeVnd ?? null : null),
      afterVnd:
        toOptionalNumber(impactLine["debtAfterVnd"]) ??
        (playerId ? combinedSnapshotByPlayerId.get(playerId)?.afterVnd ?? null : null)
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
    const candidate = {
      playerId: impact.playerId ?? null,
      playerName: impact.playerName ?? "Player",
      deltaVnd: resolvePlayerImpactDelta(impact),
      beforeVnd:
        toOptionalNumber(impact.debtBeforeVnd) ??
        (impact.playerId ? combinedSnapshotByPlayerId.get(impact.playerId)?.beforeVnd ?? null : null),
      afterVnd:
        toOptionalNumber(impact.debtAfterVnd) ??
        (impact.playerId ? combinedSnapshotByPlayerId.get(impact.playerId)?.afterVnd ?? null : null)
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
    .filter((row) => getCombinedRowDelta(row) !== 0)
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      deltaVnd: getCombinedRowDelta(row),
      beforeVnd: getCombinedRowCumulative(row) - getCombinedRowDelta(row),
      afterVnd: getCombinedRowCumulative(row)
    }))
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

  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => {
        const itemType = normalizeHistoryItemType(item);
        const itemAmount = typeof item.amountVnd === "number" ? item.amountVnd : null;
        const clickable = itemType === "MATCH" && Boolean(item.matchId);
        const hasMatchRows = itemType === "MATCH" && Array.isArray(item.matchRows) && item.matchRows.length > 0;
        const sortedMatchRows = hasMatchRows ? sortMatchRows(item.matchRows ?? []) : [];
        const advanceNoteTag = itemType === "ADVANCE" ? item.note?.trim() ?? null : null;
        const advanceDetailRows = itemType === "ADVANCE" ? buildAdvanceDetailRows(item) : [];
        const resetLabel = itemType === "ADVANCE" ? toResetLabel(item) : null;
        const canResetAdvance = itemType === "ADVANCE" && item.eventStatus === "ACTIVE" && !!onRequestResetAdvance;
        const advanceHeadlineLabel =
          itemType === "ADVANCE" && itemAmount !== null ? `${item.playerName ?? "Player"}: ${formatVnd(Math.abs(itemAmount))}` : null;

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
                {item.reason ? <div className="text-xs text-slate-500">{item.reason}</div> : null}
                {itemType !== "ADVANCE" && item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
              </div>
              {itemAmount !== null && itemType !== "ADVANCE" ? (
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

                  return (
                    <div key={`${item.id}-${row.playerId}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
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
                  const afterVnd = row.afterVnd ?? row.deltaVnd;
                  const beforeVnd = row.beforeVnd ?? (afterVnd - row.deltaVnd);
                  const isCombinedMode = debtViewMode === "combined";
                  const headlineVnd = isCombinedMode ? afterVnd : row.deltaVnd;
                  return (
                    <div key={`${item.id}-advance-${row.playerId ?? index}`} className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs font-medium text-slate-800">{row.playerName}</div>
                        <div className={`text-sm font-semibold ${getAmountClassName(headlineVnd)}`}>
                          {formatSignedAmount(headlineVnd)}
                        </div>
                      </div>
                      {viewMode === "detail" && isCombinedMode ? (
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
