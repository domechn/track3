import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import type { Locale } from "@/i18n";

function lastGoodTime(timestamp: string, locale: Locale): string {
  const date = new Date(timestamp);
  const language = locale === "zh" ? "zh-CN" : "en-US";
  const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" })} ${time}`;
}

export function WalletStatusBanner({ statuses, locale, t }: {
  statuses: PortfolioSourceStatus[];
  locale: Locale;
  t: (key: string) => string;
}) {
  const failures = statuses.filter((status) => status.status === "failed");
  if (!failures.length) return null;
  return <div className="analyze-wallet-failures" role="alert">
    {failures.map((source) => <div key={source.sourceId} className="analyze-wallet-failure">
      <strong>{t("wallets.refreshFailed").replace("{source}", source.label)}</strong>
      <span>{t(`wallets.failure.${source.category ?? "other"}`)}</span>
      {source.lastSuccessAt && <span>{t("wallets.lastGood").replace("{time}",
        lastGoodTime(source.lastSuccessAt, locale))}</span>}
    </div>)}
  </div>;
}
