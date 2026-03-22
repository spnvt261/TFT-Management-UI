import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide";
}

const sizeClasses: Record<NonNullable<PageContainerProps["size"]>, string> = {
  default: "max-w-[1280px]",
  wide: "max-w-[1420px]"
};

export const PageContainer = ({ children, className, size = "default" }: PageContainerProps) => {
  return <div className={cn("mx-auto w-full space-y-5 lg:space-y-6", sizeClasses[size], className)}>{children}</div>;
};
