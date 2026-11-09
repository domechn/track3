import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDownIcon, ExclamationTriangleIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import type { AssetType } from "@/middlelayers/datafetch/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import type { CurrencyRateDetail, TDateRange, WalletAssetsPercentageData } from "@/middlelayers/types";
import {
  queryAllDataDates, queryAssetsByUUIDs, queryLatestAssetsPercentage,
  queryPNLChartValue, queryTopCoinsPercentageChangeData, queryTopCoinsRank,
} from "@/middlelayers/charts";
import { WALLET_ANALYZER } from "@/middlelayers/charts-refresh";
import { holdingsWeekPriceChanges } from "./overview-holdings";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { sourceDisplayNames } from "./source-display-name";
import { useCurrentSourceStatuses } from "./use-current-source-statuses";
import { matchSourceStatus } from "./source-status-match";
import { useLatestWalletOrdinals } from "./source-name-order";
import { buildAssetDetailsPath } from "@/utils/assets";
import { currencyWrapper } from "@/utils/currency";
import { Card } from "./ui/card";
import { deriveContributions, deriveOverviewSeries, selectBestDayContributionSnapshots, selectSevenDayContributionSnapshots, unavailableSources } from "./overview-derived";
import { overviewRefreshRequestedEvent, sourceStatusesChangedEvent } from "./source-status-event";
import { niceStep } from "./overview-chart-scale";
import { directionClass, directionColorVar } from "@/utils/color";
import type { QuoteColor } from "@/middlelayers/types";

type Change = { timestamp: number; value: number };
type Contribution = { symbol: string; assetType: AssetType; value: number };
type CoinRow = {
  symbol: string; assetType: AssetType; value: number; amount: number;
  rank?: number; priceChange?: number; dayChange?: number; weekChange?: number;
};

export function useOverviewPanelsData(dateRange: TDateRange, allTimeRange: TDateRange) {
  const version = useDataChangedVersion();
  const [series, setSeries] = useState<ReturnType<typeof deriveOverviewSeries>>(() => deriveOverviewSeries([]));
  const [bestDayContribution, setBestDayContribution] = useState<Contribution>();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionCount, setContributionCount] = useState(0);
  const [weekBased, setWeekBased] = useState(false);
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [sources, setSources] = useState<WalletAssetsPercentageData>([]);
  const [storedStatuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const statuses = useCurrentSourceStatuses(storedStatuses);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  const allKey = `${allTimeRange.start.getTime()}-${allTimeRange.end.getTime()}`;

  useEffect(() => {
    const onStatusesChanged = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, onStatusesChanged);
    return () => window.removeEventListener(sourceStatusesChangedEvent, onStatusesChanged);
  }, []);

  useEffect(() => {
    let active = true;
    let datesPromise: ReturnType<typeof queryAllDataDates> | undefined;
    const loadDates = () => datesPromise ??= queryAllDataDates();
    void (async () => {
      try {
        const points = await queryPNLChartValue(allTimeRange);
        const nextSeries = deriveOverviewSeries(points, dateRange);
        if (active) { setSeries(nextSeries); setBestDayContribution(undefined); }
        if (!nextSeries.bestDay) return;
        try {
          const pair = selectBestDayContributionSnapshots(
            await loadDates(), nextSeries.bestDay.timestamp, dateRange.start);
          const assets = pair ? await queryAssetsByUUIDs([pair.fromId, pair.toId]) : [];
          const topGain = pair
            ? deriveContributions(assets, pair.fromId, pair.toId).filter((row) => row.value > 0)
              .sort((a, b) => b.value - a.value)[0] : undefined;
          if (active) setBestDayContribution(topGain);
        } catch { if (active) setBestDayContribution(undefined); }
      } catch { if (active) { setSeries(deriveOverviewSeries([])); setBestDayContribution(undefined); } }
    })();
    void (async () => {
      try {
        const pair = selectSevenDayContributionSnapshots(await loadDates(), dateRange.start, dateRange.end);
        if (!pair) {
          if (active) { setContributions([]); setContributionCount(0); setWeekBased(false); }
          return;
        }
        const assets = await queryAssetsByUUIDs([pair.fromId, pair.toId]);
        if (active) {
          setContributions(deriveContributions(assets, pair.fromId, pair.toId));
          setContributionCount(pair.count);
          setWeekBased(pair.weekBased);
        }
      } catch { if (active) { setContributions([]); setContributionCount(0); setWeekBased(false); } }
    })();
    void (async () => {
      try {
        const [assets, ranks, changes, dates] = await Promise.all([
          queryLatestAssetsPercentage(dateRange),
          queryTopCoinsRank(dateRange),
          queryTopCoinsPercentageChangeData(dateRange),
          loadDates(),
        ]);
        const byRank = new Map(ranks.coins.map((coin) => [`${coin.assetType}:${coin.coin}`, coin.rankData.at(-1)?.rank]));
        const byChange = new Map(changes.coins.map((coin) => [`${coin.assetType}:${coin.coin}`, coin.percentageData.at(-1)?.price]));
        const selected = dates.filter((row) => {
          const time = new Date(row.createdAt).getTime();
          return time >= dateRange.start.getTime() && time <= dateRange.end.getTime();
        }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const latest = selected.at(-1);
        const relativeDay = (days: number) => latest && selected.find((row) =>
          Math.abs(new Date(row.createdAt).getTime() - new Date(latest.createdAt).getTime() + days * 86400000) < 12 * 60 * 60 * 1000);
        const priorDay = relativeDay(1);
        const priorWeek = relativeDay(7);
        const pairs = latest ? [latest.id, priorDay?.id, priorWeek?.id].filter((id): id is string => !!id) : [];
        const points = pairs.length > 1 ? await queryAssetsByUUIDs(pairs) : [];
        const dayChange = latest && priorDay ? holdingsWeekPriceChanges(points, priorDay.id, latest.id) : {};
        const weekChange = latest && priorWeek ? holdingsWeekPriceChanges(points, priorWeek.id, latest.id) : {};
        if (active) setCoins(assets.filter((asset) => asset.assetType === "crypto").map((asset) => ({
          symbol: asset.coin, assetType: asset.assetType, amount: asset.amount, value: asset.value,
          rank: byRank.get(`${asset.assetType}:${asset.coin}`),
          priceChange: byChange.get(`${asset.assetType}:${asset.coin}`),
          dayChange: dayChange[`${asset.assetType}:${asset.coin}`],
          weekChange: weekChange[`${asset.assetType}:${asset.coin}`],
        })));
      } catch { if (active) setCoins([]); }
    })();
    void WALLET_ANALYZER.queryWalletAssetsPercentage()
      .then((rows) => { if (active) setSources(rows); })
      .catch(() => { if (active) setSources([]); });
    return () => { active = false; };
  }, [rangeKey, allKey, version]);
  return { series, bestDayContribution, contributions, contributionCount, weekBased, coins, statuses, sources };
}

const signedMoney = (value: number, currency: CurrencyRateDetail) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${Math.abs(currencyWrapper(currency)(value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (value: number, currency: CurrencyRateDetail) =>
  `${currency.symbol}${currencyWrapper(currency)(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedMoney0 = (value: number, currency: CurrencyRateDetail) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${Math.abs(Math.round(currencyWrapper(currency)(value))).toLocaleString()}`;
const dayLabel = (timestamp: number, locale: string) => new Date(timestamp).toLocaleDateString(
  locale === "zh" ? "zh-CN" : "en-GB", { month: "short", day: "numeric" });
const sourceMonogram = (label: string) => {
  if (/^binance$/i.test(label)) return "BN";
  if (/^ledger\b/i.test(label)) return "LD";
  if (/^interactive brokers$/i.test(label)) return "IB";
  if (/^0x/i.test(label)) return "0x";
  return label.slice(0, 2).toUpperCase();
};

export function DailyChangeCard({ currency, daily, bestDay, desktopFidelity = false, quoteColor = "green-up-red-down" }: {
  currency: CurrencyRateDetail; daily: Change[]; bestDay?: Change; desktopFidelity?: boolean; quoteColor?: QuoteColor;
}) {
  const { t, locale } = useTranslation();
  const chartValue = desktopFidelity ? currencyWrapper(currency) : (value: number) => value;
  const peak = Math.max(1, ...daily.map((item) => Math.abs(chartValue(item.value))));
  const scale = niceStep(peak);
  const barScale = desktopFidelity ? scale : peak;
  return <Card className="t3-overview-panel t3-daily-panel">
    <header className="t3-overview-panel-heading">
      <h2>{t("overview.design.dailyChange")}</h2>
      <span>{desktopFidelity && daily.length === 30
        ? t("overview.fidelity.dailyWindow").replace("{currency}", currency.currency)
        : t("overview.design.lastSnapshots").replace("{count}", String(daily.length))}</span>
    </header>
    {daily.length ? <>
      <div className="t3-daily-chart" role="img" aria-label={t("overview.design.dailyChart")}>
        <div className="t3-daily-zero" />
        {desktopFidelity && <div className="t3-daily-y-axis" aria-hidden="true">
          {[scale, scale / 2, 0, -scale / 2, -scale].map((value) =>
            <span key={value}>{value === 0 ? "0" : `${value > 0 ? "+" : "−"}${Math.abs(value) >= 1000 ? `${Math.abs(value / 1000)}K` : Math.abs(value)}`}</span>)}
        </div>}
        {desktopFidelity && <div className="t3-daily-direction" aria-hidden="true">
          <span className={directionClass(1, quoteColor)}>▲ {t("overview.fidelity.up")}</span><span className={directionClass(-1, quoteColor)}>▼ {t("overview.fidelity.down")}</span>
        </div>}
        {daily.map((item) => <div className="t3-daily-column" key={item.timestamp} title={`${dayLabel(item.timestamp, locale)}: ${signedMoney(item.value, currency)}`}>
          <span className={item.value > 0 ? "t3-daily-up" : item.value < 0 ? "t3-daily-down" : "t3-daily-neutral"}
            data-direction={item.value > 0 ? "gain" : item.value < 0 ? "loss" : "neutral"}
            style={{ height: `${Math.max(2, Math.abs(chartValue(item.value)) / barScale * 48)}%`, backgroundColor: directionColorVar(item.value, quoteColor) }} />
        </div>)}
        {desktopFidelity && <div className="t3-daily-x-axis" aria-hidden="true">
          <span />
          <span>{daily.length > 10 ? dayLabel(daily[9].timestamp, locale) : ""}</span>
          <span>{daily.length > 20 ? dayLabel(daily[19].timestamp, locale) : ""}</span>
          <span>{dayLabel(daily[daily.length - 1].timestamp, locale)}</span>
        </div>}
        <span className="sr-only">{daily.map((item) => `${dayLabel(item.timestamp, locale)} ${signedMoney(item.value, currency)}`).join(", ")}</span>
      </div>
      <div className="t3-panel-footnote">{bestDay && t("overview.design.bestDay")
        .replace("{day}", dayLabel(bestDay.timestamp, locale))
        .replace("{amount}", signedMoney(bestDay.value, currency))}</div>
    </> : <p className="t3-panel-empty">{t("overview.design.needTwoSnapshots")}</p>}
  </Card>;
}

export function WhatMovedCard({ currency, rows, count, weekBased = false, desktopFidelity = false, quoteColor = "green-up-red-down" }: {
  currency: CurrencyRateDetail; rows: Contribution[]; count: number; weekBased?: boolean; desktopFidelity?: boolean; quoteColor?: QuoteColor;
}) {
  const { t } = useTranslation();
  const net = rows.reduce((total, item) => total + item.value, 0);
  const orderedRows = weekBased ? [...rows].sort((a, b) =>
    Number(b.value >= 0) - Number(a.value >= 0) || Math.abs(b.value) - Math.abs(a.value)) : rows;
  const positivePeak = Math.max(0, ...orderedRows.map((item) => item.value));
  const negativePeak = Math.max(0, ...orderedRows.map((item) => -item.value));
  const zero = negativePeak / (positivePeak + negativePeak || 1) * 92 + 4;
  const rightSpace = 96 - zero;
  const leftSpace = zero - 4;
  const peak = Math.max(positivePeak, negativePeak, 1);
  return <Card className="t3-overview-panel t3-moved-panel">
    <header className="t3-overview-panel-heading"><h2>{t("overview.design.whatMoved")}</h2>
      {count > 0 && <span>{weekBased
        ? t("overview.fidelity.weekChange").replace("{value}", signedMoney0(net, currency))
        : t("overview.design.snapshotCount").replace("{count}", String(count))}</span>}</header>
    {rows.length ? <ol className={`t3-moved-list${desktopFidelity ? " t3-moved-diverging" : ""}`}>
      {orderedRows.slice(0, 8).map((row) => <li key={`${row.assetType}:${row.symbol}`}>
        <Link to={buildAssetDetailsPath({ symbol: row.symbol, assetType: row.assetType })} className="t3-moved-symbol">{row.symbol}</Link>
        <span className="t3-moved-track" style={desktopFidelity ? { "--zero": `${zero}%` } as CSSProperties : undefined}>
          <span className={row.value >= 0 ? "t3-daily-up" : "t3-daily-down"} style={{
            backgroundColor: directionColorVar(row.value, quoteColor),
            width: `${row.value === 0 ? 0 : Math.max(2, desktopFidelity
              ? Math.abs(row.value) / (row.value > 0 ? positivePeak || 1 : negativePeak || 1) * (row.value > 0 ? rightSpace : leftSpace)
              : Math.abs(row.value) / peak * 100)}%`,
            ...(desktopFidelity ? row.value >= 0 ? { left: `${zero}%` } : { right: `${100 - zero}%` } : {}),
          }} />
        </span>
        <strong className={directionClass(row.value, quoteColor)}>{weekBased ? signedMoney0(row.value, currency) : signedMoney(row.value, currency)}</strong>
      </li>)}
    </ol> : <p className="t3-panel-empty">{t("overview.design.needTwoSnapshots")}</p>}
  </Card>;
}

export function SourceStatusCard({ statuses, sources = [], currency, variant = "banner", desktopFidelity = false }: {
  statuses: PortfolioSourceStatus[];
  sources?: WalletAssetsPercentageData;
  currency?: CurrencyRateDetail;
  variant?: "banner" | "card";
  desktopFidelity?: boolean;
}) {
  const { t } = useTranslation();
  const walletOrdinals = useLatestWalletOrdinals();
  const failed = unavailableSources(statuses);
  const firstFailed = statuses.find((status) =>
    (status.status === "failed" || status.status === "stale") && status.category !== "quota");
  const lastGoodTime = firstFailed?.lastSuccessAt
    ? new Date(firstFailed.lastSuccessAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const failedReason = firstFailed?.detail === "Source timed out"
    ? t("refresh.detail.timeout") : t("overview.fidelity.refreshUnavailable");
  const listed = sources.length ? sources : statuses.map((source) => ({
    wallet: source.label, walletAlias: source.label, walletType: undefined as string | undefined,
    value: 0, percentage: 0, amount: 0, chartColor: "",
  }));
  const displayLabels = sourceDisplayNames(listed.map((source) => ({
    id: source.wallet, wallet: source.wallet, alias: source.walletAlias, type: source.walletType,
  })), (index) => t("wallets.fallbackName").replace("{number}", String(index)), walletOrdinals);
  const statusSources = sources.map((source, index) => ({ id: source.wallet, label: displayLabels[index] }));
  const identities = Object.fromEntries(sources.map((source) => [source.wallet, {
    wallet: source.wallet, type: source.walletType,
  }]));
  const firstFailedSource = firstFailed && sources.find((source, index) =>
    matchSourceStatus(statusSources[index], identities, statusSources, statuses) === firstFailed);
  if (variant === "card" && !desktopFidelity) return <Card className="t3-overview-panel t3-sources-panel">
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
  if (variant === "card") return <Card className="t3-overview-panel t3-sources-panel">
    <header className="t3-overview-panel-heading"><h2>{t("overview.design.sources")}</h2>
      <span className="t3-source-heading-actions">
        {statuses.length > 0 && sources.length > 0
          ? t("overview.fidelity.sourcesCurrent")
            .replace("{ok}", String(statuses.filter((status) => status.status === "ok").length))
            .replace("{total}", String(Math.max(statuses.length, sources.length)))
          : t("overview.design.sourceCount").replace("{count}", String(statuses.length || sources.length))}
        <button type="button"
          onClick={() => window.dispatchEvent(new Event(overviewRefreshRequestedEvent))}>
          <UpdateIcon aria-hidden="true" />{t("overview.fidelity.updateAll")}
        </button>
      </span></header>
    {firstFailed && <div className="t3-source-banner" role="status">
      <ExclamationTriangleIcon aria-hidden="true" />
      <div>
      <strong>{t("overview.fidelity.sourceDidNotRefresh").replace("{source}", firstFailed.label)}</strong>
      <span>{firstFailedSource && currency && lastGoodTime
        ? t("overview.fidelity.lastGoodValue")
          .replace("{reason}", failedReason)
          .replace("{value}", money(firstFailedSource.value, currency))
          .replace("{time}", lastGoodTime)
        : t("overview.design.sourceFallback")}</span>
      </div>
    </div>}
    {listed.length ? <div className="t3-sources-list">
      {listed.map((source, index) => {
        const label = displayLabels[index];
        const status = matchSourceStatus({ id: source.wallet, label }, identities, statusSources, statuses);
        const kind = status?.kind ?? (source.walletType === "ibkr" ? "broker" : source.walletType === "binance" || source.walletType === "okx" ? "exchange" : "wallet");
        return <div key={source.wallet} className="t3-source-row">
          <span className="t3-source-logo" aria-hidden="true">{sourceMonogram(label)}</span>
          <span className="t3-source-name" title={source.wallet}><strong>{label}</strong>
            <small>{t(`overview.fidelity.kind.${kind}`)} · <span className={`t3-source-dot ${status?.status ?? ""}`} /> {status?.status === "ok" && status.finishedAt
              ? `${t("overview.fidelity.updated")} ${new Date(status.finishedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}`
              : status?.status === "ok" ? t("refresh.status.ok") : !status ? t("overview.fidelity.snapshot") : null}</small>
            {status && status.status !== "ok" && <small className="t3-source-last-good">{status.lastSuccessAt
              ? t(status.category === "quota" ? "overview.fidelity.quotaLastGood" : "overview.fidelity.failedLastGood")
                .replace("{time}", new Date(status.lastSuccessAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }))
              : t(`refresh.status.${status.status}`)}</small>}</span>
          {status && (status.status === "failed" || status.status === "stale") && status.category !== "quota" && <button type="button"
            className="t3-source-retry" onClick={() => window.dispatchEvent(new CustomEvent(overviewRefreshRequestedEvent, {
              detail: { sourceId: status.sourceId },
            }))}><UpdateIcon aria-hidden="true" />{t("refresh.retryButton")}</button>}
          {currency && sources.length > 0 && <span className="t3-source-value"><strong>{money(source.value, currency)}</strong><small>{source.percentage.toFixed(1)}%</small></span>}
          {!currency && status && <span className={`t3-source-condition ${status.status}`}>{t(`refresh.status.${status.status}`)}</span>}
        </div>;
      })}
    </div> : <p className="t3-panel-empty">{t("overview.design.sourceEmpty")}</p>}
    {!sources.length && <a className="t3-panel-footnote t3-source-link" href="#/settings/configuration">{t("overview.design.manageSources")}</a>}
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

export function TopCoinsCard({ currency, rows, compact = false, overviewFidelity = false, quoteColor = "green-up-red-down" }: {
  currency: CurrencyRateDetail; rows: CoinRow[]; compact?: boolean; overviewFidelity?: boolean; quoteColor?: QuoteColor;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<"value" | "change">("value");
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) =>
    sort === "value" ? b.value - a.value : ((overviewFidelity ? b.weekChange : b.priceChange) ?? -Infinity) -
      ((overviewFidelity ? a.weekChange : a.priceChange) ?? -Infinity)), [rows, sort, overviewFidelity]);
  const visible = compact && !expanded ? sorted.slice(0, 3) : sorted;
  const assetNames: Record<string, string> = {
    BTC: "Bitcoin", USDT: "Tether", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", USDC: "USD Coin",
  };
  const percent = (value?: number) => value === undefined ? "—"
    : `${value >= 0.05 ? "+" : value <= -0.05 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
  const tone = (value?: number) => directionClass(value === undefined || Math.abs(value) < 0.05 ? 0 : value, quoteColor);
  return <Card className="t3-overview-panel t3-top-coins">
    <header className="t3-overview-panel-heading">
      <h2>{t("overview.design.topCoins")}</h2>
      <div className="t3-top-sort" role="group" aria-label={t("overview.design.topCoins")}>
        <button type="button" aria-pressed={sort === "value"} onClick={() => setSort("value")}>{t("overview.design.byValue")}</button>
        <button type="button" aria-pressed={sort === "change"} onClick={() => setSort("change")}>{t("overview.design.byPriceChange")}</button>
      </div>
    </header>
    {rows.length ? <>
      <div className={`t3-top-head${overviewFidelity ? " t3-top-fidelity-grid" : ""}`}>
        <span>{t("overview.design.coin")}</span><span>{t("overview.design.portfolioRank")}</span>
        <span>{t("overview.design.price")}</span>
        {overviewFidelity
          ? <><span>{t("overview.fidelity.twentyFourHours")}</span><span>{t("overview.fidelity.sevenDays")}{sort === "change" && <ChevronDownIcon aria-hidden="true" className="t3-top-sort-mark" />}<span className="sr-only"> {t("overview.design.change")}</span></span></>
          : <span>{t("overview.design.change")}</span>}
        <span>{t("overview.design.value")}{sort === "value" && <ChevronDownIcon aria-hidden="true" className="t3-top-sort-mark" />}</span>
      </div>
      <div className="t3-top-body">
        {visible.map((row) => <Link data-testid="overview-coin-row" key={`${row.assetType}:${row.symbol}`}
          to={buildAssetDetailsPath({ symbol: row.symbol, assetType: row.assetType })}
          className={`t3-top-row${overviewFidelity ? " t3-top-fidelity-grid" : ""}`}>
          {overviewFidelity
            ? <span><strong>{row.symbol}</strong>{assetNames[row.symbol] && <small>{assetNames[row.symbol]}</small>}</span>
            : <strong>{row.symbol}</strong>}
          <span>{row.rank === undefined ? "—" : `#${row.rank}`}</span>
          <span>{row.amount ? money(row.value / row.amount, currency) : "—"}</span>
          {overviewFidelity && <span className={tone(row.dayChange)}>{percent(row.dayChange)}</span>}
          <span className={overviewFidelity ? tone(row.weekChange) : directionClass(row.priceChange, quoteColor)}>
            {overviewFidelity ? percent(row.weekChange) : row.priceChange === undefined ? "—"
              : `${row.priceChange > 0 ? "+" : row.priceChange < 0 ? "−" : ""}${Math.abs(row.priceChange).toFixed(1)}%`}
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
