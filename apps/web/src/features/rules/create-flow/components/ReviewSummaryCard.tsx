import type { ReactNode } from "react";
import { Tag } from "antd";
import type { ModuleType } from "@/types/api";
import { SectionCard } from "@/components/layout/SectionCard";

interface ReviewSummaryRow {
  label: string;
  value: ReactNode;
}

interface ReviewSummaryCardProps {
  module: ModuleType;
  isDefault: boolean;
  rows: ReviewSummaryRow[];
  title?: string;
  description?: string;
  footer?: ReactNode;
}

export const ReviewSummaryCard = ({
  module,
  isDefault,
  rows,
  title = "Review and Submit",
  description = "Final check before creating this rule",
  footer
}: ReviewSummaryCardProps) => (
  <SectionCard title={title} description={description}>
    <div className="space-y-3 text-sm text-slate-700">
      <div className="flex flex-wrap gap-2">
        <Tag color="blue">Module: {module}</Tag>
        <Tag color={isDefault ? "processing" : "default"}>{isDefault ? "Default" : "Non-default"}</Tag>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[150px_1fr] gap-2">
            <div className="text-slate-500">{row.label}</div>
            <div>{row.value}</div>
          </div>
        ))}
      </div>
    </div>

    {footer ? <div className="mt-4 border-t border-slate-100 pt-4">{footer}</div> : null}
  </SectionCard>
);
