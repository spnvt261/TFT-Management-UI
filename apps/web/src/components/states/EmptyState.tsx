import { Button } from "antd";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
    <h3 className="text-base font-semibold text-slate-700">{title}</h3>
    {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
    {actionLabel && onAction ? (
      <Button className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);
