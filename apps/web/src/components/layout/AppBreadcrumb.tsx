import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface AppBreadcrumbItem {
  label: string;
  to?: string;
}

interface AppBreadcrumbProps {
  items: AppBreadcrumbItem[];
  className?: string;
}

export const AppBreadcrumb = ({ items, className }: AppBreadcrumbProps) => {
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
