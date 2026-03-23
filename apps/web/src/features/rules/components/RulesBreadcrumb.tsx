import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface RulesBreadcrumbItem {
  label: string;
  to?: string;
}

interface RulesBreadcrumbProps {
  items: RulesBreadcrumbItem[];
  className?: string;
}

export const RulesBreadcrumb = ({ items, className }: RulesBreadcrumbProps) => {
  if (!items.length) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 sm:text-sm", className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
            {item.to && !isLast ? (
              <Link to={item.to} className="truncate text-slate-500 transition hover:text-slate-700">
                {item.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast ? "font-medium text-slate-700" : "text-slate-500")}>
                {item.label}
              </span>
            )}
            {!isLast ? <span className="text-slate-300">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
};
