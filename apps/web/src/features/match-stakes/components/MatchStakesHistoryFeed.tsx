import { EmptyState } from "@/components/states/EmptyState";
import { HistoryItemTypeBadge } from "@/components/common/HistoryItemTypeBadge";
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
    return row.placementLabel;
  }

  const rank = getPlacementRank(row);
  return typeof rank === "number" ? `top${rank}` : "-";
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

const renderItemTitle = (item: MatchStakesHistoryFeedItem) => {
  if (item.itemType === "MATCH") {
    return item.label ?? (typeof item.matchNo === "number" ? `Match ${item.matchNo}` : "Match");
  }

  if (item.itemType === "DEBT_SETTLEMENT") {
    return "Debt settlement";
  }

  if (item.itemType === "ADVANCE") {
    return `${item.playerName ?? "Player"} advanced`;
  }

  return item.playerName ? `Note by ${item.playerName}` : "Note";
};

const hasMatchLink = (item: MatchStakesHistoryFeedItem) => Boolean(item.matchId);

export const MatchStakesHistoryFeed = ({
  items,
  viewMode,
  onOpenMatch,
  emptyTitle = "No history yet",
  emptyDescription = "Create matches or events to build history."
}: MatchStakesHistoryFeedProps) => {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const itemAmount = typeof item.amountVnd === "number" ? item.amountVnd : null;
        const clickable = hasMatchLink(item);
        const hasMatchRows = item.itemType === "MATCH" && Array.isArray(item.matchRows) && item.matchRows.length > 0;
        const sortedMatchRows = hasMatchRows ? sortMatchRows(item.matchRows ?? []) : [];

        return (
          <button
            key={item.id}
            className={`focus-ring w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition ${
              clickable ? "hover:border-brand-500" : "cursor-default"
            }`}
            onClick={() => {
              if (clickable) {
                onOpenMatch(item);
              }
            }}
            disabled={!clickable}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <HistoryItemTypeBadge type={item.itemType} />
                <span className="text-sm font-semibold text-slate-900">{renderItemTitle(item)}</span>
              </div>
              <div className="text-xs font-medium text-slate-600">{formatDateTime(item.postedAt)}</div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                {!hasMatchRows && item.playerName && item.itemType !== "ADVANCE" ? <div className="text-sm text-slate-700">{item.playerName}</div> : null}
                {item.reason ? <div className="text-xs text-slate-500">{item.reason}</div> : null}
                {item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
              </div>
              {itemAmount !== null ? <div className={`text-sm font-semibold ${getAmountClassName(itemAmount)}`}>{formatSignedAmount(itemAmount)}</div> : null}
            </div>

            {typeof item.balanceBeforeVnd === "number" || typeof item.balanceAfterVnd === "number" ? (
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
                        <div className={`text-xs font-semibold ${getAmountClassName(row.cumulativeNetVnd)}`}>
                          {formatSignedAmount(row.cumulativeNetVnd)}
                        </div>
                      </div>
                      {viewMode === "detail" ? (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <span>{`Placement: ${getPlacementLabel(row)}`}</span>
                          <span className={getAmountClassName(row.matchNetVnd)}>{`Match: ${formatSignedAmount(row.matchNetVnd)}`}</span>
                          <span>{`Before match: ${formatSignedAmount(debtBeforeVnd)}`}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {viewMode === "detail" && item.itemType === "DEBT_SETTLEMENT" && Array.isArray(item.settlementLines) ? (
              <div className="mt-2 space-y-1">
                {item.settlementLines.map((line, index) => (
                  <div key={`${item.id}-line-${index}`} className="text-[11px] text-slate-500">
                    {`${line.payerPlayerName} -> ${line.receiverPlayerName}: ${formatVnd(line.amountVnd)}`}
                  </div>
                ))}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
