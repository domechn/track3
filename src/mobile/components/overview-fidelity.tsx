import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { queryAssetChange, queryHistoricalData, queryLatestAssetsPercentage, queryTotalValue, queryTotalValues } from "@/middlelayers/charts";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { overviewUseLastKnownEvent, sourceStatusesChangedEvent } from "@/components/source-status-event";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { buildAssetDetailsPath } from "@/utils/assets";
import { currencyWrapper } from "@/utils/currency";
import { useTranslation } from "@/mobile/i18n";
import { rangeLabel } from "@/mobile/components/fidelity-range";
import SourceMark from "@/mobile/components/source-mark";
import { loadAIConfig } from "@/middlelayers/configuration";
import { getConfiguration } from "@/middlelayers/configuration";
import { isProVersion } from "@/middlelayers/license";
import { listPortfolioSources } from "@/middlelayers/data";
import FirstRunFidelity from "@/mobile/components/first-run-fidelity";
import LoadingOverviewFidelity from "@/mobile/components/loading-overview-fidelity";
import InsightsCard from "@/mobile/components/insights-card";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { sourceDisplayNames } from "@/components/source-display-name";
import { useLatestWalletOrdinals } from "@/components/source-name-order";
import PartialOverviewFidelity from "@/mobile/components/partial-overview-fidelity";
import { requestRefreshSource } from "@/mobile/components/refresh-progress-event";
import { BottomSheet } from "@/mobile/components/mobile";
import { Switch } from "@/mobile/components/mobile";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { formatOverviewAxisTicks } from "@/components/overview-chart-scale";
import { isValid, parse } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import "@/mobile/components/mobile/fidelity.css";
import { directionColorVar, directionTone } from "@/utils/color";

type Snapshot = Awaited<ReturnType<typeof queryHistoricalData>>[number];
type Asset = Awaited<ReturnType<typeof queryLatestAssetsPercentage>>[number];
type Point = Awaited<ReturnType<typeof queryTotalValues>>[number];
export type View = { points: Point[]; snapshots: Snapshot[]; latest: Snapshot | null; prior: Snapshot | null; week: Snapshot | null; holdings: Asset[]; partial: boolean; currentTotal: number; excluded: Awaited<ReturnType<typeof queryTotalValue>>["excludedSources"]; sources: ReturnType<typeof listPortfolioSources>; sourceLabels: Record<string, string> };

const names: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", USDT: "Tether", USDC: "USD Coin",
  AAPL: "Apple", NVDA: "NVIDIA",
};
const calendarPresets = [
  { value: "Today", key: "today" }, { value: "7 days", key: "sevenDays" },
  { value: "30 days", key: "thirtyDays" }, { value: "90 days", key: "ninetyDays" },
  { value: "1 year", key: "oneYear" }, { value: "All time", key: "allTime" },
  { value: "Custom", key: "custom" },
] as const;
const weekdays = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;
const fullDate = (date: Date, locale: string) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
const parseTypedDate = (text: string, locale: string) => {
  const displayFormat = locale === "zh" ? "yyyy年M月d日" : "d MMM yyyy";
  const date = parse(text.trim(), /^\d{4}-\d{1,2}-\d{1,2}$/.test(text.trim()) ? "yyyy-M-d" : displayFormat,
    new Date(), { locale: locale === "zh" ? zhCN : enUS });
  return isValid(date) ? date : null;
};
const nextDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const shortDate = (date: Date, locale: string) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short" }).format(date);
const timeLabel = (date: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
const amt = (value: number, currency: CurrencyRateDetail, digits = 2, signed = false) => {
  const converted = currencyWrapper(currency)(value);
  return `${signed ? converted > 0 ? "+" : converted < 0 ? "−" : "" : converted < 0 ? "−" : ""}${currency.symbol}${Math.abs(converted).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const pct = (value: number, digits = 2, signed = true) => {
  const rounded = Number((value * 100).toFixed(digits));
  return `${signed && rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(digits)}%`;
};
const tone = directionTone;
const dash = "—";
const total = (snapshot: Snapshot | null) => snapshot?.total ?? 0;
const from = (snapshot: Snapshot | null) => snapshot ? new Date(snapshot.createdAt) : null;
const assetMap = (snapshot: Snapshot | null) => {
  const result = new Map<string, { value: number; amount: number }>();
  for (const asset of snapshot?.assets ?? []) {
    const key = `${asset.assetType}:${asset.symbol}`;
    const previous = result.get(key) ?? { value: 0, amount: 0 };
    result.set(key, { value: previous.value + asset.value, amount: previous.amount + asset.amount });
  }
  return result;
};
const nearest = (snapshots: Snapshot[], before: number) =>
  snapshots.find((snapshot) => new Date(snapshot.createdAt).getTime() <= before) ?? null;

function Icon({ name, size = 18 }: { name: "clock" | "chevron" | "cloud" | "refresh"; size?: number }) {
  const paths = {
    clock: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5v4l2.5 1.5" /></>,
    chevron: <path d="M4 7l5 5 5-5" />,
    cloud: <path d="M5 14a3.5 3.5 0 0 1-.5-7A4.5 4.5 0 0 1 13 6.5 3.8 3.8 0 0 1 13 14z" />,
    refresh: <path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3" />,
  };
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Chart({ points, values, formatValue, formatTick, change, best }: { points: Point[]; values: number[]; formatValue: (value: number) => string; formatTick: (value: number) => string; change: string; best: { date: Date; change: string; symbol: string; symbolChange: string } | null }) {
  const { t, locale } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const min = Math.min(...values), max = Math.max(...values);
  const targetStep = Math.max((max - min) / 4, 1e-8);
  const power = 10 ** Math.floor(Math.log10(targetStep));
  const fraction = targetStep / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const low = Math.floor((min - step / 2) / step) * step;
  const high = Math.ceil((max + step / 2) / step) * step;
  const x = (index: number) => 44 + index / Math.max(1, points.length - 1) * 210;
  const y = (value: number) => 164 - (value - low) / Math.max(1, high - low) * 138;
  const ticks = Array.from({ length: Math.floor((high - low) / step) + 1 }, (_, index) => low + index * step);
  const roundedLabels = ticks.map(formatTick);
  const tickLabels = new Set(roundedLabels).size === roundedLabels.length ? roundedLabels :
    formatOverviewAxisTicks(ticks).map((label) => formatTick(0).endsWith("%") ? `${label}%` :
      formatTick(0).endsWith("K") ? label.replace(/k$/, "K") : label);
  const labelIndices = [...new Set([0, Math.round((points.length - 1) / 3), Math.round(2 * (points.length - 1) / 3), points.length - 1])];
  const bestIndex = best ? points.findIndex((point) => new Date(point.timestamp).toDateString() === best.date.toDateString()) : -1;
  const pick = (clientX: number, left: number, width: number) =>
    Math.max(0, Math.min(points.length - 1, Math.round(((clientX - left) * 324 / width - 44) / 210 * (points.length - 1))));
  const selectedValue = selected !== null && points[selected] ? formatValue(values[selected]) : "";
  const tipWidth = Math.max(78, selectedValue.length * 7 + 16);
  return <svg className="fd-overview-chart" viewBox="0 0 324 190" role="img" aria-label={t("fidelity.overview.totalValueChart")}
    aria-description={t("fidelity.overview.chartChange").replace("{start}", shortDate(new Date(points[0].timestamp), locale)).replace("{end}", shortDate(new Date(points.at(-1)!.timestamp), locale)).replace("{change}", change)}
    onContextMenu={(event) => event.preventDefault()}
    onPointerDown={(event) => { const r = event.currentTarget.getBoundingClientRect(); setSelected(pick(event.clientX, r.left, r.width)); }}
    onPointerMove={(event) => { const r = event.currentTarget.getBoundingClientRect(); setSelected(pick(event.clientX, r.left, r.width)); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") setSelected(null); }}>
    {ticks.map((value, index) => <g key={value}><line x1="44" x2="324" y1={y(value)} y2={y(value)} stroke="#262629" shapeRendering="crispEdges" /><text x="36" y={y(value) + 4} textAnchor="end" fill="var(--fd-faint)" fontSize="12">{tickLabels[index]}</text></g>)}
    {bestIndex >= 0 && best && <><line x1={x(bestIndex)} x2={x(bestIndex)} y1="29" y2="166" stroke="var(--fd-faint)" opacity=".45" shapeRendering="crispEdges" />
      <line x1={x(bestIndex)} x2={x(bestIndex)} y1="22" y2="29" stroke="var(--fd-faint)" opacity=".45" shapeRendering="crispEdges" />
      <text x="11" y="17" fill="var(--fd-faint)" fontSize="11">{t("fidelity.overview.bestDayChart").replace("{date}", shortDate(best.date, locale)).replace("{change}", best.change).replace("{symbol}", best.symbol).replace("{symbolChange}", best.symbolChange)}</text></>}
    {/* color-semantics: neutral total-value line shows level, not change. */}
    <path d={values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ")} fill="none" stroke="var(--fd-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    {labelIndices.map((index, order) => <text key={index} x={x(index) - (order === 0 ? 0 : order === labelIndices.length - 1 ? 40 : 20)} y="182" fill="var(--fd-faint)" fontSize="12">{shortDate(new Date(points[index].timestamp), locale)}</text>)}
    <text x="320" y={y(values.at(-1) ?? 0) + 4} textAnchor="end" fill="var(--fd-text)" fontSize="12" fontWeight="600">{formatValue(values.at(-1) ?? 0)}</text>
    {selected !== null && points[selected] && <>
      <line x1={x(selected)} x2={x(selected)} y1="29" y2="166" stroke="var(--fd-faint)" opacity=".35" />
      {/* color-semantics: neutral selection ring marks a point on the total-value line. */}
      <circle cx={x(selected)} cy={y(values[selected])} r="3.5" fill="var(--fd-surface)" stroke="var(--fd-accent)" strokeWidth="2" />
      <g transform={`translate(${Math.min(324 - tipWidth, x(selected) + 12)},0)`}><rect width={tipWidth} height="46" rx="6" fill="var(--fd-raised)" stroke="var(--fd-control)" /><text x="8" y="18" fill="var(--fd-muted)" fontSize="12">{shortDate(new Date(points[selected].timestamp), locale)}</text><text x="8" y="35" fill="var(--fd-text)" fontSize="12" fontWeight="600">{selectedValue}</text></g>
    </>}
  </svg>;
}

function DailyChart({ daily, currency, quoteColor }: { daily: { timestamp: number; value: number }[]; currency: CurrencyRateDetail; quoteColor: QuoteColor }) {
  const { t, locale } = useTranslation();
  const converted = daily.map((item) => currencyWrapper(currency)(item.value));
  const peak = Math.max(1, ...converted.map(Math.abs));
  const step = Math.max(1, 10 ** Math.floor(Math.log10(peak)) / 2);
  const bound = Math.ceil(peak / step) * step;
  const x = (index: number) => 48 + (index + .5) / Math.max(1, daily.length) * 276;
  const y = (value: number) => 83 - value / bound * 54;
  const label = (value: number) => value === 0 ? "0" : `${value > 0 ? "+" : "−"}${Math.abs(Math.round(value / 1000))}K`;
  return <svg className="fd-overview-daily-chart" viewBox="0 0 324 170" role="img" aria-label={t("overview.design.dailyChart")}>
    {[-bound, -bound / 2, 0, bound / 2, bound].map((value) => <g key={value}>
      <line x1="48" x2="324" y1={y(value)} y2={y(value)} stroke="var(--fd-border)"
        data-direction-zero-axis={value === 0 ? "" : undefined} />
      <text x="40" y={y(value) + 4} textAnchor="end" fill="var(--fd-faint)" fontSize="12">{label(value)}</text>
    </g>)}
    <text x="50" y="16" fill={directionColorVar(1, quoteColor)} fontSize="11">↑ {t("fidelity.overview.chartUp")}</text>
    <text x="50" y="151" fill={directionColorVar(-1, quoteColor)} fontSize="11">↓ {t("fidelity.overview.chartDown")}</text>
    {daily.map((item, index) => {
      const value = converted[index];
      const top = Math.min(y(value), y(0));
      return <rect key={item.timestamp} x={x(index) - 3} y={top} width="6" height={Math.max(1, Math.abs(y(value) - y(0)))}
        data-direction={value > 0 ? "gain" : value < 0 ? "loss" : "neutral"}
        fill={directionColorVar(value, quoteColor)}><title>{shortDate(new Date(item.timestamp), locale)}: {amt(item.value, currency, 0, true)}</title></rect>;
    })}
    {daily.filter((_, index) => (index > 0 && index % 10 === 0) || index === daily.length - 1).map((item) => {
      const index = daily.indexOf(item);
      return <text key={item.timestamp} x={index === daily.length - 1 ? 320 : x(index)} y="167" textAnchor={index === daily.length - 1 ? "end" : "middle"} fill="var(--fd-faint)" fontSize="12">{shortDate(new Date(item.timestamp), "en")}</text>;
    })}
  </svg>;
}

export default function OverviewFidelity({ currency, dateRange, allTimeRange, quoteColor, expanded, onExpandedChange, onRangeChange, onRefresh }: {
  currency: CurrencyRateDetail; dateRange: TDateRange; allTimeRange: TDateRange; quoteColor: QuoteColor;
  expanded?: boolean; onExpandedChange?: (expanded: boolean) => void;
  onRangeChange?: (selectedTimes: number, range: { from: Date; to: Date } | undefined) => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const { t, locale } = useTranslation();
  const version = useDataChangedVersion();
  const [view, setView] = useState<View | null>(null);
  const walletOrdinals = useLatestWalletOrdinals();
  const [withLastKnown, setWithLastKnown] = useState(false);
  useEffect(() => {
    const includeLastKnown = () => setWithLastKnown(true);
    window.addEventListener(overviewUseLastKnownEvent, includeLastKnown);
    return () => window.removeEventListener(overviewUseLastKnownEvent, includeLastKnown);
  }, []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const [insightsEnabled, setInsightsEnabled] = useState(false);
  const [proUser, setProUser] = useState(false);
  const [insightsDismissed, setInsightsDismissed] = useState(false);
  const [range, setRange] = useState(() => rangeLabel(dateRange));
  const [percentChart, setPercentChart] = useState(false);
  const [btcBase, setBtcBase] = useState(false);
  const [btcData, setBtcData] = useState<Awaited<ReturnType<typeof queryAssetChange>> | null>(null);
  const [localExpanded, setLocalExpanded] = useState(false);
  const rankExpanded = expanded ?? localExpanded;
  const setRankExpanded = onExpandedChange ?? setLocalExpanded;
  const [sort, setSort] = useState<"value" | "change">("value");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preset, setPreset] = useState("Custom");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const syncStatus = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  useEffect(() => setRange(rangeLabel(dateRange)), [dateRange.start.getTime(), dateRange.end.getTime()]);
  useEffect(() => {
    if (!btcBase) return;
    let active = true;
    void queryAssetChange(allTimeRange).then((data) => { if (active) setBtcData(data); })
      .catch(() => { if (active) setBtcData(null); });
    return () => { active = false; };
  }, [btcBase, allTimeRange.start.getTime(), allTimeRange.end.getTime(), version]);
  useEffect(() => {
    const changed = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, changed);
    return () => window.removeEventListener(sourceStatusesChangedEvent, changed);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([loadAIConfig(), isProVersion()]).then(([config, licensed]) => {
      if (active) { setInsightsEnabled(config.proactiveInsightsSummary === true); setProUser(licensed.isPro); }
    })
      .catch(() => { if (active) setInsightsEnabled(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    void Promise.all([
      queryTotalValues(allTimeRange),
      queryHistoricalData(50, false, { includeTransactions: false }),
      queryLatestAssetsPercentage(allTimeRange),
      Promise.resolve().then(() => queryTotalValue(allTimeRange)).catch(() => null),
      Promise.all([getConfiguration(), isProVersion()]).then(([config, license]) => config ? listPortfolioSources(config, license) : []),
    ]).then(async ([points, snapshots, holdings, detail, sources]) => {
      if (!active) return;
      setWithLastKnown(false);
      const latest = snapshots[0] ?? null;
      const sourceTotals = new Map<string, number>();
      for (const asset of latest?.assets ?? []) if (asset.wallet)
        sourceTotals.set(asset.wallet, (sourceTotals.get(asset.wallet) ?? 0) + asset.value);
      const wallets = [...sourceTotals.keys()].sort((a, b) =>
        sourceTotals.get(b)! - sourceTotals.get(a)! || a.localeCompare(b));
      const walletName = (index: number) => t("wallets.fallbackName").replace("{number}", String(index));
      const fallbackNames = sourceDisplayNames(wallets.map((id) => ({ id })), walletName, walletOrdinals);
      const latestAt = from(latest)?.getTime() ?? 0;
      setView({ points, snapshots, latest, prior: snapshots[1] ?? null,
        week: nearest(snapshots, latestAt - 7 * 86400000), holdings,
        partial: !!latest?.partial, currentTotal: detail?.totalValue ?? latest?.total ?? points.at(-1)?.totalValue ?? 0,
        excluded: detail?.excludedSources ?? [], sources,
        sourceLabels: Object.fromEntries(wallets.map((wallet, index) => [wallet, fallbackNames[index]])) });
      setStatus("ready");
      const aliases: Record<string, { wallet: string; alias: string; type: string } | undefined> =
        await new WalletAnalyzer(async () => []).listWalletAliases(wallets).catch(() => ({}));
      if (!active) return;
      const labels = sourceDisplayNames(wallets.map((id) => ({ id, ...aliases[id] })), walletName, walletOrdinals);
      const sourceLabels = Object.fromEntries(wallets.map((wallet, index) => [wallet, labels[index]]));
      setView((current) => current ? { ...current, sourceLabels } : current);
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [allTimeRange.start.getTime(), allTimeRange.end.getTime(), version, t, walletOrdinals]);
  const points = view?.points ?? [];
  const last = points.at(-1);
  const lastAt = last?.timestamp ?? 0;
  const count = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365, All: Infinity }[range] ?? 30;
  const visible = points.filter((point) => range === "Custom"
    ? point.timestamp >= dateRange.start.getTime() && point.timestamp <= dateRange.end.getTime()
    : point.timestamp >= lastAt - count * 86400000);
  const selectRange = (option: string) => {
    setRange(option);
    if (!last || !onRangeChange) return;
    if (option === "All") {
      onRangeChange(points.length, undefined);
      return;
    }
    const days = ({ "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365, All: Infinity } as Record<string, number>)[option] ?? 30;
    const fromPoint = days === Infinity ? points[0] :
      points.find((point) => point.timestamp >= lastAt - days * 86400000) ?? points[0];
    if (!fromPoint) return;
    onRangeChange(points.filter((point) => point.timestamp >= fromPoint.timestamp).length,
      { from: new Date(fromPoint.timestamp), to: new Date(last.timestamp) });
  };
  const chartPoints = visible.length > 1 ? visible : points.slice(-2);
  const assetChange = btcData;
  const btcPriceByTime = new Map(assetChange?.timestamps.map((time, index) => [time, assetChange.data[index]?.btcPrice ?? 0]) ?? []);
  const latestBtcPrice = btcPriceByTime.get(lastAt) ?? 0;
  const chartRaw = chartPoints.map((point) => btcBase ? (point.totalValue / (btcPriceByTime.get(point.timestamp) ?? 0) || 0) :
    currencyWrapper(currency)(point.totalValue));
  const chartBase = chartRaw[0] ?? 0;
  const chartValues = percentChart ? chartRaw.map((value) => chartBase ? (value / chartBase - 1) * 100 : 0) : chartRaw;
  const formatChartValue = (value: number) => percentChart ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` :
    btcBase ? `₿${value.toFixed(8)}` : `${currency.symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const formatChartTick = (value: number) => percentChart ? `${value.toFixed(0)}%` :
    btcBase ? value.toFixed(1) : `${Math.round(value / 1000)}K`;
  const chartDelta = (chartValues.at(-1) ?? 0) - (chartValues[0] ?? 0);
  const formatChartChange = percentChart ? `${chartDelta > 0 ? "+" : chartDelta < 0 ? "−" : ""}${Math.abs(chartDelta).toFixed(1)}%` :
    btcBase ? `${chartDelta > 0 ? "+" : chartDelta < 0 ? "−" : ""}₿${Math.abs(chartDelta).toFixed(8)}` :
    `${chartDelta > 0 ? "+" : chartDelta < 0 ? "−" : ""}${currency.symbol}${Math.abs(chartDelta).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const first = visible[0] ?? points[0];
  const firstAt = first ? new Date(first.timestamp) : null;
  const current = view?.partial
    ? (view.currentTotal - (view.excluded ?? []).reduce((sum, source) => sum + source.value, 0))
    : view?.currentTotal ?? last?.totalValue ?? 0;
  const change = (point: Point | undefined) => point ? current - point.totalValue : 0;
  const latestChange = total(view?.latest ?? null) - total(view?.prior ?? null);
  const weekChange = total(view?.latest ?? null) - total(view?.week ?? null);
  const monthPoint = points.find((point) => new Date(point.timestamp).getTime() >= lastAt - 30 * 86400000);
  const monthChange = change(monthPoint);
  const ratio = (value: number, base: number) => base ? value / base : 0;
  const priorAssets = assetMap(view?.prior ?? null);
  const weekAssets = assetMap(view?.week ?? null);
  const currentAssets = assetMap(view?.latest ?? null);
  const movers = [...currentAssets.entries()].map(([key, value]) => ({
    key, symbol: key.split(":")[1], value: value.value - (weekAssets.get(key)?.value ?? 0),
  })).sort((a, b) => b.value - a.value);
  const moverPositive = Math.max(0, ...movers.map((item) => item.value));
  const moverNegative = Math.max(0, ...movers.map((item) => -item.value));
  const moverZero = moverNegative / (moverPositive + moverNegative || 1) * 92 + 4;
  const moverUnit = (100 - moverZero - 4) / (moverPositive || 1);
  const byValue = (view?.holdings ?? []).filter((asset) => asset.assetType === "crypto");
  const coins = byValue.map((asset, index) => {
    const key = `${asset.assetType}:${asset.coin}`;
    const previous = priorAssets.get(key);
    const week = weekAssets.get(key);
    const price = asset.value / asset.amount;
    return { ...asset, rank: index + 1, name: names[asset.coin] ?? asset.coin, price,
      day: previous?.amount ? ratio(price - previous.value / previous.amount, previous.value / previous.amount) : null,
      week: week?.amount ? ratio(price - week.value / week.amount, week.value / week.amount) : null };
  }).sort((a, b) => sort === "value" ? b.value - a.value : (b.week ?? -Infinity) - (a.week ?? -Infinity));
  const daily = points.slice(-31).map((point, index, list) => ({
    timestamp: point.timestamp, value: index ? point.totalValue - list[index - 1].totalValue : 0,
  }));
  const best = daily.reduce<(typeof daily)[number] | null>((a, b) => !a || b.value > a.value ? b : a, null);
  const bestContributor = best && view?.latest ? (() => {
    const index = points.findIndex((point) => point.timestamp === best.timestamp);
    const atBest = assetMap(nearest(view.snapshots, best.timestamp));
    const before = index > 0 ? assetMap(nearest(view.snapshots, points[index - 1].timestamp)) : new Map();
    const item = [...atBest.entries()].map(([key, value]) => ({ key, value: value.value - (before.get(key)?.value ?? 0) }))
      .sort((a, b) => b.value - a.value)[0];
    return item ?? null;
  })() : null;
  const high = Math.max(0, ...points.map((point) => point.totalValue));
  const highPoint = points.find((point) => point.totalValue === high);
  const sourceValues = new Map<string, number>();
  for (const asset of view?.latest?.assets ?? []) {
    const wallet = view?.sourceLabels[asset.wallet ?? ""] ?? dash;
    sourceValues.set(wallet, (sourceValues.get(wallet) ?? 0) + asset.value);
  }
  const orderedSources = [...sourceValues].sort((a, b) => b[1] - a[1]);
  const staleSource = statuses.find((source) =>
    (source.status === "failed" || source.status === "stale") && sourceValues.has(source.label));
  const staleValue = staleSource ? sourceValues.get(staleSource.label) ?? 0 : 0;
  const staleTime = staleSource?.lastSuccessAt ? timeLabel(new Date(staleSource.lastSuccessAt)) : dash;
  const staleReason = staleSource?.detail ?? t("fidelity.overview.staleUnknown");
  const available = points.map((point) => new Date(point.timestamp));
  const calendarMonth = month ?? (last ? new Date(last.timestamp) : new Date());
  const firstAvailable = available[0];
  const presetDays: Record<string, number> = { Today: 1, "7 days": 7, "30 days": 30, "90 days": 90, "1 year": 365, "All time": Infinity };
  const pickPreset = (label: string) => {
    setStartDraft(null); setEndDraft(null);
    setPreset(label);
    if (label === "Custom") return;
    const days = presetDays[label];
    const to = available.at(-1) ?? new Date();
    const fromDate = days === Infinity ? available[0] : available.find((date) => date.getTime() >= to.getTime() - (days - 1) * 86400000) ?? available[0];
    setStart(fromDate); setEnd(to); setMonth(to);
  };
  const chooseDay = (day: Date) => {
    setStartDraft(null); setEndDraft(null);
    setPreset("Custom");
    if (!choosingEnd || !start || day < start) { setStart(day); setEnd(null); setChoosingEnd(true); }
    else { setEnd(day); setChoosingEnd(false); }
  };
  const openSheet = () => {
    setStartDraft(null); setEndDraft(null);
    const to = available.at(-1) ?? new Date();
    setStart(available.find((date) => date.getTime() >= to.getTime() - 23 * 86400000) ?? available[0] ?? to);
    setEnd(available.find((date) => date.getTime() >= to.getTime() - 7 * 86400000) ?? to);
    setMonth(to);
    setPreset("Custom");
    setSheetOpen(true);
  };
  const apply = () => {
    if (!start || !end) return;
    onRangeChange?.(available.filter((date) => date >= start && date < nextDay(end)).length, { from: start, to: end });
    setRange("Custom");
    setSheetOpen(false);
  };
  const commitTypedDate = (which: "start" | "end") => {
    const draft = which === "start" ? startDraft : endDraft;
    if (draft === null) return;
    const date = parseTypedDate(draft, locale);
    if (date && (!firstAvailable || date >= new Date(firstAvailable.getFullYear(), firstAvailable.getMonth(), firstAvailable.getDate())) &&
      (which === "start" || !start || date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()))) {
      setPreset("Custom");
      setMonth(date);
      if (which === "start") {
        setStart(date);
        if (end && date > end) setEnd(null);
      } else setEnd(date);
    }
    if (which === "start") setStartDraft(null);
    else setEndDraft(null);
  };
  const selectionStart = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() : 0;
  const selectionEnd = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : 0;
  const calOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7;
  const calDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const dayCells = Array.from({ length: calOffset + calDays }, (_, index) => index < calOffset ? null : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index - calOffset + 1));
  const selectedPoints = points.filter((point) => start && end && point.timestamp >= start.getTime() && point.timestamp < nextDay(end).getTime());
  const selectedChange = selectedPoints.length > 1 ? selectedPoints.at(-1)!.totalValue - selectedPoints[0].totalValue : 0;
  if (status === "loading") return <LoadingOverviewFidelity />;
  if (status === "ready" && view && !view.latest) {
    return <FirstRunFidelity sources={view.sources} currency={currency} onRefresh={onRefresh} />;
  }
  if (status === "ready" && view?.partial && view.latest) {
    return <PartialOverviewFidelity view={view} statuses={statuses} currency={currency} quoteColor={quoteColor} onRefresh={onRefresh}
      withLastKnown={withLastKnown} setWithLastKnown={setWithLastKnown} />;
  }
  return <section className="fd-page fd-overview" data-state={status} data-quote-color={quoteColor}>
    <header className="fd-overview-head">
      <h1>{t("nav.overview")}</h1>
      <p>{status === "ready" && weekChange > 0 ? t("fidelity.overview.gainSummary")
        .replace("{amount}", amt(weekChange, currency, 0))
        .replace("{first}", movers[0]?.symbol ?? dash).replace("{second}", movers[1]?.symbol ?? dash)
        : t("overview.design.summary")}</p>
      <div className="fd-overview-range-row"><div className="fd-range" role="radiogroup" aria-label={t("overview.chartRange")}>
        {["1D", "7D", "30D", "90D", "1Y", "All"].map((option) => <button type="button" role="radio" key={option}
          aria-checked={range === option} onClick={() => selectRange(option)}>{option}</button>)}</div>
        <button type="button" className="fd-overview-clock" aria-label={t("fidelity.overview.customRange")} onClick={openSheet}><Icon name="clock" /></button></div>
    </header>
    {status === "error" && <div className="fd-card fd-empty" role="alert">{t("app.dataLoadFailed")} <button onClick={() => window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT))}>{t("app.retryDataLoad")}</button></div>}
    {status === "ready" && <main className="fd-overview-grid">
      <section className="fd-card fd-overview-hero">
        <div className="fd-overview-hero-head"><span className="fd-label">{t("overview.design.totalValue")}</span></div>
        <strong className="fd-overview-value">{btcBase ? btcData ? `₿${(current / latestBtcPrice || 0).toFixed(8)}` : dash : amt(current, currency)}</strong>
        <span className="fd-sub">{last && t("fidelity.overview.lastSnapshot").replace("{date}", shortDate(new Date(last.timestamp), locale)).replace("{time}", timeLabel(new Date(last.timestamp)))}</span>
        {view?.partial && <span className="fd-overview-partial">{t("history.partial.label")}</span>}
        <div className="fd-overview-kpis">
          {[
            { label: t("fidelity.overview.latest"), value: latestChange, base: total(view?.prior ?? null), date: from(view?.prior ?? null) },
            { label: t("fidelity.overview.sevenDays"), value: weekChange, base: total(view?.week ?? null), date: from(view?.week ?? null) },
            { label: t("fidelity.overview.thirtyDays"), value: monthChange, base: monthPoint?.totalValue ?? 0, date: monthPoint ? new Date(monthPoint.timestamp) : null },
          ].map((item) => <div className="overview-pnl-metric" key={item.label}><span className="fd-label">{item.label}</span><strong className="overview-pnl-metric-value" data-tone={tone(item.value)}>{item.base ? pct(ratio(item.value, item.base)) : dash}</strong>
            <span>{item.base ? amt(item.value, currency, 2, true) : dash}</span><small>{item.date ? t("fidelity.overview.vsDate").replace("{date}", shortDate(item.date, locale)) : dash}</small></div>)}
        </div>
        {btcBase && !btcData ? <div className="fd-empty">{t("common.loading")}</div> :
          chartPoints.length > 1 ? <Chart points={chartPoints} values={chartValues} formatValue={formatChartValue} formatTick={formatChartTick} change={formatChartChange}
          best={!percentChart && !btcBase && best && bestContributor ? { date: new Date(best.timestamp), change: amt(best.value, currency, 0, true), symbol: bestContributor.key.split(":")[1], symbolChange: amt(bestContributor.value, currency, 0, true) } : null} /> : <div className="fd-empty">{t("overview.design.needTwoSnapshots")}</div>}
        <div className="fd-overview-ath"><span><span className="fd-label">{t("overview.design.ath")}</span> <strong>{amt(high, currency)}</strong></span>
          <span>{highPoint && t(highPoint.timestamp === lastAt ? "fidelity.overview.athReached" : "fidelity.overview.athReachedEarlier").replace("{date}", shortDate(new Date(highPoint.timestamp), locale))}</span>
          <span>{pct(ratio(high - current, high), 2, false)} {t("fidelity.overview.belowHigh")}</span></div>
        {!!view?.excluded?.length && <div className="fd-overview-excluded">{t("totalValue.withLastKnown")}: {view.excluded.map((source) => source.provider).join(", ")}</div>}
      </section>
      <section className="fd-card fd-overview-holdings"><div className="fd-card-heading"><h3>{t("overview.design.holdings")}</h3><span>{t("overview.design.assetCount").replace("{count}", String(view?.holdings.length ?? 0))}</span></div>
        {view?.holdings.map((asset) => {
          const key = `${asset.assetType}:${asset.coin}`;
          const old = weekAssets.get(key);
          const oldPrice = old && old.amount ? old.value / old.amount : 0;
          const price = asset.value / asset.amount;
          const change = oldPrice ? ratio(price - oldPrice, oldPrice) : null;
          return <Link className="fd-overview-row" key={key} to={buildAssetDetailsPath({ symbol: asset.coin, assetType: asset.assetType })}>
            <span><b>{asset.coin}</b> <em>{names[asset.coin] ?? ""}</em></span><strong>{amt(asset.value, currency)}</strong>
            <small>{asset.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} <span>{amt(price, currency)}</span> <span>{asset.percentage.toFixed(1)}%</span></small>
            <small data-tone={change === null ? "neutral" : tone(change)}>{change === null ? dash : pct(change, 1)} <i>7D</i></small>
          </Link>;
        })}
      </section>
      {!insightsDismissed && (insightsEnabled
        ? <section className="fd-overview-insights"><InsightsCard currency={currency} overview fidelity />
          {proUser && <span className="fd-overview-pro">{t("fidelity.overview.pro")}</span>}
          <button className="fd-overview-dismiss" type="button" onClick={() => setInsightsDismissed(true)} aria-label={t("insights.dismiss")}>×</button>
        </section>
        : <section className="fd-card fd-overview-insights off"><div className="fd-card-heading"><h3>{t("fidelity.overview.aiInsights")}</h3><span className="fd-overview-pro">{t("fidelity.overview.off")}</span></div>
          <div className="fd-overview-insight-off"><div><b>{t("fidelity.overview.insightsOff")}</b>{t("fidelity.overview.insightsOffDescription")}</div><Link to="/settings/assistant">{t("fidelity.overview.openAiSettings")}</Link></div>
          <footer><span>{t("fidelity.overview.insightsSettingsNote")}</span></footer>
        </section>)}
      <section className="fd-card fd-overview-daily"><div className="fd-card-heading"><h3>{t("overview.design.dailyChange")}</h3><span>{t("fidelity.overview.dailySubtitle")}</span></div>
        <DailyChart daily={daily} currency={currency} quoteColor={quoteColor} />
      </section>
      <section className="fd-card fd-overview-moved"><div className="fd-card-heading"><h3>{t("overview.design.whatMoved")}</h3><span>{t("fidelity.overview.movedSubtitle").replace("{amount}", amt(weekChange, currency, 0, true))}</span></div>
        {movers.map((item) => <Link key={item.key} className="fd-overview-mover" to={buildAssetDetailsPath({ symbol: item.symbol, assetType: item.key.startsWith("stock:") ? "stock" : "crypto" })}>
          <b>{item.symbol}</b><span style={{ "--fd-zero": `${moverZero}%` } as CSSProperties}>{item.value !== 0 && <i data-tone={tone(item.value)} style={item.value > 0
            ? { left: `${moverZero}%`, width: `${item.value * moverUnit}%` }
            : { right: `${100 - moverZero}%`, width: `${-item.value * moverUnit}%` }} />}</span><strong data-tone={tone(item.value)}>{amt(item.value, currency, 0, true)}</strong></Link>)}
      </section>
      <section className="fd-card fd-overview-rank" data-expanded={rankExpanded}><div className="fd-card-heading"><h3>{t("overview.design.topCoins")}</h3><div className="fd-overview-mini"><button aria-pressed={sort === "value"} onClick={() => setSort("value")}>{t("overview.design.byValue")}</button><button aria-pressed={sort === "change"} onClick={() => setSort("change")}>{t("overview.design.byPriceChange")}</button></div></div>
        {coins.slice(0, rankExpanded ? undefined : 3).map((coin) => <Link key={coin.coin} className="fd-overview-row" to={buildAssetDetailsPath({ symbol: coin.coin, assetType: coin.assetType })}>
          <span><b>{coin.name}</b> <em>{coin.coin}</em></span><strong>{amt(coin.value, currency)}</strong>
          <small><span>{t("overview.design.portfolioRank")} #{coin.rank}</span> <span>{amt(coin.price, currency)}</span></small>
          <small><span data-tone={coin.day === null || Math.abs(coin.day) < .0005 ? "neutral" : tone(coin.day)}>{coin.day === null ? dash : pct(coin.day, 1)}</span> 24h · <span data-tone={coin.week === null || Math.abs(coin.week) < .0005 ? "neutral" : tone(coin.week)}>{coin.week === null ? dash : pct(coin.week, 1)}</span> 7D</small></Link>)}
        {coins.length > 3 && <button type="button" className="fd-overview-more" onClick={() => setRankExpanded(!rankExpanded)}>{rankExpanded ? t("overview.design.showFewer") : t("overview.design.showMore").replace("{count}", String(coins.length - 3))} <span style={rankExpanded ? { transform: "rotate(180deg)" } : undefined}><Icon name="chevron" size={14} /></span></button>}
        <p className="fd-overview-note">{t("overview.design.rankNote")}</p>
      </section>
      <section className="fd-card fd-overview-sources"><div className="fd-card-heading"><h3>{t("overview.design.sources")}</h3><span>{t("fidelity.overview.sourceCount").replace("{ok}", String(statuses.filter((source) => source.status === "ok").length)).replace("{all}", String(statuses.length))}</span><button type="button" className="fd-overview-refresh" onClick={() => void onRefresh?.()}><Icon name="refresh" size={14} />{t("fidelity.overview.refreshAll")}</button></div>
        {staleSource && <div className="fd-overview-stale-banner"><ExclamationTriangleIcon className="fd-overview-stale-icon" aria-hidden="true" /><div><b>{t("fidelity.overview.staleTitle").replace("{source}", staleSource.label)}</b><span>{t("fidelity.overview.staleDescription").replace("{reason}", staleReason.endsWith(".") ? staleReason : `${staleReason}.`).replace("{value}", amt(staleValue, currency)).replace("{time}", staleTime)}</span></div></div>}
        {orderedSources.map(([name, value]) => {
          const source = statuses.find((status) => status.label === name);
          const sourceTone = source?.status === "ok" ? "gain" : source?.status ? "loss" : "neutral";
          const isStale = source?.status === "failed" || source?.status === "stale";
          return <div className="fd-overview-source" key={name}><SourceMark className="fd-overview-logo" initialsOnly source={{ ...(view?.sources.find((item) => item.label === name) ?? { sourceId: "", label: name }), kind: source?.kind, provider: source?.provider }} />
            <span><b>{name}</b><small>{source?.kind ? t(`fidelity.overview.kind.${source.kind}`) : t("overview.design.sources")} · {pct(ratio(value, current), 1, false)}</small></span>
            <strong>{amt(value, currency)}</strong><small data-tone={sourceTone}>{isStale ? t("fidelity.overview.staleStatus").replace("{time}", source.lastSuccessAt ? timeLabel(new Date(source.lastSuccessAt)) : dash) : source?.lastSuccessAt ? t("fidelity.overview.updated").replace("{time}", timeLabel(new Date(source.lastSuccessAt))) : dash}</small>
            {isStale && <button type="button" className="fd-overview-retry" onClick={() => requestRefreshSource(source.sourceId)}><Icon name="refresh" size={13} />{t("fidelity.overview.retry")}</button>}</div>;
        })}
      </section>
      <footer className="fd-overview-footer"><i aria-hidden="true" />{t("fidelity.overview.localDatabase")} · {t(`fidelity.overview.sync.${syncStatus.mode}`)}</footer>
    </main>}
    <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={t("fidelity.overview.dateRange")} initialDetent="large" className="fd-sheet fd-overview-date-sheet">
      <div className="fd-overview-chips">{calendarPresets.map((option) => <button key={option.value} type="button" className={preset === option.value ? "selected" : ""} onClick={() => pickPreset(option.value)}>{t(`fidelity.overview.preset.${option.key}`)}</button>)}</div>
      <div className="fd-overview-fields"><label>{t("datePicker.from")}<input aria-label={t("datePicker.from")} value={startDraft ?? (start ? fullDate(start, locale) : "")} onChange={(event) => setStartDraft(event.target.value)} onBlur={() => commitTypedDate("start")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} onClick={() => setChoosingEnd(false)} /></label><label>{t("datePicker.to")}<input aria-label={t("datePicker.to")} value={endDraft ?? (end ? fullDate(end, locale) : "")} onChange={(event) => setEndDraft(event.target.value)} onBlur={() => commitTypedDate("end")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} onClick={() => setChoosingEnd(true)} /></label></div>
      <div className="fd-overview-calendar">
        <div className="fd-overview-calendar-head"><button type="button" aria-label={t("fidelity.overview.previousMonth")} onClick={() => setMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeftIcon aria-hidden="true" /></button><b>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" }).format(calendarMonth)}</b><button type="button" aria-label={t("fidelity.overview.nextMonth")} onClick={() => setMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRightIcon aria-hidden="true" /></button></div>
        <div className="fd-overview-weekdays">{weekdays.map((day) => <span key={day}>{t(`fidelity.calendar.weekday.${day}`)}</span>)}</div>
        <div className="fd-overview-days">{dayCells.map((day, index) => day ? <button type="button" key={index} aria-label={fullDate(day, locale)} disabled={firstAvailable ? day < new Date(firstAvailable.getFullYear(), firstAvailable.getMonth(), firstAvailable.getDate()) : true} data-selected={day.getTime() === selectionStart || day.getTime() === selectionEnd} data-between={day.getTime() > selectionStart && day.getTime() < selectionEnd} data-today={last ? day.toDateString() === new Date(last.timestamp).toDateString() : false} onClick={() => chooseDay(day)}><b>{day.getDate()}</b></button> : <span key={index} />)}</div>
      </div>
      <div className="fd-overview-selection">{start && end && <><span>{t("fidelity.overview.selectionSummary").replace("{start}", shortDate(start, locale)).replace("{end}", fullDate(end, locale)).replace("{count}", String(selectedPoints.length))}</span><strong data-tone={tone(selectedChange)}>{amt(selectedChange, currency, 2, true)} ({pct(ratio(selectedChange, selectedPoints[0]?.totalValue ?? 0))})</strong></>}</div>
      <button type="button" className="fd-overview-apply" disabled={!start || !end} onClick={apply}>{t("fidelity.overview.applyRange")}</button>
      <p className="fd-overview-note">{firstAvailable && t("fidelity.overview.firstSnapshot").replace("{date}", fullDate(firstAvailable, locale))}</p>
      <div className="fd-overview-chart-options">
        <label><span>{t("overview.percentChart")}</span><Switch aria-label={t("overview.percentChart")} checked={percentChart} onCheckedChange={setPercentChart} /></label>
        <label><span>{t("overview.btcBase")}</span><Switch aria-label={t("overview.btcBase")} checked={btcBase} onCheckedChange={setBtcBase} /></label>
      </div>
    </BottomSheet>
  </section>;
}
