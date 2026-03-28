import { EmptyState } from "@/components/states/EmptyState";
import { HistoryItemTypeBadge } from "@/components/common/HistoryItemTypeBadge";
import { formatDateTime, formatVnd } from "@/lib/format";
import type { GroupFundHistoryItemDto } from "@/types/api";

export type GroupFundHistoryViewMode = "minimal" | "detail";

export interface GroupFundHistoryFeedItem extends GroupFundHistoryItemDto {
  matchTitle?: string | null;
}

interface GroupFundHistoryFeedProps {
  items: GroupFundHistoryFeedItem[];
  viewMode: GroupFundHistoryViewMode;
  onOpenMatch: (matchId: string) => void;
}

const getAmountColorClass = (value: number) => {
  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
};

const formatSignedAmount = (value: number) => (value > 0 ? `+${formatVnd(value)}` : formatVnd(value));

const resolveItemTitle = (item: GroupFundHistoryFeedItem) => {
  if (item.itemType === "MATCH") {
    return item.matchTitle ?? "Match";
  }

  return item.actorName ?? item.playerName ?? "System";
};

export const GroupFundHistoryFeed = ({ items, viewMode, onOpenMatch }: GroupFundHistoryFeedProps) => {
  if (items.length === 0) {
    return <EmptyState title="No fund history yet" description="Create matches or transactions to build fund history." />;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const clickable = Boolean(item.matchId);
        const amountVnd = typeof item.amountVnd === "number" ? item.amountVnd : null;

        return (
          <button
            key={item.id}
            className={`focus-ring w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition ${
              clickable ? "hover:border-brand-500" : "cursor-default"
            }`}
            onClick={() => {
              if (item.matchId) {
                onOpenMatch(item.matchId);
              }
            }}
            disabled={!clickable}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <HistoryItemTypeBadge type={item.itemType} />
                <span className="text-sm font-semibold text-slate-900">{resolveItemTitle(item)}</span>
              </div>
              <div className="text-xs font-medium text-slate-600">{formatDateTime(item.postedAt)}</div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                {item.reason ? <div className="text-xs text-slate-500">{item.reason}</div> : null}
                {item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
                {typeof item.fundInVnd === "number" || typeof item.fundOutVnd === "number" ? (
                  <div className="text-xs text-slate-500">{`Fund in ${formatVnd(item.fundInVnd ?? 0)} | Fund out ${formatVnd(item.fundOutVnd ?? 0)}`}</div>
                ) : null}
              </div>
              {amountVnd !== null ? <div className={`text-sm font-semibold ${getAmountColorClass(amountVnd)}`}>{formatSignedAmount(amountVnd)}</div> : null}
            </div>

            {typeof item.balanceBeforeVnd === "number" || typeof item.balanceAfterVnd === "number" ? (
              <div className="mt-1 text-[11px] text-slate-500">{`Balance ${formatVnd(item.balanceBeforeVnd ?? 0)} -> ${formatVnd(item.balanceAfterVnd ?? 0)}`}</div>
            ) : null}

            {viewMode === "detail" && item.transactionType ? (
              <div className="mt-1 text-[11px] text-slate-500">{`Transaction type: ${item.transactionType}`}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
