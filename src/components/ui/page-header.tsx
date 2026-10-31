import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ breadcrumb, title, description, actions, className }: {
  breadcrumb?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <header className={cn("mb-4 flex flex-wrap items-end gap-4", className)}>
    <div className="min-w-[260px] flex-1">
      {breadcrumb && <div className="mb-1 text-xs text-muted-foreground">{breadcrumb}</div>}
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight">{title}</h1>
      {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2.5">{actions}</div>}
  </header>;
}
