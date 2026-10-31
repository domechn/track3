import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AssetType } from "@/middlelayers/datafetch/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import type { CurrencyRateDetail, TDateRange } from "@/middlelayers/types";
import {
  queryAllDataDates, queryAssetsByUUIDs, queryLatestAssetsPercentage,
  queryPNLChartValue, queryTopCoinsPercentageChangeData, queryTopCoinsRank,
} from "@/middlelayers/charts";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { buildAssetDetailsPath } from "@/utils/assets";
import { currencyWrapper } from "@/utils/currency";
import { Card } from "./ui/card";
import { deriveContributions, deriveOverviewSeries, selectContributionSnapshots, unavailableSources } from "./overview-derived";
import { sourceStatusesChangedEvent } from "./source-status-event";

type Change = { timestamp: number; value: number };
type Contribution = { symbol: string; assetType: AssetType; value: number };
type CoinRow = { symbol: string; assetType: AssetType; value: number; amount: number; rank?: number; priceChange?: number };

export function useOverviewPanelsData(dateRange: TDateRange, allTimeRange: TDateRange) {
  const version = useDataChangedVersion();
  const [series, setSeries] = useState<ReturnType<typeof deriveOverviewSeries>>(() => deriveOverviewSeries([]));
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionCount, setContributionCount] = useState(0);
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  const allKey = `${allTimeRange.start.getTime()}-${allTimeRange.end.getTime()}`;

  useEffect(() => {
    const onStatusesChanged = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, onStatusesChanged);
    return () => window.removeEventListener(sourceStatusesChangedEvent, onStatusesChanged);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const points = await queryPNLChartValue(allTimeRange);
        if (active) {
          setSeries(deriveOverviewSeries(points, dateRange));
        }
      } catch { if (active) setSeries(deriveOverviewSeries([])); }
    })();
    void (async () => {
      try {
        const pair = selectContributionSnapshots(await queryAllDataDates(), dateRange.start, dateRange.end);
        if (!pair) {
          if (active) { setContributions([]); setContributionCount(0); }
          return;
        }
        const assets = await queryAssetsByUUIDs([pair.fromId, pair.toId]);
        if (active) { setContributions(deriveContributions(assets, pair.fromId, pair.toId)); setContributionCount(pair.count); }
      } catch { if (active) { setContributions([]); setContributionCount(0); } }
    })();
    void (async () => {
      try {
        const [assets, ranks, changes] = await Promise.all([
          queryLatestAssetsPercentage(dateRange),
          queryTopCoinsRank(dateRange),
          queryTopCoinsPercentageChangeData(dateRange),
        ]);
        const byRank = new Map(ranks.coins.map((coin) => [`${coin.assetType}:${coin.coin}`, coin.rankData.at(-1)?.rank]));
        const byChange = new Map(changes.coins.map((coin) => [`${coin.assetType}:${coin.coin}`, coin.percentageData.at(-1)?.price]));
        if (active) setCoins(assets.filter((asset) => asset.assetType === "crypto").map((asset) => ({
          symbol: asset.coin, assetType: asset.assetType, amount: asset.amount, value: asset.value,
          rank: byRank.get(`${asset.assetType}:${asset.coin}`),
          priceChange: byChange.get(`${asset.assetType}:${asset.coin}`),
        })));
      } catch { if (active) setCoins([]); }
    })();
    return () => { active = false; };
  }, [rangeKey, allKey, version]);
  return { series, contributions, contributionCount, coins, statuses };
}

const signedMoney = (value: number, currency: CurrencyRateDetail) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${Math.abs(currencyWrapper(currency)(value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (value: number, currency: CurrencyRateDetail) =>
  `${currency.symbol}${currencyWrapper(currency)(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function DailyChangeCard({ currency, daily, bestDay }: {
  currency: CurrencyRateDetail; daily: Change[]; bestDay?: Change;
}) {
  const { t } = useTranslation();
  const peak = Math.max(1, ...daily.map((item) => Math.abs(item.value)));
  return <Card className="t3-overview-panel t3-daily-panel">
    <header className="t3-overview-panel-heading">
      <h2>{t("overview.design.dailyChange")}</h2>
      <span>{t("overview.design.lastSnapshots").replace("{count}", String(daily.length))}</span>
    </header>
    {daily.length ? <>
      <div className="t3-daily-chart" role="img" aria-label={t("overview.design.dailyChart")}>
        <div className="t3-daily-zero" />
        {daily.map((item) => <div className="t3-daily-column" key={item.timestamp} title={`${dayLabel(item.timestamp)}: ${signedMoney(item.value, currency)}`}>
          <span className={item.value >= 0 ? "t3-daily-up" : "t3-daily-down"}
            style={{ height: `${Math.max(2, Math.abs(item.value) / peak * 48)}%` }} />
        </div>)}
        <span className="sr-only">{daily.map((item) => `${dayLabel(item.timestamp)} ${signedMoney(item.value, currency)}`).join(", ")}</span>
      </div>
      <div className="t3-panel-footnote">{bestDay && t("overview.design.bestDay")
        .replace("{day}", dayLabel(bestDay.timestamp))
        .replace("{amount}", signedMoney(bestDay.value, currency))}</div>
    </> : <p className="t3-panel-empty">{t("overview.design.needTwoSnapshots")}</p>}
  </Card>;
}

export function WhatMovedCard({ currency, rows, count }: { currency: CurrencyRateDetail; rows: Contribution[]; count: number }) {
  const { t } = useTranslation();
  const peak = Math.max(1, ...rows.map((item) => Math.abs(item.value)));
  return <Card className="t3-overview-panel t3-moved-panel">
    <header className="t3-overview-panel-heading"><h2>{t("overview.design.whatMoved")}</h2>
      {count > 0 && <span>{t("overview.design.snapshotCount").replace("{count}", String(count))}</span>}</header>
    {rows.length ? <ol className="t3-moved-list">
      {rows.slice(0, 8).map((row) => <li key={`${row.assetType}:${row.symbol}`}>
        <Link to={buildAssetDetailsPath({ symbol: row.symbol, assetType: row.assetType })} className="t3-moved-symbol">{row.symbol}</Link>
        <span className="t3-moved-track"><span className={row.value >= 0 ? "t3-daily-up" : "t3-daily-down"} style={{ width: `${Math.max(2, Math.abs(row.value) / peak * 100)}%` }} /></span>
        <strong className={row.value > 0 ? "text-gain" : row.value < 0 ? "text-loss" : "text-muted-foreground"}>{signedMoney(row.value, currency)}</strong>
      </li>)}
    </ol> : <p className="t3-panel-empty">{t("overview.design.needTwoSnapshots")}</p>}
  </Card>;
}

export function SourceStatusCard({ statuses, variant = "banner" }: { statuses: PortfolioSourceStatus[]; variant?: "banner" | "card" }) {
  const { t } = useTranslation();
  const failed = unavailableSources(statuses);
  if (variant === "card") return <Card className="t3-overview-panel t3-sources-panel">
    <header className="t3-overview-panel-heading"><h2>{t("overview.design.sources")}</h2>
      <span>{t("overview.design.sourceCount").replace("{count}", String(statuses.length))}</span></header>
    {statuses.length ? <div className="t3-sources-list">
      {statuses.map((source) => <div key={source.sourceId} className="t3-source-row">
        <span className={`t3-source-dot ${source.status}`} aria-hidden="true" />
        <span className="t3-source-name"><strong>{source.label}</strong>
          <small>{source.lastSuccessAt && source.status !== "ok"
            ? t("overview.design.lastGood").replace("{time}", new Date(source.lastSuccessAt).toLocaleString())
            : source.provider ?? ""}</small></span>
        <span className={`t3-source-condition ${source.status}`}>{t(`refresh.status.${source.status}`)}</span>
      </div>)}
    </div> : <p className="t3-panel-empty">{t("overview.design.sourceEmpty")}</p>}
    <a className="t3-panel-footnote t3-source-link" href="#/settings/configuration">{t("overview.design.manageSources")}</a>
  </Card>;
  return <section className="t3-overview-source-status" aria-label={t("overview.design.sources")}>
    {failed.length > 0 && <div role="alert" className="t3-source-banner">
      <strong>{t("overview.design.sourceFailed").replace("{sources}", failed.map((item) => item.name).join(", "))}</strong>
      <span>{t("overview.design.sourceFallback")}</span>
      {failed.map((item) => <span key={item.name}>
        {item.name} · {item.lastSuccessAt
          ? t("overview.design.lastGood").replace("{time}", new Date(item.lastSuccessAt).toLocaleString())
          : t("overview.design.lastGoodUnknown")}
      </span>)}
    </div>}
  </section>;
}

export function TopCoinsCard({ currency, rows, compact = false }: {
  currency: CurrencyRateDetail; rows: CoinRow[]; compact?: boolean;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<"value" | "change">("value");
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) =>
    sort === "value" ? b.value - a.value : (b.priceChange ?? -Infinity) - (a.priceChange ?? -Infinity)), [rows, sort]);
  const visible = compact && !expanded ? sorted.slice(0, 3) : sorted;
  return <Card className="t3-overview-panel t3-top-coins">
    <header className="t3-overview-panel-heading">
      <h2>{t("overview.design.topCoins")}</h2>
      <div className="t3-top-sort" role="group" aria-label={t("overview.design.topCoins")}>
        <button type="button" aria-pressed={sort === "value"} onClick={() => setSort("value")}>{t("overview.design.byValue")}</button>
        <button type="button" aria-pressed={sort === "change"} onClick={() => setSort("change")}>{t("overview.design.byPriceChange")}</button>
      </div>
    </header>
    {rows.length ? <>
      <div className="t3-top-head"><span>{t("overview.design.coin")}</span><span>{t("overview.design.portfolioRank")}</span><span>{t("overview.design.price")}</span><span>{t("overview.design.change")}</span><span>{t("overview.design.value")}</span></div>
      <div className="t3-top-body">
        {visible.map((row) => <Link data-testid="overview-coin-row" key={`${row.assetType}:${row.symbol}`}
          to={buildAssetDetailsPath({ symbol: row.symbol, assetType: row.assetType })} className="t3-top-row">
          <strong>{row.symbol}</strong>
          <span>{row.rank === undefined ? "—" : `#${row.rank}`}</span>
          <span>{row.amount ? money(row.value / row.amount, currency) : "—"}</span>
          <span className={row.priceChange === undefined ? "text-muted-foreground" : row.priceChange > 0 ? "text-gain" : row.priceChange < 0 ? "text-loss" : "text-muted-foreground"}>
            {row.priceChange === undefined ? "—" : `${row.priceChange > 0 ? "+" : row.priceChange < 0 ? "−" : ""}${Math.abs(row.priceChange).toFixed(1)}%`}
          </span>
          <span>{money(row.value, currency)}</span>
        </Link>)}
      </div>
      {compact && rows.length > 3 && <button type="button" className="t3-top-more" onClick={() => setExpanded((value) => !value)}>
        {expanded ? t("overview.design.showFewer") : t("overview.design.showMore").replace("{count}", String(rows.length - 3))}
      </button>}
      <p className="t3-panel-footnote">{t("overview.design.rankNote")}</p>
    </> : <p className="t3-panel-empty">{t("overview.design.noCoins")}</p>}
  </Card>;
}
