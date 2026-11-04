import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import type { View } from "@/mobile/components/overview-fidelity";
import { buildAssetDetailsPath } from "@/utils/assets";
import { currencyWrapper } from "@/utils/currency";
import { useTranslation } from "@/mobile/i18n";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "@/mobile/components/ui/alert-dialog";
import { chartTicks } from "@/mobile/components/partial-chart-scale";
import SourceMark from "@/mobile/components/source-mark";
import "@/mobile/components/mobile/fidelity.css";

const amount = (value: number, currency: CurrencyRateDetail) => `${currency.symbol}${currencyWrapper(currency)(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clock = (at?: string) => at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at)) : "—";
const date = (at?: string) => at ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(at)) : "—";

export default function PartialOverviewFidelity({ view, statuses, currency, quoteColor, onRefresh, withLastKnown, setWithLastKnown }: {
  view: View; statuses: PortfolioSourceStatus[]; currency: CurrencyRateDetail; quoteColor: QuoteColor;
  onRefresh?: () => void | Promise<void>;
  withLastKnown: boolean; setWithLastKnown: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const missing = view.latest?.partial?.missing ?? [];
  const failed = missing[0];
  const provider = failed?.provider ?? t("fidelity.refresh.source");
  const failedStatus = statuses.find((status) => status.provider === provider || status.label === provider);
  const isQuota = failed?.category === "quota" || failedStatus?.category === "quota";
  const missingWallets = new Set(missing.map((source) => source.wallet));
  const excludedValue = (view.excluded ?? []).reduce((sum, source) => sum + source.value, 0);
  const total = view.currentTotal - (withLastKnown ? 0 : excludedValue);
  const sourceValues = new Map<string, number>();
  const bySymbol = new Map<string, { symbol: string; assetType: string; amount: number; value: number; missing: boolean }>();
  const excludedAssets: Array<{ symbol: string; amount: number; value: number }> = [];
  for (const asset of view.latest?.assets ?? []) {
    const wallet = asset.wallet ?? "";
    sourceValues.set(wallet, (sourceValues.get(wallet) ?? 0) + asset.value);
    if (missingWallets.has(wallet)) excludedAssets.push({ symbol: asset.symbol, amount: asset.amount, value: asset.value });
    const key = `${asset.assetType}:${asset.symbol}`;
    const row = bySymbol.get(key) ?? { symbol: asset.symbol, assetType: asset.assetType, amount: 0, value: 0, missing: true };
    if (!missingWallets.has(wallet) || withLastKnown) {
      row.amount += asset.amount;
      row.value += asset.value;
      row.missing = false;
    }
    bySymbol.set(key, row);
  }
  excludedAssets.sort((a, b) =>
    Number(a.symbol === "USDT" || a.symbol === "USDC") - Number(b.symbol === "USDT" || b.symbol === "USDC")
    || b.value - a.value);
  const holdings = [...bySymbol.values()].sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));
  const orderedSources = [...sourceValues].sort((a, b) => b[1] - a[1]);
  const latestComplete = view.points.at(-1);
  const series = view.points.slice(-30);
  const values = series.map((point) => currencyWrapper(currency)(point.totalValue));
  const ticks = chartTicks(values);
  const min = ticks[0];
  const max = ticks.at(-1) ?? min + 1;
  const x = (index: number) => 44 + index / Math.max(1, series.length - 1) * 275;
  const y = (value: number) => 154 - (value - min) / Math.max(1, max - min) * 135;
  const labels = [0, 10, 20, series.length - 1];
  const reason = isQuota ? t("fidelity.refresh.quotaReason") : failedStatus?.detail === "Source timed out"
    ? t("fidelity.refresh.timeout") : t("fidelity.refresh.failedReason");
  const onRetry = () => void onRefresh?.();
  return <section className="fd-page fd-partial-overview" data-quote-color={quoteColor} data-quota={isQuota}>
    <header className="fd-partial-head"><h1>{t("nav.overview")}</h1>
      <button type="button" className="fd-partial-summary" onClick={() => setStatusSheetOpen(true)}>{t("fidelity.refresh.partialSummary").replace("{time}", clock(failedStatus?.finishedAt ?? view.latest?.createdAt)).replace("{count}", String(statuses.length - missing.length)).replace("{total}", String(statuses.length))}<span className="sr-only"> · {t("refresh.sourceStatus")}</span></button>
      <div className="fd-range" role="radiogroup" aria-label={t("overview.chartRange")}>{["1D", "7D", "30D", "90D", "1Y", "All"].map((range) =>
        <button key={range} type="button" role="radio" aria-checked={range === "30D"} disabled>{range}</button>)}</div>
      <button type="button" className="fd-partial-refresh" onClick={onRetry}><ReloadIcon aria-hidden="true" />{t("common.refresh")}</button>
    </header>
    <div className="fd-partial-banner" data-quota={isQuota} role="alert"><ExclamationTriangleIcon aria-hidden="true" /><div>
      <b>{t(isQuota ? "fidelity.refresh.quotaTitle" : "fidelity.refresh.failedTitle").replaceAll("{source}", provider).replace("{ok}", String(statuses.length - missing.length)).replace("{all}", String(statuses.length))}</b>
      <p>{isQuota ? t("fidelity.refresh.quotaDetails") : t("fidelity.refresh.failedDetails").replace("{reason}", reason).replace("{source}", provider)
        .replace("{date}", date(failed?.lastSuccessAt)).replace("{time}", clock(failed?.lastSuccessAt))
        .replace("{value}", amount(excludedValue, currency))}</p>
      <div className="fd-partial-actions">{isQuota ? <Link to="/settings/systemInfo">{t("fidelity.refresh.seeUsage")}</Link> : <button type="button" onClick={onRetry}>{t("refresh.retryButton")}</button>}
        <button type="button" onClick={() => setWithLastKnown(!withLastKnown)}>{t(withLastKnown ? "fidelity.refresh.excludeLastKnown" : "refresh.useLastKnown")}</button></div>
    </div></div>
    <main className="fd-partial-grid">
      <section className="fd-card fd-partial-hero"><div className="fd-card-heading"><h3>{t("fidelity.firstRun.portfolioValue")}</h3><span>{currency.currency} · {t("fidelity.refresh.completeSnapshots")}</span></div>
        <span className="fd-label">{t(withLastKnown ? "fidelity.refresh.withLastKnown" : "fidelity.refresh.totalExcluding").replace("{source}", provider)}</span>
        <strong className="fd-partial-total">{amount(total, currency)}</strong><span className="fd-partial-pill">{t("history.partial.label")}</span>
        <span className="fd-sub">{provider} {t("fidelity.refresh.lastKnown")} {amount(excludedValue, currency)}</span>
        <div className="fd-partial-kpis">{["fidelity.firstRun.today", "fidelity.overview.sevenDays", "fidelity.overview.thirtyDays"].map((key) =>
          <div key={key}><span>{t(key)}</span><b>—</b><small>{t("fidelity.refresh.incomplete")}</small></div>)}</div>
        {series.length > 1 && <svg className="fd-partial-chart" viewBox="0 0 324 170" role="img" aria-label={t("fidelity.refresh.completeChart")}>
          {ticks.map((tick) => <g key={tick}><line x1="44" x2="324" y1={y(tick)} y2={y(tick)} /><text x="36" y={y(tick) + 4} textAnchor="end">{tick >= 1000 ? `${tick / 1000}K` : tick}</text></g>)}
          <path d={values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ")} />
          {labels.filter((index) => series[index]).map((index) => <text key={index} x={x(index)} y="167" textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}>{date(new Date(series[index].timestamp).toISOString())}</text>)}
        </svg>}
        <p className="fd-partial-note">{t("fidelity.refresh.chartNote").replace("{source}", provider).replace("{date}", date(latestComplete ? new Date(latestComplete.timestamp).toISOString() : undefined)).replace("{value}", amount(latestComplete?.totalValue ?? 0, currency))}</p>
      </section>
      <section className="fd-card fd-partial-sources"><div className="fd-card-heading"><h3>{t("overview.design.sources")}</h3><span>{t("fidelity.refresh.sourcesCount").replace("{count}", String(orderedSources.length))}</span></div>
        <div className="fd-partial-source-list">{orderedSources.map(([wallet, value]) => {
          const label = view.sourceLabels[wallet] ?? wallet;
          const isMissing = missingWallets.has(wallet);
          const status = statuses.find((item) => item.label === label || item.provider === label);
          return <div className="fd-partial-source" key={wallet}><SourceMark initialsOnly source={{ ...(view.sources.find((source) => source.label === label) ?? { sourceId: "", label }), kind: status?.kind, provider: status?.provider }} />
            <div><b>{label}</b><small data-tone={isMissing ? isQuota ? "warning" : "loss" : "neutral"}>{isMissing ? <ExclamationTriangleIcon className="fd-partial-source-status-icon" aria-hidden="true" /> : <CheckIcon className="fd-partial-source-status-icon" aria-hidden="true" />}{isMissing
              ? t(isQuota ? "fidelity.refresh.quotaUsed" : "fidelity.refresh.failedLastGood").replace("{date}", date(failed?.lastSuccessAt)).replace("{time}", clock(failed?.lastSuccessAt))
              : t("fidelity.wallets.refreshed").replace("{time}", clock(status?.lastSuccessAt))}</small></div>
            <div><strong>{amount(value, currency)}</strong><small>{isMissing ? t("fidelity.refresh.lastKnown") : total ? `${(value / total * 100).toFixed(1)}%` : "—"}</small></div>
          </div>;
        })}</div><div className="fd-partial-source-footer"><i />{t("fidelity.refresh.countRefreshed").replace("{ok}", String(orderedSources.length - missing.length)).replace("{all}", String(orderedSources.length)).replace("{time}", clock(failedStatus?.finishedAt ?? view.latest?.createdAt))}</div>
      </section>
      <section className="fd-card fd-partial-holdings"><div className="fd-card-heading"><h3>{t("overview.design.holdings")}</h3><span>{t("fidelity.refresh.holdingsCount").replace("{count}", String(holdings.length)).replace("{source}", provider)}</span></div>
        <div className="fd-partial-table"><div className="fd-partial-table-head"><span>{t("fidelity.loading.asset")}</span><span>{t("fidelity.loading.value")}</span><span>7D</span></div>
          {holdings.map((asset) => <Link key={`${asset.assetType}:${asset.symbol}`} to={buildAssetDetailsPath({ symbol: asset.symbol, assetType: asset.assetType as "crypto" | "stock" })}>
            <span><b>{asset.symbol}</b><small>{asset.missing ? t("fidelity.refresh.onlyIn").replace("{source}", provider) : total ? `${(asset.value / total * 100).toFixed(1)}%` : "—"}</small></span>
            <span>{asset.missing ? "—" : amount(asset.value, currency)}</span><span>—</span>
          </Link>)}</div>
      </section>
      <section className="fd-card fd-partial-left-out" style={{ height: "auto", minHeight: `${296 + Math.max(0, excludedAssets.length - 1) * 44}px` }}><div className="fd-card-heading"><h3>{t("fidelity.refresh.leftOut").replace("{source}", provider)}</h3><span>{t("fidelity.refresh.lastKnown")}</span></div>
        {excludedAssets.map((asset) => <div className="fd-partial-left-row" key={asset.symbol}><span><b>{asset.symbol}</b> <small>{asset.amount.toLocaleString("en-US", { minimumFractionDigits: asset.symbol === "USDT" || asset.symbol === "USDC" ? 2 : 0, maximumFractionDigits: 4 })}</small></span><strong>{amount(asset.value, currency)}</strong></div>)}
        <div className="fd-partial-left-row"><span>{t("fidelity.refresh.lastKnownTotal")}</span><strong>{amount(excludedValue, currency)}</strong></div>
        <p>{t("fidelity.refresh.asOf").replace("{date}", date(failed?.lastSuccessAt)).replace("{time}", clock(failed?.lastSuccessAt))}</p>
        <div className="fd-partial-left-summary"><div><span>{t("fidelity.refresh.totalExcludingShort").replace("{source}", provider)}</span><strong>{amount(view.currentTotal - excludedValue, currency)}</strong></div>
          <div><span>{t("fidelity.refresh.withLastKnown").replace("{source}", provider)}</span><strong>{amount(view.currentTotal, currency)}</strong></div></div>
      </section>
    </main>
    <AlertDialog open={statusSheetOpen} onOpenChange={setStatusSheetOpen}>
      <AlertDialogContent className="fd-partial-status" data-quota={isQuota} overlayProps={{ className: "fd-partial-status-overlay" }}>
        <AlertDialogTitle className="sr-only">{t("refresh.sourceStatus")}</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">{t(isQuota ? "fidelity.refresh.quotaFinishedMeta" : "fidelity.refresh.finishedMeta").replace("{ok}", String(orderedSources.length - missing.length)).replace("{all}", String(orderedSources.length)).replace("{failed}", String(missing.length))}</AlertDialogDescription>
        <div className="fd-partial-status-handle" aria-hidden="true" />
        <div className="fd-partial-status-head"><h2>{t("fidelity.refresh.finished")}</h2>
          <span>{t(isQuota ? "fidelity.refresh.quotaFinishedMeta" : "fidelity.refresh.finishedMeta").replace("{ok}", String(orderedSources.length - missing.length)).replace("{all}", String(orderedSources.length)).replace("{failed}", String(missing.length))}</span></div>
        <div className="fd-partial-progress"><i /></div>
        <div className="fd-partial-status-list">{orderedSources.map(([wallet]) => {
          const label = view.sourceLabels[wallet] ?? wallet;
          const isMissing = missingWallets.has(wallet);
          const status = statuses.find((item) => item.label === label || item.provider === label);
          const duration = status?.startedAt && status.finishedAt
            ? `${((Date.parse(status.finishedAt) - Date.parse(status.startedAt)) / 1000).toFixed(1)} s` : null;
          return <div className="fd-partial-status-row" data-failed={isMissing} key={wallet}>
            <SourceMark className="fd-partial-status-logo" initialsOnly source={{ ...(view.sources.find((source) => source.label === label) ?? { sourceId: "", label }), kind: status?.kind, provider: status?.provider }} />
            <div><b>{label}</b><small data-tone={isMissing ? isQuota ? "warning" : "loss" : "gain"}>{isMissing ? <ExclamationTriangleIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
              {isMissing ? reason : t("fidelity.refresh.doneIn").replace("{duration}", duration ?? "—")}</small></div>
            {isMissing && (isQuota ? <Link to="/settings/systemInfo">{t("fidelity.refresh.seeUsage")}</Link> : <button type="button" onClick={onRetry}>{t("refresh.retryButton")}</button>)}
          </div>;
        })}</div>
        <div className="fd-partial-status-buttons">{!isQuota && <button type="button" onClick={onRetry}>{t("fidelity.refresh.retryFailed")}</button>}
          <button type="button" onClick={() => setStatusSheetOpen(false)}>{t("common.close")}</button></div>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
