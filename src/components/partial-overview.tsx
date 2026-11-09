import { useEffect, useState } from "react";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { AssetModel, CurrencyRateDetail, TDateRange } from "@/middlelayers/types";
import type { PortfolioSourceStatus, SourceKind } from "@/middlelayers/portfolio-baseline";
import { queryHistoricalDetail, queryHistoricalPage, queryPNLChartValue } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { redactSecrets } from "@/middlelayers/security/redact";
import { overviewRefreshRequestedEvent } from "./source-status-event";
import { chartBounds } from "./overview-chart-scale";
import { useRefreshQuota } from "./refresh-quota";
export { chartBounds } from "./overview-chart-scale";

type Point = { timestamp: number; totalValue: number };
type MissingSource = { wallet: string; kind: SourceKind; provider: string };
type PartialView = {
  at: string;
  sourcesTotal: number;
  lastGoodAt?: string;
  source: MissingSource;
  included: AssetModel[];
  lastGood: AssetModel[];
  points: Point[];
};

function matchingStatus(source: MissingSource, statuses: PortfolioSourceStatus[]) {
  const byLabel = statuses.find((status) => status.label === source.wallet && status.status !== "ok");
  if (byLabel) return byLabel;
  const byProvider = statuses.filter((status) => status.status !== "ok" &&
    status.kind === source.kind && status.provider?.toLowerCase() === source.provider.toLowerCase());
  return byProvider.length === 1 ? byProvider[0] : undefined;
}

export function resolvePartialSourceLabel(source: MissingSource, statuses: PortfolioSourceStatus[]) {
  return matchingStatus(source, statuses)?.label ?? redactSecrets(source.provider);
}

export function usePartialOverview(dateRange: TDateRange): PartialView | null {
  const version = useDataChangedVersion();
  const [view, setView] = useState<PartialView | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const latest = (await queryHistoricalPage({ start: new Date(0), end: dateRange.end }, 1, 0)).rows[0];
      if (!latest?.sourcesTotal) return null;
      const detail = await queryHistoricalDetail(latest.id);
      const missing = detail.partial?.missing;
      if (missing?.length !== 1) return null;
      const previous = (await queryHistoricalPage({
        start: new Date(0), end: new Date(new Date(latest.createdAt).getTime() - 1),
      }, 1, 0, "complete")).rows[0];
      const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.id, ...(previous ? [previous.id] : [])]);
      const missingWallets = new Set(missing.map((item) => item.wallet));
      const current = assets.filter((asset) => asset.uuid === latest.id);
      const points = await queryPNLChartValue({
        start: dateRange.start, end: new Date(new Date(latest.createdAt).getTime() - 1),
      });
      return {
        at: latest.createdAt,
        sourcesTotal: latest.sourcesTotal,
        lastGoodAt: previous?.createdAt,
        source: missing[0],
        included: current.filter((asset) => !missingWallets.has(asset.wallet ?? "")),
        lastGood: assets.filter((asset) => asset.uuid === previous?.id && missingWallets.has(asset.wallet ?? "")),
        points,
      };
    })().then((next) => { if (active) setView(next); })
      .catch(() => { if (active) setView(null); });
    return () => { active = false; };
  }, [dateRange.start, dateRange.end, version]);
  return view;
}

function groupAssets(assets: AssetModel[]) {
  const grouped = new Map<string, { symbol: string; amount: number; value: number }>();
  for (const asset of assets) {
    const row = grouped.get(asset.symbol) ?? { symbol: asset.symbol, amount: 0, value: 0 };
    row.amount += asset.amount;
    row.value += asset.value;
    grouped.set(asset.symbol, row);
  }
  return [...grouped.values()];
}

export default function PartialOverview({ view, statuses, currency, bannerOnly = false }: {
  view: PartialView;
  statuses: PortfolioSourceStatus[];
  currency: CurrencyRateDetail;
  bannerOnly?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [includeLastKnown, setIncludeLastKnown] = useState(false);
  const tag = locale === "zh" ? "zh-CN" : "en-GB";
  const money = (value: number) => `${currency.symbol}${currencyWrapper(currency)(value).toLocaleString(
    tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const at = (value?: string) => value ? new Date(value).toLocaleDateString(tag, { day: "numeric", month: "short" })
    + " " + new Date(value).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const time = (value?: string) => value ? new Date(value).toLocaleTimeString(tag, {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }) : "—";
  const date = (value?: string) => value ? new Date(value).toLocaleDateString(tag, {
    day: "numeric", month: "short",
  }) : "—";
  const failed = matchingStatus(view.source, statuses);
  const quota = useRefreshQuota(failed);
  const sourceLabel = resolvePartialSourceLabel(view.source, statuses);
  const completed = statuses.filter((status) => status.status === "ok").length;
  const totalSources = Math.max(view.sourcesTotal, statuses.length, completed + 1);
  const includedTotal = view.included.reduce((sum, asset) => sum + asset.value, 0);
  const lastGoodTotal = view.lastGood.reduce((sum, asset) => sum + asset.value, 0);
  const lastGoodValue = view.lastGoodAt ? money(lastGoodTotal) : "—";
  const included = groupAssets(view.included).sort((a, b) => b.value - a.value);
  const lastGood = groupAssets(view.lastGood).sort((a, b) => b.value - a.value);
  const holdings = [...included, ...lastGood.filter((row) => !included.some((other) => other.symbol === row.symbol))
    .map((row) => ({ ...row, amount: 0, value: 0 }))].sort((a, b) => b.value - a.value);
  const chartPoints = view.points.filter((point) => Number.isFinite(point.totalValue));
  const { low, high } = chartBounds(chartPoints);
  const path = chartPoints.map((point, index) =>
    `${index ? "L" : "M"}${index / Math.max(1, chartPoints.length - 1) * 900} ${200 - (point.totalValue - low) / Math.max(1, high - low) * 200}`).join(" ");
  const retry = () => window.dispatchEvent(new CustomEvent(overviewRefreshRequestedEvent, {
    detail: { sourceId: failed?.sourceId },
  }));

  const banner = <div className="t3-flow-banner" role="status">
      <ExclamationTriangleIcon aria-hidden="true" />
      <div><strong>{failed?.category === "quota"
        ? t("refresh.fidelity.quotaBanner").replaceAll("{source}", sourceLabel)
        : t("refresh.fidelity.failedBanner")
          .replaceAll("{source}", sourceLabel).replace("{count}", String(completed))
          .replace("{total}", String(totalSources))}</strong>
        <p>{failed?.category === "quota"
          ? <>{quota ? t("refresh.fidelity.quotaBannerDetail")
            .replace("{used}", String(quota.used)).replace("{limit}", String(quota.limit))
            .replace("{resource}", quota.resource).replace("{date}", quota.date)
            : t("refresh.fidelity.quotaReached")}
            {view.lastGoodAt && ` ${t("refresh.fidelity.quotaLastGood")
              .replace("{date}", at(view.lastGoodAt)).replace("{value}", lastGoodValue)}`}</>
          : view.lastGoodAt ? t("refresh.fidelity.partialReason")
          .replace("{reason}", redactSecrets(failed?.detail ?? t("overview.fidelity.refreshUnavailable")))
          .replace("{source}", sourceLabel).replace("{date}", at(view.lastGoodAt))
          .replace("{value}", lastGoodValue)
          : t("refresh.fidelity.noLastKnown").replace("{source}", sourceLabel)}</p></div>
      {failed?.category === "quota"
        ? <button type="button" onClick={() => { window.location.hash = "#/settings/systemInfo"; }}>
          {t("refresh.fidelity.managePlan")}</button>
        : <button type="button" onClick={retry}>{t("refresh.retryButton")}</button>}
      {!bannerOnly && <button type="button" onClick={() => setIncludeLastKnown(true)} disabled={!view.lastGoodAt}>{t("refresh.useLastKnown")}</button>}
    </div>;
  if (bannerOnly) return banner;

  return <div className="t3-refresh-overview">
    <header className="t3-flow-heading">
      <h1>{t("overview.h1")}</h1>
      <p>{t("refresh.fidelity.partialHeading")
        .replace("{time}", time(failed?.finishedAt ?? view.at))
        .replace("{count}", String(completed)).replace("{total}", String(totalSources))}</p>
    </header>
    {banner}
    <div className="t3-flow-grid">
      <section className="t3-flow-card t3-flow-hero">
        <header><h2>{t("firstrun.fidelity.portfolioValue")}</h2><span>{currency.currency} · {t("refresh.fidelity.completeSnapshots")}</span></header>
        <div className="t3-flow-kpis">
          <div><span>{t(includeLastKnown ? "refresh.fidelity.withLastKnown" : "refresh.fidelity.totalExcluding")
            .replace("{source}", sourceLabel)}</span>
            <strong className="t3-hero-value">{money(includeLastKnown ? includedTotal + lastGoodTotal : includedTotal)}</strong>
            <small className="t3-flow-partial-pill">{t("history.partial.label")}</small>
            <small>{t("refresh.fidelity.sourceLastKnown").replace("{source}", sourceLabel)
              .replace("{value}", lastGoodValue)}</small></div>
          {["today", "sevenDaysLong", "thirtyDays"].map((key) => <div key={key}>
            <span>{t(`overview.fidelity.${key}`)}</span><strong>—</strong>
            <small>{t("refresh.fidelity.incompleteValue")}</small>
          </div>)}
        </div>
        <div className="t3-flow-chart">
          <div className="t3-flow-chart-grid">{Array.from({ length: 5 }, (_, index) => <span key={index}>{Math.round((high - index * (high - low) / 4) / 1000)}K</span>)}</div>
          <svg role="img" aria-label={t("refresh.fidelity.chart")} viewBox="0 0 900 200" preserveAspectRatio="none"><path d={path} /></svg>
          <div className="t3-flow-chart-dates">{Array.from({ length: 7 }, (_, index) => {
            const point = chartPoints[Math.round(index * (chartPoints.length - 1) / 6)];
            return <span key={index}>{point ? date(new Date(point.timestamp).toISOString()) : ""}</span>;
          })}</div>
        </div>
        <p className="t3-flow-footnote">{t("refresh.fidelity.completeLine")
          .replace("{source}", sourceLabel)
          .replace("{date}", chartPoints.at(-1) ? at(new Date(chartPoints.at(-1)!.timestamp).toISOString()) : "—")
          .replace("{value}", chartPoints.at(-1) ? money(chartPoints.at(-1)!.totalValue) : "—")}</p>
      </section>
      <section className="t3-flow-card t3-flow-sources">
        <header><h2>{t("overview.design.sources")}</h2><span>{t("overview.design.sourceCount").replace("{count}", String(totalSources))}</span></header>
        {statuses.map((status) => {
          const assets = status.label === sourceLabel ? view.lastGood : view.included.filter((asset) => asset.wallet === status.label);
          const value = assets.length ? assets.reduce((sum, asset) => sum + asset.value, 0) : undefined;
          return <div className="t3-flow-source-row" key={status.sourceId}>
            <i aria-hidden="true">{status.label.slice(0, 2)}</i>
            <div><strong>{status.label}</strong><small className={status.status === "ok" ? "" : "failed"}>{status.status === "ok"
              ? t("refresh.fidelity.refreshedAt").replace("{time}", time(status.finishedAt))
              : t("overview.fidelity.failedLastGood").replace("{time}", at(status.lastSuccessAt))}</small></div>
            <div><strong>{value === undefined ? "—" : money(value)}</strong><small>{status.status === "ok"
              ? value === undefined ? "—" : `${includedTotal ? (value / includedTotal * 100).toFixed(1) : "0.0"}%`
              : t("refresh.fidelity.lastKnownLabel")}</small></div>
          </div>;
        })}
        <p className="t3-flow-source-foot">{t("refresh.fidelity.partialHeading")
          .replace("{time}", time(failed?.finishedAt ?? view.at))
          .replace("{count}", String(completed)).replace("{total}", String(totalSources))}</p>
      </section>
      <section className="t3-flow-card t3-flow-holdings">
        <header><h2>{t("overview.design.holdings")}</h2><span>{t("refresh.fidelity.holdingsCount")
          .replace("{count}", String(holdings.length)).replace("{source}", sourceLabel)}</span></header>
        <table><thead><tr><th>{t("overview.design.asset")}</th><th>{t("overview.design.price")}</th>
          <th>{t("overview.design.value")}</th><th>7D</th></tr></thead>
          <tbody>{holdings.map((row) => <tr key={row.symbol}>
            <th>{row.symbol}<small>{row.value ? `${(row.value / includedTotal * 100).toFixed(1)}%` : t("refresh.fidelity.onlyInSource").replace("{source}", sourceLabel)}</small></th>
            <td>{row.amount ? money(row.value / row.amount) : "—"}</td>
            <td>{row.value ? money(row.value) : "—"}</td><td>—</td>
          </tr>)}</tbody></table>
      </section>
      <section className="t3-flow-card t3-flow-left-out">
        <header><h2>{t("refresh.fidelity.leftOut").replace("{source}", sourceLabel)}</h2>
          <span>{t("refresh.fidelity.lastKnownLabel")}</span></header>
        {lastGood.map((row) => <div className="t3-flow-left-row" key={row.symbol}>
          <span><strong>{row.symbol}</strong> {row.amount.toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
          <strong>{money(row.value)}</strong></div>)}
        <div className="t3-flow-left-total"><span>{t("refresh.fidelity.lastKnownTotal")}</span>
          <strong>{lastGoodValue}</strong></div>
        <p>{view.lastGoodAt ? t("refresh.fidelity.leftOutNote").replace("{date}", at(view.lastGoodAt))
          : t("refresh.fidelity.noLastKnown").replace("{source}", sourceLabel)}</p>
        <div className="t3-flow-left-bottom"><div><span>{t("refresh.fidelity.totalExcludingShort").replace("{source}", sourceLabel)}</span><strong>{money(includedTotal)}</strong></div>
          <div><span>{t("refresh.fidelity.withLastKnown").replace("{source}", sourceLabel)}</span>
            <strong>{view.lastGoodAt ? money(includedTotal + lastGoodTotal) : "—"}</strong></div></div>
      </section>
    </div>
  </div>;
}
