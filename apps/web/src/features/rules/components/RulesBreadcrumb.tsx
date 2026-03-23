import { AppBreadcrumb, type AppBreadcrumbItem } from "@/components/layout/AppBreadcrumb";

export type RulesBreadcrumbItem = AppBreadcrumbItem;

interface RulesBreadcrumbProps {
  items: RulesBreadcrumbItem[];
  className?: string;
}

export const RulesBreadcrumb = ({ items, className }: RulesBreadcrumbProps) => (
  <AppBreadcrumb items={items} className={className} />
);
