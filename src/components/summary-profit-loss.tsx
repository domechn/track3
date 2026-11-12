import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { calculateTotalProfit, queryLatestAssets, queryPNLChartValue, queryTotalValue } from "@/middlelayers/charts";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { cn } from "@/lib/utils";
import bluebird from "bluebird";
import { boundedMonthTimestamps, chooseDateTicks, compactMoney, endLabelPosition, estimatedChartTextWidth, hasProfitLine, summaryProfitAxis } from "./fidelity-data";
import { requestFullRefresh } from "./refresh-request";
import { directionColorVar } from "@/utils/color";
import { splitDirectionLine } from "@/components/direction-line";
import { hasVisibleUnrecordedChange } from "./profit-summary-hints";

type Point = { timestamp: number; value: number | null };
type SummaryData = {
  total: number | null;
  knownTotal: number | null;
  unknownCoins: Awaited<ReturnType<typeof calculateTotalProfit>>["unknownCoins"];
  unrecordedChange: number;
  percentage: number | null | undefined;
  investedCapital: number;
  positions: number;
  currentValue: number;
  up: number;
  down: number;
  points: Point[];
  snapshotTimestamps: number[];
  sampled: boolean;
};

const number = (value: number, decimals = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
const money = (value: number, currency: CurrencyRateDetail, decimals = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${number(Math.abs(currencyWrapper(currency)(value)), decimals)}`;

export default function SummaryProfitLoss({ currency, dateRange, quoteColor, oneSnapshot = false, baseline, rangeLabel = "All", snapshotCount }: {
  currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor; oneSnapshot?: boolean;
  baseline?: Date; rangeLabel?: string; snapshotCount?: number;
}) {
  const { t, locale } = useTranslation();
  const date = (value: Date) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const dataVersion = useDataChangedVersion();
  const [data, setData] = useState<SummaryData>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;

  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(false);
    Promise.all([
      calculateTotalProfit(dateRange),
      queryPNLChartValue(dateRange),
      queryLatestAssets(dateRange),
      queryTotalValue(dateRange),
    ]).then(async ([profit, snapshots, assets, current]) => {
      const lastByMonth = new Map<string, number>();
      for (const point of snapshots) {
        const month = new Date(point.timestamp).toISOString().slice(0, 7);
        lastByMonth.set(month, point.timestamp);
      }
      const points: Point[] = [{ timestamp: (baseline ?? dateRange.start).getTime(), value: 0 }];
      const chartTimestamps = [...lastByMonth.values()];
      if (snapshots.length > 1 && chartTimestamps.length === 1 && snapshots[0].timestamp !== chartTimestamps[0]) {
        chartTimestamps.unshift(snapshots[0].timestamp);
      }
      const boundedTimestamps = boundedMonthTimestamps(chartTimestamps);
      const intervals = await bluebird.map(boundedTimestamps, (timestamp, index) =>
        calculateTotalProfit({
          start: new Date(index === 0 ? dateRange.start.getTime() : boundedTimestamps[index - 1] + 1),
          end: new Date(timestamp),
        }), { concurrency: 4 });
      let runningKnown = 0;
      const monthly = boundedTimestamps.map((timestamp, index) => {
        const interval = intervals[index];
        runningKnown += interval.knownTotal ?? 0;
        return { timestamp, value: interval.total === null && interval.knownTotal === null ? null : runningKnown };
      });
      points.push(...monthly.filter((point) => point.timestamp !== points[0].timestamp));
      const stableCoins = new Set(await new StableCoinsQuery().listAllStableCoins());
      const movers = profit.coins.filter((coin) => !stableCoins.has(coin.symbol));
      if (!active) return;
      setData({
        total: profit.total,
        knownTotal: profit.knownTotal,
        unknownCoins: profit.unknownCoins,
        unrecordedChange: profit.unrecordedChange ?? 0,
        percentage: profit.percentage,
        investedCapital: profit.coins.reduce((sum, coin) => sum + (coin.realSpentValue ?? 0), 0),
        positions: assets.length,
        currentValue: current.totalValue,
        up: movers.filter((coin) => !coin.isUnknown && coin.value !== null && coin.value > 0.005).length,
        down: movers.filter((coin) => !coin.isUnknown && coin.value !== null && coin.value < -0.005).length,
        points,
        snapshotTimestamps: [...(baseline ? [baseline.getTime()] : []), ...snapshots.map((point) => point.timestamp)],
        sampled: boundedTimestamps.length < chartTimestamps.length,
      });
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) reportLoaded();
    });
    return () => { active = false; };
  }, [rangeKey, baseline?.getTime(), dataVersion, retry]);

  const usablePoints = useMemo(() => data?.points.filter((point): point is { timestamp: number; value: number } => point.value !== null) ?? [], [data]);
  const hasLine = hasProfitLine(data?.snapshotTimestamps ?? []) && usablePoints.length >= 2;
  const chartRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(945);
  useEffect(() => {
    if (!hasLine || !chartRef.current || !globalThis.ResizeObserver) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width || 945));
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [hasLine]);
  const axis = summaryProfitAxis(usablePoints.map((point) => point.value));
  const topValue = axis.upper;
  const span = axis.upper - axis.lower;
  const width = chartWidth, height = 215, left = 44, right = 70, top = 26, bottom = 26;
  const x = (index: number) => left + index / Math.max(usablePoints.length - 1, 1) * (width - left - right);
  const y = (value: number) => top + (topValue - value) / span * (height - top - bottom);
  const lineSegments = splitDirectionLine(usablePoints.map((point) => point.value), x, y);
  const ticks = axis.ticks;
  const dateTicks = chooseDateTicks(usablePoints.map((point) => point.timestamp), usablePoints.map((_, index) => x(index)), locale);
  const endValue = usablePoints.at(-1)?.value ?? 0;
  const endText = money(endValue, currency, 0);
  const best = data?.sampled ? undefined : usablePoints.slice(1).map((point, index) => ({ point, index: index + 1, change: point.value - usablePoints[index].value }))
    .sort((a, b) => b.change - a.change)[0];
  const bestText = best ? t("summary.fidelity.bestMonth")
    .replace("{month}", new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { month: "short", year: "numeric" }).format(best.point.timestamp))
    .replace("{amount}", money(best.change, currency, 0)) : "";
  const bestLabelAtRight = Boolean(best && x(best.index) + 4 + estimatedChartTextWidth(bestText) > width - 12);
  const bestLabelX = best ? x(best.index) + (bestLabelAtRight ? -4 : 4) : 0;
  const endPosition = endLabelPosition(x(usablePoints.length - 1), y(endValue), width, endText,
    best ? { x: bestLabelX, y: 17, anchor: bestLabelAtRight ? "end" : "start", label: bestText } : undefined);
  const noComparison = oneSnapshot || (snapshotCount !== undefined && (!baseline || snapshotCount === 0));
  const missingReason = error ? t("summary.fidelity.loadError")
    : oneSnapshot ? t("summary.fidelity.needsSecond")
    : snapshotCount === 0 ? t("summary.fidelity.noSnapshotsRange").replace("{range}", rangeLabel)
    : !baseline && snapshotCount !== undefined ? t("summary.fidelity.noBaselineRange").replace("{range}", rangeLabel)
    : data?.total === null ? t("summary.fidelity.unknownPnlRange").replace("{range}", rangeLabel)
    : data ? t("summary.fidelity.noPnlPointsRange").replace("{range}", rangeLabel)
    : t("summary.fidelity.loadingSubtitle");
  const displayedTotal = data?.total ?? (data?.unknownCoins.length ? data.knownTotal : null);
  const unavailable = noComparison || displayedTotal == null;
  const breakevenUnavailable = unavailable || data?.total == null;
  const tone = unavailable ? "fidelity-faint" : displayedTotal! >= 0
    ? quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"
    : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive";
  const missing = oneSnapshot ? "–" : t("summary.fidelity.notAvailable");
  const percentMissing = data?.percentage === null;
  const percentMissingReason = percentMissing && !unavailable
    ? t("summary.fidelity.unknownPercentRange").replace("{range}", rangeLabel) : missingReason;
  const percentage = data?.percentage;
  const percentageText = unavailable || percentage === null ? missing : percentage === undefined
    ? "∞" : `${percentage >= 0 ? "+" : "−"}${number(Math.abs(percentage))}%`;
  const netPnlFull = displayedTotal == null ? null : money(displayedTotal, currency);
  const netPnlLong = netPnlFull !== null && netPnlFull.length > 12;
  const netPnlText = unavailable || netPnlFull === null ? missing : netPnlLong
    ? `${displayedTotal! > 0 ? "+" : ""}${compactMoney(currencyWrapper(currency)(displayedTotal!), currency.symbol)}`
    : netPnlFull;
  const netPnlTitle = data ? [
    netPnlFull,
    data.unknownCoins.length ? `${t("profitSummary.partial").replace("{n}", String(data.unknownCoins.length))}: ${data.unknownCoins.map((coin) => coin.symbol).join(", ")}` : null,
    hasVisibleUnrecordedChange(data.unrecordedChange, currency)
      ? t("profitSummary.unrecordedChanges").replace("{amount}", money(data.unrecordedChange, currency)) : null,
  ].filter(Boolean).join("\n") : null;
  const snapshotDescription = snapshotCount === undefined ? undefined
    : oneSnapshot && snapshotCount === 1 ? t("summary.fidelity.oneSnapshot")
    : baseline && snapshotCount > 0 && baseline < dateRange.start
      ? t("summary.fidelity.snapshotsSince").replace("{date}", date(baseline)).replace("{count}", String(snapshotCount))
      : snapshotCount === 1 ? t("summary.fidelity.snapshotInRangeOne")
      : t("summary.fidelity.snapshotsInRange").replace("{count}", String(snapshotCount));

  return <section className="fidelity-card fidelity-summary-pnl">
    <div className="fidelity-card-head"><h2>{t("summary.fidelity.profitLoss")}</h2><span>{t("summary.fidelity.netPnlUsd").replace("{currency}", currency.currency)}</span></div>
    <div className="fidelity-kpis fidelity-summary-pnl-kpis">
      <div><span>{rangeLabel === "All" ? t("summary.fidelity.netPnlAll") : t("summary.fidelity.netPnlRange").replace("{range}", rangeLabel)}</span><strong className={cn("big", tone, netPnlLong && "fidelity-long-money")} title={unavailable ? missingReason : netPnlTitle ?? undefined}>{netPnlLong && !unavailable ? <span className="whitespace-nowrap">{netPnlText}</span> : netPnlText}</strong><small>{unavailable ? missingReason : t("summary.fidelity.since").replace("{date}", date(baseline ?? dateRange.start))}</small></div>
      <div><span>{t("summary.fidelity.pnlPercent")}</span><strong className={tone} title={unavailable || percentMissing ? percentMissingReason : undefined}>{percentageText}</strong><small>{unavailable || percentMissing ? percentMissingReason : t("summary.fidelity.onInvested").replace("{amount}", money(data!.investedCapital, currency, 0).replace(/^[+−]/, ""))}</small></div>
      <div><span>{t("summary.fidelity.breakeven")}</span><strong className={breakevenUnavailable ? "fidelity-faint" : undefined} title={breakevenUnavailable ? missingReason : undefined}>{breakevenUnavailable ? missing : money(data.currentValue - data.total!, currency, 0).replace(/^[+−]/, "")}</strong><small>{breakevenUnavailable ? missingReason : t("summary.fidelity.breakevenNote").replace("{symbol}", currency.symbol)}</small></div>
      <div><span>{t("summary.fidelity.positions")}</span><strong>{data?.positions ?? missing}</strong><small title={snapshotDescription}>{data && !oneSnapshot && <><span className={data.up === 0 ? "fidelity-zero" : quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"}>{data.up} {t("summary.fidelity.up")}</span> · <span className={data.down === 0 ? "fidelity-zero" : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive"}>{data.down} {t("summary.fidelity.down")}</span> · {Math.max(0, data.positions - data.up - data.down)} {t("summary.fidelity.flat")}</>}</small></div>
    </div>
    {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
      !hasLine ? <div className="fidelity-empty fidelity-summary-chart-empty"><div>{missingReason || t("summary.fidelity.lineStarts")}</div><button type="button" onClick={requestFullRefresh}><svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3" /></svg>{t("summary.fidelity.refreshNow")}</button></div> :
      <>
        <p className="fidelity-caption">{t("summary.fidelity.chartCaption").replace("{date}", date(baseline ?? dateRange.start))}</p>
        <svg ref={chartRef} className="fidelity-summary-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("summary.fidelity.chartCaption").replace("{date}", date(baseline ?? dateRange.start))}>
          {ticks.map((tick, index) => <g key={index}><line x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke="hsl(var(--border))" shapeRendering="crispEdges" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="hsl(var(--faint))" fontSize="12">{compactMoney(currencyWrapper(currency)(tick), currency.symbol).replace(currency.symbol, "")}</text></g>)}
          {lineSegments.map(({ start, end, value }, index) => <line key={index} data-direction={value > 0 ? "gain" : value < 0 ? "loss" : "neutral"}
            x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={directionColorVar(value, quoteColor)} strokeWidth="2" />)}
          {usablePoints.map((point, index) => {
            const label = `${date(new Date(point.timestamp))}: ${money(point.value, currency)}`;
            return <circle key={point.timestamp} data-point cx={x(index)} cy={y(point.value)} r="6" fill="transparent" role="img" tabIndex={0} aria-label={label}><title>{label}</title></circle>;
          })}
          {best && <g><line x1={x(best.index)} x2={x(best.index)} y1="9" y2={height-bottom} stroke="hsl(var(--faint))" opacity=".45" strokeWidth="1" shapeRendering="crispEdges" /><text x={bestLabelX} y="17" textAnchor={bestLabelAtRight ? "end" : "start"} fill="hsl(var(--faint))" fontSize="11">{bestText}</text></g>}
          {dateTicks.map(({ index, x: tickX, anchor, label }) =>
            <text key={index} data-date-tick="" x={tickX} y={height - 8} textAnchor={anchor} fill="hsl(var(--faint))" fontSize="12">{label}</text>)}
          <text data-direction-end="" x={endPosition.x} y={endPosition.y}
            textAnchor="end" fill={directionColorVar(endValue, quoteColor)}
            fontSize="12" fontWeight="600">{endText}</text>
        </svg>
      </>}
  </section>;
}
