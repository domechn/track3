import type { SubscriptionInfo } from "@/middlelayers/license";
import { Progress } from "@/components/ui/progress";

export function ProUsageRows({ usage, t, locale }: {
  usage?: SubscriptionInfo["usage"];
  t: (key: string) => string;
  locale: string;
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
        <Progress value={Math.min(row.used, row.limit)} max={row.limit}
          className="bg-muted-foreground/25"
          aria-label={t(`system.usage.${resource}`)}
          indicatorClassName={row.used >= row.limit ? "bg-destructive" : undefined} />
        {Number.isFinite(date.getTime()) && <p className="text-xs text-muted-foreground">
          {t("system.usage.resetsOn").replace("{date}", date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
            year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
          }))}
        </p>}
      </div>;
    })}
  </div>;
}
