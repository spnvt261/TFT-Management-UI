import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  valueClassName?: string;
}

export const MetricCard = ({ label, value, hint, valueClassName }: MetricCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm lg:p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold tracking-tight text-slate-900", valueClassName)}>{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
};
