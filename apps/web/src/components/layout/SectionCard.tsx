import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const SectionCard = ({ title, description, actions, children, className, bodyClassName }: SectionCardProps) => {
  return (
    <section className={cn("rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm", className)}>
      {title || actions || description ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 lg:px-5">
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-900 lg:text-base">{title}</h3> : null}
            {description ? <p className="mt-1 text-xs text-slate-500 lg:text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn("px-4 py-4 lg:px-5 lg:py-5", bodyClassName)}>{children}</div>
    </section>
  );
};
