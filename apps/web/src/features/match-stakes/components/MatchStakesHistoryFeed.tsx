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
  next.sort((left, right) => {
    const leftRank = getPlacementRank(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = getPlacementRank(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  return next;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const toOptionalString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null);
const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

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

type AdvanceDetailRow = {
  playerId: string | null;
  playerName: string;
  deltaVnd: number;
};

const isAdvanceDetailRow = (row: { playerId: string | null; playerName: string; deltaVnd: number | null }): row is AdvanceDetailRow =>
  typeof row.deltaVnd === "number";

const buildAdvanceDetailRows = (item: MatchStakesHistoryFeedItem): AdvanceDetailRow[] => {
  const rowsFromPlayerImpacts: AdvanceDetailRow[] = [];
  for (const impact of item.playerImpacts ?? []) {
    const candidate = {
      playerId: impact.playerId ?? null,
      playerName: impact.playerName ?? "Player",
      deltaVnd: resolvePlayerImpactDelta(impact)
    };

    if (!isAdvanceDetailRow(candidate) || candidate.deltaVnd === 0) {
      continue;
    }

    rowsFromPlayerImpacts.push(candidate);
  }

  if (rowsFromPlayerImpacts.length > 0) {
    return rowsFromPlayerImpacts;
  }

  if (!Array.isArray(item.matchRows)) {
    return [];
  }

  return item.matchRows
    .filter((row) => row.matchNetVnd !== 0)
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      deltaVnd: row.matchNetVnd
    }));
};

const getAdvanceMetadataDetails = (item: MatchStakesHistoryFeedItem) => {
  if (!isRecord(item.metadata)) {
    return null;
  }

  return isRecord(item.metadata.details) ? item.metadata.details : item.metadata;
};

const resolveAdvanceParticipantIds = (item: MatchStakesHistoryFeedItem) => {
  if (Array.isArray(item.participantPlayerIds) && item.participantPlayerIds.length > 0) {
    return item.participantPlayerIds;
  }

  const metadataDetails = getAdvanceMetadataDetails(item);
  return metadataDetails ? toStringArray(metadataDetails["participantPlayerIds"]) : [];
};

const resolveAdvanceParticipantSummary = (item: MatchStakesHistoryFeedItem) => {
  const participantIds = resolveAdvanceParticipantIds(item);

  const candidateNames = new Set<string>();
  for (const impact of item.playerImpacts ?? []) {
    if (impact.playerName) {
      candidateNames.add(impact.playerName);
    }
  }

  const metadataDetails = getAdvanceMetadataDetails(item);
  const impactLines = metadataDetails?.["impactLines"];
  if (Array.isArray(impactLines)) {
    for (const line of impactLines) {
      if (!isRecord(line)) {
        continue;
      }

      const playerName = toOptionalString(line["playerName"]);
      if (playerName) {
        candidateNames.add(playerName);
      }
    }
  }

  if (candidateNames.size > 0) {
    return `Participants: ${Array.from(candidateNames).join(", ")}`;
  }

  if (participantIds.length > 0) {
    return `Participants: ${participantIds.length}`;
  }

  return null;
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

export const MatchStakesHistoryFeed = ({
  items,
  viewMode,
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
        const participantSummary = itemType === "ADVANCE" ? resolveAdvanceParticipantSummary(item) : null;
        const resetLabel = itemType === "ADVANCE" ? toResetLabel(item) : null;
        const canResetAdvance = itemType === "ADVANCE" && item.eventStatus === "ACTIVE" && !!onRequestResetAdvance;

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
              <div className="flex flex-wrap items-center gap-1.5">
                {itemType === "MATCH" ? (
                  <>
                    <Tag color="blue" className="!text-[11px]">
                      {getMatchPrimaryTag(item)}
                    </Tag>
                    <Tag color="geekblue" className="!text-[11px]">
                      TFT
                    </Tag>
                  </>
                ) : itemType === "ADVANCE" ? (
                  <>
                    <Tag color="purple" className="!text-[11px]">
                      Advance
                    </Tag>
                    {advanceNoteTag ? <Tag className="!text-[11px]">{advanceNoteTag}</Tag> : null}
                    {item.eventStatus === "RESET" ? <Tag className="!text-[11px]">Reset</Tag> : null}
                  </>
                ) : itemType === "DEBT_SETTLEMENT" ? (
                  <Tag color="gold" className="!text-[11px]">
                    Debt settlement
                  </Tag>
                ) : (
                  <Tag className="!text-[11px]">Note</Tag>
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
                {itemType === "ADVANCE" ? <div className="text-sm font-semibold text-slate-900">{item.playerName ?? "Player"}</div> : null}
                {itemType === "ADVANCE" && participantSummary ? <div className="text-xs text-slate-500">{participantSummary}</div> : null}
                {itemType === "ADVANCE" && resetLabel ? <div className="text-xs text-rose-600">{resetLabel}</div> : null}
                {!hasMatchRows && itemType !== "ADVANCE" && item.playerName ? <div className="text-sm text-slate-700">{item.playerName}</div> : null}
                {item.reason ? <div className="text-xs text-slate-500">{item.reason}</div> : null}
                {itemType !== "ADVANCE" && item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
              </div>
              {itemAmount !== null ? (
                <div
                  className={
                    itemType === "ADVANCE"
                      ? "text-xl font-bold text-fuchsia-700"
                      : `text-sm font-semibold ${getAmountClassName(itemAmount)}`
                  }
                >
                  {itemType === "ADVANCE" ? formatVnd(Math.abs(itemAmount)) : formatSignedAmount(itemAmount)}
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
                  const debtBeforeVnd = row.cumulativeNetVnd - row.matchNetVnd;

                  return (
                    <div key={`${item.id}-${row.playerId}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs font-medium text-slate-800">{row.playerName}</div>
                        <div className={`text-sm font-semibold ${getAmountClassName(row.cumulativeNetVnd)}`}>
                          {formatSignedAmount(row.cumulativeNetVnd)}
                        </div>
                      </div>
                      {viewMode === "detail" ? (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <span className={getPlacementClassName(row)}>{getPlacementLabel(row)}</span>
                          <span className={getAmountClassName(row.matchNetVnd)}>{`Match: ${formatSignedAmount(row.matchNetVnd)}`}</span>
                          <span>{`Before match: ${formatSignedAmount(debtBeforeVnd)}`}</span>
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
                  const isReceive = row.deltaVnd > 0;
                  return (
                    <div key={`${item.id}-advance-${row.playerId ?? index}`} className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-slate-700">{row.playerName}</span>
                        <span className={isReceive ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                          {isReceive ? `+${formatVnd(row.deltaVnd)}` : `-${formatVnd(Math.abs(row.deltaVnd))}`}
                        </span>
                      </span>
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
