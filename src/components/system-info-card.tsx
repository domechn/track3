import type { ReactNode } from "react";
import type { SubscriptionInfo } from "@/middlelayers/license";
import { Card } from "@/components/ui/card";

type Translate = (key: string) => string;

export function subscriptionSummary(info: SubscriptionInfo, t: Translate, locale: string, now = Date.now()) {
  const plan = info.planType ? t(info.planType === "monthly" ? "system.monthly" : "system.yearly") : null;
  const parts = plan ? [t("system.planSummary").replace("{plan}", plan)] : [];
  const end = info.currentPeriodEnd ? new Date(info.currentPeriodEnd) : null;
  if (end && Number.isFinite(end.getTime())) {
    const today = new Date(now);
    const date = end.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    });
    parts.push(t(info.cancelAtPeriodEnd ? "system.expires" : "system.renewsOn").replace("{date}", date));
    if (end.getTime() > now) {
      const days = (Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
        - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000;
      if (days > 0) parts.push(t(days === 1 ? "system.inDays.one" : "system.inDays.other").replace("{n}", String(days)));
    }
  }
  return parts.join(" · ");
}

export function SystemInfoCard({ title, headingLevel = 3, status, description, action, version, footerAction, children, t }: {
  title: string;
  headingLevel?: 2 | 3;
  status?: { label: string; value: string | null };
  description?: string;
  action?: ReactNode;
  version: string;
  footerAction?: ReactNode;
  children?: ReactNode;
  t: Translate;
}) {
  const tone = status?.value === "active" || status?.value === "trialing"
    ? "bg-green-500/10 text-green-700 dark:text-green-400"
    : status?.value === "past_due"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "bg-muted text-muted-foreground";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return <Card data-ui-card="" data-ui-system-card="" data-testid="system-info-card" className="overflow-hidden">
    <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Heading className="text-lg font-semibold tracking-tight">{title}</Heading>
          {status && <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {status.label}
          </span>}
        </div>
        {description && (description.includes(" · ")
          ? <p className="mt-1 flex flex-wrap gap-x-1 text-sm text-muted-foreground">
            {description.split(" · ").map((part, index) =>
              <span key={index} className="whitespace-nowrap">{index > 0 && "·\u00a0"}{part}</span>)}
          </p>
          : <p className="mt-1 text-sm text-muted-foreground">{description}</p>)}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children && <div data-system-card-body="" className="border-t">{children}</div>}
    <div data-system-card-footer="" className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-3.5">
      <p className="text-sm text-muted-foreground">
        Track3 <span className="font-semibold text-foreground">{version}</span> · {t("system.buildCurrent")}
      </p>
      {footerAction}
    </div>
  </Card>;
}
