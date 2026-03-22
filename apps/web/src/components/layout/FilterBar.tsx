import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export const FilterBar = ({ children, className }: FilterBarProps) => {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur lg:p-4",
        className
      )}
    >
      {children}
    </section>
  );
};
