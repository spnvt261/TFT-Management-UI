import { Tag } from "antd";
import { cn } from "@/lib/cn";

const HISTORY_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  MATCH: { label: "Match", color: "blue" },
  DEBT_SETTLEMENT: { label: "Debt Settlement", color: "gold" },
  ADVANCE: { label: "Advance", color: "purple" },
  NOTE: { label: "Note", color: "default" },
  CONTRIBUTION: { label: "Contribution", color: "green" },
  WITHDRAWAL: { label: "Withdrawal", color: "red" },
  ADJUSTMENT_IN: { label: "Adjustment In", color: "cyan" },
  ADJUSTMENT_OUT: { label: "Adjustment Out", color: "volcano" },
  FUND_ADVANCE: { label: "Fund Advance", color: "magenta" }
};

interface HistoryItemTypeBadgeProps {
  type: string;
  className?: string;
}

export const HistoryItemTypeBadge = ({ type, className }: HistoryItemTypeBadgeProps) => {
  const style = HISTORY_TYPE_STYLES[type] ?? { label: type, color: "default" };

  return (
    <Tag color={style.color} className={cn("!text-[11px]", className)}>
      {style.label}
    </Tag>
  );
};
