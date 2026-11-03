import { useContext, useEffect, useMemo, useState } from "react";
import { calculateTotalProfit, queryLatestAssets, queryPNLChartValue, queryTotalValue } from "@/middlelayers/charts";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { cn } from "@/lib/utils";
import bluebird from "bluebird";
import { axisForValues, boundedMonthTimestamps, compactMoney, hasProfitLine } from "./fidelity-data";
import { requestFullRefresh } from "./refresh-request";

type Point = { timestamp: number; value: number | null };
type SummaryData = {
  total: number | null;
  percentage: number | null | undefined;
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

export default function SummaryProfitLoss({ currency, dateRange, quoteColor, oneSnapshot = false }: {
  currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor; oneSnapshot?: boolean;
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
    setError(false);
    Promise.all([
      calculateTotalProfit(dateRange),
      queryPNLChartValue(dateRange),
      queryLatestAssets(),
      queryTotalValue(dateRange),
    ]).then(async ([profit, snapshots, assets, current]) => {
      const lastByMonth = new Map<string, number>();
      for (const point of snapshots) {
        const month = new Date(point.timestamp).toISOString().slice(0, 7);
        lastByMonth.set(month, point.timestamp);
      }
      const points: Point[] = [{ timestamp: dateRange.start.getTime(), value: 0 }];
      const chartTimestamps = [...lastByMonth.values()];
      if (snapshots.length > 1 && chartTimestamps.length === 1 && snapshots[0].timestamp !== chartTimestamps[0]) {
        chartTimestamps.unshift(snapshots[0].timestamp);
      }
      const boundedTimestamps = boundedMonthTimestamps(chartTimestamps);
      const monthly = await bluebird.map(boundedTimestamps, async (timestamp) => {
        const cumulative = await calculateTotalProfit({ start: dateRange.start, end: new Date(timestamp) });
        return { timestamp, value: cumulative.total };
      }, { concurrency: 4 });
      points.push(...monthly);
      const stableCoins = new Set(await new StableCoinsQuery().listAllStableCoins());
      const movers = profit.coins.filter((coin) => !stableCoins.has(coin.symbol));
      if (!active) return;
      setData({
        total: profit.total,
        percentage: profit.percentage,
        positions: assets.length,
        currentValue: current.totalValue,
        up: movers.filter((coin) => coin.value !== null && coin.value > 0.005).length,
        down: movers.filter((coin) => coin.value !== null && coin.value < -0.005).length,
        points,
        snapshotTimestamps: snapshots.map((point) => point.timestamp),
        sampled: boundedTimestamps.length < chartTimestamps.length,
      });
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) reportLoaded();
    });
    return () => { active = false; };
  }, [rangeKey, dataVersion, retry]);

  const usablePoints = useMemo(() => data?.points.filter((point): point is { timestamp: number; value: number } => point.value !== null) ?? [], [data]);
  const hasLine = hasProfitLine(data?.snapshotTimestamps ?? []) && usablePoints.length > 2;
  const axis = axisForValues(usablePoints.map((point) => point.value));
  const topValue = axis.upper;
  const span = axis.upper - axis.lower;
  const width = 945, height = 215, left = 44, right = 70, top = 26, bottom = 26;
  const x = (index: number) => left + index / Math.max(usablePoints.length - 1, 1) * (width - left - right);
  const y = (value: number) => top + (topValue - value) / span * (height - top - bottom);
  const ticks = axis.ticks;
  const best = data?.sampled ? undefined : usablePoints.slice(1).map((point, index) => ({ point, index: index + 1, change: point.value - usablePoints[index].value }))
    .sort((a, b) => b.change - a.change)[0];
  const tone = oneSnapshot || data?.total == null ? "fidelity-faint" : data.total >= 0
    ? quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"
    : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive";
  const missing = "–";

  return <section className="fidelity-card fidelity-summary-pnl">
    <div className="fidelity-card-head"><h2>{t("summary.fidelity.profitLoss")}</h2><span>{t("summary.fidelity.netPnlUsd").replace("{currency}", currency.currency)}</span></div>
    <div className="fidelity-kpis fidelity-summary-pnl-kpis">
      <div><span>{t("summary.fidelity.netPnlAll")}</span><strong className={cn("big", tone)}>{oneSnapshot || data?.total == null ? missing : money(data.total, currency)}</strong><small>{oneSnapshot || data?.total == null ? t("summary.fidelity.needsSecond") : t("summary.fidelity.since").replace("{date}", date(dateRange.start))}</small></div>
      <div><span>{t("summary.fidelity.pnlPercent")}</span><strong className={tone}>{oneSnapshot || data?.total == null || data.percentage === null ? missing : data.percentage === undefined ? "∞" : `${data.percentage >= 0 ? "+" : "−"}${number(Math.abs(data.percentage))}%`}</strong><small>{oneSnapshot || data?.total == null ? t("summary.fidelity.investedCapital") : t("summary.fidelity.onInvested").replace("{amount}", money(data.currentValue - data.total, currency, 0).replace(/^[+−]/, ""))}</small></div>
      <div><span>{t("summary.fidelity.breakeven")}</span><strong className={oneSnapshot || data?.total == null ? "fidelity-faint" : undefined}>{oneSnapshot || data?.total == null ? missing : money(data.currentValue - data.total, currency, 0).replace(/^[+−]/, "")}</strong><small>{t("summary.fidelity.breakevenNote").replace("{symbol}", currency.symbol)}</small></div>
      <div><span>{t("summary.fidelity.positions")}</span><strong>{data?.positions ?? missing}</strong><small>{oneSnapshot || data?.total == null ? t("summary.fidelity.oneSnapshot") : <><span className={data.up === 0 ? "fidelity-zero" : quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"}>{data.up} {t("summary.fidelity.up")}</span> · <span className={data.down === 0 ? "fidelity-zero" : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive"}>{data.down} {t("summary.fidelity.down")}</span> · {Math.max(0, data.positions - data.up - data.down)} {t("summary.fidelity.flat")}</>}</small></div>
    </div>
    {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
      !hasLine ? <div className="fidelity-empty fidelity-summary-chart-empty"><div>{t("summary.fidelity.lineStarts")}</div><button type="button" onClick={requestFullRefresh}><svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3" /></svg>{t("summary.fidelity.refreshNow")}</button></div> :
      <>
        <p className="fidelity-caption">{t("summary.fidelity.chartCaption").replace("{date}", date(dateRange.start))}</p>
        <svg className="fidelity-summary-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={t("summary.fidelity.chartCaption").replace("{date}", date(dateRange.start))}>
          {ticks.map((tick, index) => <g key={index}><line x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke="#262629" shapeRendering="crispEdges" /><text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#9b9da3" fontSize="12">{compactMoney(currencyWrapper(currency)(tick), currency.symbol).replace(currency.symbol, "")}</text></g>)}
          <polyline points={usablePoints.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")} fill="none" stroke="#4a8ad6" strokeWidth="2" />
          {usablePoints.map((point, index) => {
            const label = `${date(new Date(point.timestamp))}: ${money(point.value, currency)}`;
            return <circle key={point.timestamp} data-point cx={x(index)} cy={y(point.value)} r="6" fill="transparent" role="img" tabIndex={0} aria-label={label}><title>{label}</title></circle>;
          })}
          {best && <g><line x1={x(best.index)} x2={x(best.index)} y1="9" y2={height-bottom} stroke="#9b9da3" opacity=".45" strokeWidth="1" shapeRendering="crispEdges" /><text x={x(best.index)+4} y="17" fill="#9b9da3" fontSize="11">{t("summary.fidelity.bestMonth").replace("{month}", new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { month: "short", year: "numeric" }).format(best.point.timestamp)).replace("{amount}", money(best.change, currency, 0))}</text></g>}
          {usablePoints.filter((_, index) => index === 0 || index === usablePoints.length - 1 || index % Math.max(1, Math.floor(usablePoints.length / 4)) === 0).map((point) => {
            const index = usablePoints.indexOf(point);
            return <text key={index} x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === usablePoints.length - 1 ? "end" : "middle"} fill="#9b9da3" fontSize="12">{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { ...(index === 0 ? { day: "numeric" as const } : {}), month: "short", year: "2-digit" }).format(point.timestamp)}</text>;
          })}
          <text x={x(usablePoints.length - 1) + 6} y={y(usablePoints.at(-1)!.value) + 4} textAnchor="start" fill="#fff" fontSize="12" fontWeight="600">{money(usablePoints.at(-1)!.value, currency, 0).replace(/^[+−]/, "")}</text>
        </svg>
      </>}
  </section>;
}
