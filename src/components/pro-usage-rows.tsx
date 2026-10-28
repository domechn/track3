import type { SubscriptionInfo } from "@/middlelayers/license";
import { Progress } from "@/components/ui/progress";

export function ProUsageRows({ usage, enforced, t, locale }: {
  usage?: SubscriptionInfo["usage"];
  enforced?: boolean;
  t: (key: string) => string;
  locale: string;
}) {
  if (!usage) return null;
  const resetEnd = usage.erc20?.periodEnd ?? usage.tron?.periodEnd;
  const resetDate = resetEnd ? new Date(resetEnd) : null;
  return <div className="grid sm:grid-cols-2">
    {(["erc20", "tron"] as const).map((resource) => {
      const row = usage[resource];
      if (!row) return null;
      return <div key={resource} className="min-w-0 space-y-3 p-6 text-sm [&+&]:border-t sm:[&+&]:border-l sm:[&+&]:border-t-0">
        <div>
          <p>{t(`system.usage.${resource}`)}</p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight">{row.used}{" "}<span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">/ {row.limit}</span></p>
        </div>
        <Progress value={Math.min(row.used, row.limit)} max={row.limit || undefined} minimumFill
          className="h-2 bg-muted-foreground/15"
          aria-label={t(`system.usage.${resource}`)}
          indicatorClassName={enforced && row.limit > 0 && row.used >= row.limit ? "bg-destructive" : undefined} />
      </div>;
    })}
    <p className="col-span-full px-6 pb-5 text-xs text-muted-foreground">
      {resetDate && Number.isFinite(resetDate.getTime()) && <>{t("system.usage.resetsOn").replace("{date}", resetDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
      }))}{locale === "zh" ? "" : " "}</>}
      {t("system.usage.countNote")}
    </p>
  </div>;
}
