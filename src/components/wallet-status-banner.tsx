import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import type { Locale } from "@/i18n";

function lastGoodTime(timestamp: string, locale: Locale): string {
  const date = new Date(timestamp);
  const language = locale === "zh" ? "zh-CN" : "en-US";
  const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", hour12: false });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" })} ${time}`;
}

export function WalletStatusBanner({ statuses, locale, t, nextBySource, stopped }: {
  statuses: PortfolioSourceStatus[];
  locale: Locale;
  t: (key: string) => string;
  nextBySource?: Record<string, number>;
  stopped?: boolean;
}) {
  const failures = statuses.filter((status) => (status.status === "failed" || status.status === "stale"));
  if (!failures.length) return null;
  return <div className="analyze-wallet-failures" role="alert">
    {failures.map((source) => <div key={source.sourceId} className="analyze-wallet-failure">
      <strong>{t("wallets.refreshFailed").replace("{source}", source.label)}</strong>
      <span>{t(`wallets.failure.${source.category ?? "other"}`)}</span>
      {nextBySource?.[source.sourceId] && <span>{t("refresh.autoRetry.next").replace("{time}",
        new Date(nextBySource[source.sourceId]).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US",
          { hour: "2-digit", minute: "2-digit", hour12: false }))}</span>}
      {stopped && !nextBySource?.[source.sourceId] && <span>{t("refresh.autoRetry.stopped")}</span>}
      {source.lastSuccessAt && <span>{t("wallets.lastGood").replace("{time}",
        lastGoodTime(source.lastSuccessAt, locale))}</span>}
    </div>)}
  </div>;
}
