import type { SubscriptionInfo } from "@/middlelayers/license";

export function ProUsageRows({ usage, t }: {
  usage?: SubscriptionInfo["usage"];
  t: (key: string) => string;
}) {
  if (!usage) return null;
  return <div className="mt-4 space-y-4">
    {(["erc20", "tron"] as const).map((resource) => {
      const row = usage[resource];
      if (!row) return null;
      const date = new Date(row.periodEnd);
      return <div key={resource} className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <span>{t(`system.usage.${resource}`)}</span>
          <span>{row.used} / {row.limit}</span>
        </div>
        <div role="progressbar" aria-label={t(`system.usage.${resource}`)}
          aria-valuenow={Math.min(row.used, row.limit)} aria-valuemin={0} aria-valuemax={row.limit}
          className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, row.limit > 0 ? row.used / row.limit * 100 : 0))}%` }} />
        </div>
        {Number.isFinite(date.getTime()) && <p className="text-xs text-muted-foreground">
          {t("system.usage.resetsOn").replace("{date}", date.toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
          }))}
        </p>}
      </div>;
    })}
  </div>;
}
