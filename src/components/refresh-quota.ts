import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { LicenseCenter } from "@/middlelayers/license";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

export function useRefreshQuota(source?: PortfolioSourceStatus, refreshing = false) {
  const { locale } = useTranslation();
  const [quota, setQuota] = useState<{ sourceId: string; used: number; limit: number; periodEnd: string; resource: string }>();
  const sourceId = source?.category === "quota" ? source.sourceId : "";
  useEffect(() => {
    if (!sourceId || refreshing) return;
    const resource = sourceId.startsWith("erc20:") ? "erc20" : sourceId.startsWith("trc20:") ? "tron" : null;
    if (!resource) return;
    let active = true;
    void LicenseCenter.getInstance().getUsage().then((usage) => {
      const entry = usage?.usage[resource];
      if (active && usage?.enforced && entry && Number.isFinite(Date.parse(entry.periodEnd))) {
        setQuota({ sourceId, used: entry.used, limit: entry.limit, periodEnd: entry.periodEnd,
          resource: resource === "erc20" ? "ERC20" : "TRON" });
      }
    });
    return () => { active = false; };
  }, [sourceId, refreshing]);
  if (!quota || quota.sourceId !== sourceId) return;
  return {
    ...quota,
    date: new Date(quota.periodEnd).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
      day: "numeric", month: "short", timeZone: "UTC",
    }),
  };
}
