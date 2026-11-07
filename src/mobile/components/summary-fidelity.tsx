import { useEffect, useMemo, useState } from "react";
import type { CurrencyRateDetail, QuoteColor, TDateRange, TotalValuesData } from "@/middlelayers/types";
import { queryTotalValues, queryHistoricalData, calculateTotalProfit } from "@/middlelayers/charts";
import { queryPreviousProfitSnapshotDate } from "@/middlelayers/charts-profit";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import type { AttributionResult } from "@/middlelayers/charts-attribution";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/mobile/i18n";
import { BottomSheet } from "@/mobile/components/mobile";
import TopCoinsRank from "@/mobile/components/top-coins-rank";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { currencyWrapper } from "@/utils/currency";
import { listAllFirstAndLastDays } from "@/utils/date";
import { AttributionPager, useAttributionPage } from "@/components/attribution-pager";
import { PartialProfitHint, PnlPercentHint } from "@/components/profit-summary-hints";
import { attributionAmount, attributionCompactAmount, attributionRange } from "@/components/attribution-amount";
import { FittingAttributionAmount } from "@/components/fitting-attribution-amount";
import { useFittingAttributionTicks } from "@/components/use-fitting-attribution-ticks";
import { SummaryTopList } from "@/components/summary-top-list";
import { marketProfitPercentage } from "@/components/profit-percentage";
import "@/mobile/components/mobile/fidelity.css";

type Profit = Awaited<ReturnType<typeof calculateTotalProfit>>;
type ChartProfit = Pick<Profit, "total" | "knownTotal" | "unknownCoins">;
type Month = { date: Date; end: number; profit: number | null; knownTotal: number | null; percentage: number | null | undefined; flow: number; up: number; down: number; flat: number; hasData: boolean; gapDate?: Date; unknownCoins: Profit["unknownCoins"] };
type Year = { year: number; profit: Profit; start: Date; end: Date; endingValue: number; months: number; flow: number | null };
type Display = { values: TotalValuesData; months: Month[]; years: Year[]; chart: ChartProfit[]; profit: Profit; attribution: AttributionResult; assets: number; sources: number; stableSymbols: string[]; coinValues: Record<string, number>; yearMoves: Record<number, { up: number; down: number }> };
const dash = "–";
async function mapAtMostFour<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  }));
  return results;
}
const formatDate = (date: Date, opts: Intl.DateTimeFormatOptions, locale = "en") =>
  new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", opts).format(date).replace(/\bSept\b/g, "Sep");
const money = (value: number, symbol: string, digits = 2, signed = false) =>
  `${signed ? value > 0 ? "+" : value < 0 ? "−" : "" : value < 0 ? "−" : ""}${symbol}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const percent = (value: number, digits = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const tone = (value: number | null) => value === null || value === 0 ? "neutral" : value > 0 ? "gain" : "loss";

function Heading({ title, right }: { title: string; right?: string }) {
  return <div className="fd-card-heading"><h3>{title}</h3>{right && <span>{right}</span>}</div>;
}
function RefreshIcon({ size }: { size: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3" /></svg>;
}
function Empty({ children, refresh = false }: { children: React.ReactNode; refresh?: boolean }) {
  const { t } = useTranslation();
  return <div className="fd-empty"><p>{children}</p>{refresh && <button type="button" className="fd-primary-pill" onClick={() => window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT))}><RefreshIcon size={14} />{t("fidelity.summary.refreshNow")}</button>}</div>;
}
function Skeleton({ width, height = 12 }: { width: string; height?: number }) {
  return <span className="fd-skeleton" style={{ width, height }} aria-hidden="true" />;
}
function LineChart({ values, dates, label, symbol, formatMonth, bestMonthText, focusedMonth, approximate }: { values: number[]; dates: Date[]; label: string; symbol: string; formatMonth: (date: Date) => string; bestMonthText: string; focusedMonth: Date | null; approximate?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (focusedMonth) {
      const index = dates.findIndex((date) => date.getTime() === focusedMonth.getTime());
      setSelected(index >= 0 ? index : null);
    }
  }, [focusedMonth, dates.length]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const rawStep = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).find(n => n >= rawStep) ?? 10 * magnitude;
  const tickMin = Math.floor(min / step) * step;
  let tickMax = Math.ceil(max / step) * step;
  if (tickMax <= max) tickMax += step;
  const ticks = Array.from({ length: Math.round((tickMax - tickMin) / step) + 1 }, (_, i) => tickMin + i * step);
  const tickLabel = (n: number) => n === 0 ? "0" : `${Math.round(n / 1000)}K`;
  const endLabel = `${approximate ? "~" : ""}${money(values.at(-1) ?? 0, symbol, 0)}`;
  const padL = 12 + Math.max(...ticks.map(n => tickLabel(n).length * 8));
  const padR = 10 + endLabel.length * 7.5;
  const x = (i: number) => padL + i / Math.max(values.length - 1, 1) * (324 - padL - padR);
  const y = (v: number) => 164 - (v - tickMin) / (tickMax - tickMin) * 138;
  const bestMonth = values.reduce((best, value, index) =>
    index && value - values[index - 1] > values[best] - values[Math.max(0, best - 1)] ? index : best, 1);
  const scrub = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = (event.clientX - rect.left) / rect.width * 324;
    setSelected(values.reduce((best, _, index) => Math.abs(x(index) - pointer) < Math.abs(x(best) - pointer) ? index : best, 0));
  };
  return <svg className="fd-summary-chart" viewBox="0 0 324 190" role="img" aria-label={label} onPointerMove={scrub} onPointerDown={scrub}>
    {ticks.map(n => <g key={n}><line x1={padL} x2="324" y1={y(n)} y2={y(n)} stroke="var(--fd-border)" /><text x={padL-8} y={y(n)+4} fill="var(--fd-faint)" textAnchor="end" fontSize="12">{tickLabel(n)}</text></g>)}
    <line x1={x(bestMonth)} x2={x(bestMonth)} y1="9" y2="26" stroke="var(--fd-faint)" strokeWidth="1" opacity=".45" shapeRendering="crispEdges" /><line x1={x(bestMonth)} x2={x(bestMonth)} y1="26" y2="164" stroke="var(--fd-faint)" strokeWidth="1" opacity=".45" shapeRendering="crispEdges" />
    <text x={x(bestMonth)+4} y="17" fill="var(--fd-muted)" fontSize="11">{bestMonthText}</text>
    <path fill="none" stroke="var(--fd-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" d={values.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")} />
    {selected !== null && <g className="fd-chart-chip" role="status" aria-live="polite" transform={`translate(${Math.min(164, Math.max(0, x(selected) - 70))},36)`}>
      <rect width="160" height="26" rx="13" fill="var(--fd-raised)" stroke="var(--fd-control)" />
      <text x="80" y="17" textAnchor="middle" fill="var(--fd-text)" fontSize="11">{formatMonth(dates[selected])} {dates[selected].getFullYear()} · {money(values[selected],symbol,0,true)}</text>
    </g>}
    <text x={x(0)} y="182" fill="var(--fd-faint)" fontSize="12">{dates.length ? `${dates[0].getDate()} ${formatMonth(dates[0])} ${String(dates[0].getFullYear()).slice(2)}` : ""}</text>
    {dates.length > 2 && <text x={x(Math.floor((dates.length-1)/2))} y="182" fill="var(--fd-faint)" textAnchor="middle" fontSize="12">{formatMonth(dates[Math.floor((dates.length-1)/2)])} {String(dates[Math.floor((dates.length-1)/2)].getFullYear()).slice(2)}</text>}
    <text x={x(values.length-1)} y="182" fill="var(--fd-faint)" textAnchor="end" fontSize="12">{dates.length ? formatMonth(dates.at(-1)!) + " " + String(dates.at(-1)!.getFullYear()).slice(2) : ""}</text>
    <text x={x(values.length-1)+6} y={y(values.at(-1) ?? 0)+4} fill="var(--fd-text)" fontSize="12" fontWeight="600">{endLabel}</text>
  </svg>;
}

export default function SummaryFidelity({ currency, dateRange, quoteColor, checking = false }: { currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor; checking?: boolean }) {
  const { t, locale } = useTranslation();
  const axisRef = useFittingAttributionTicks();
  const cash = (value: number, digits = 2, signed = false) =>
    money(currencyWrapper(currency)(value), currency.symbol, digits, signed);
  const dateLabel = (value: Date) => formatDate(value, { day: "numeric", month: "short", year: "numeric" }, locale);
  const dateTimeLabel = (value: Date) => formatDate(value, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }, locale);
  const monthLabel = (value: Date) => formatDate(value, { month: "short" }, locale);
  const monthYearLabel = (value: Date) => formatDate(value, { month: "short", year: "numeric" }, locale);
  const version = useDataChangedVersion();
  const [display, setDisplay] = useState<Display | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [range, setRange] = useState("All");
  const [rankOpen, setRankOpen] = useState(false);
  const [focusedMonth, setFocusedMonth] = useState<Date | null>(null);
  const [selectedStats, setSelectedStats] = useState<{ range: string; total: number | null; percentage: number | null | undefined } | null>(null);
  const key = `${dateRange.start.getTime()}-${dateRange.end.getTime()}-${version}`;
  useEffect(() => {
    if (checking) {
      setStatus("loading");
      setDisplay(null);
      return;
    }
    let active = true;
    setStatus("loading");
    setDisplay(null);
    (async () => {
      const [values, historical, stableSymbols] = await Promise.all([
        queryTotalValues(dateRange),
        queryHistoricalData(1, false, { includeTransactions: false }),
        new StableCoinsQuery().listAllStableCoins(),
      ]);
      const lastAssets = historical[0]?.assets ?? [];
      const coinValues: Record<string, number> = {};
      for (const asset of lastAssets) coinValues[`${asset.assetType}:${asset.symbol}`] =
        (coinValues[`${asset.assetType}:${asset.symbol}`] ?? 0) + asset.value;
      const endpoints = new Map<string, typeof values[number]>();
      for (const value of values) endpoints.set(`${new Date(value.timestamp).getFullYear()}-${String(new Date(value.timestamp).getMonth() + 1).padStart(2, "0")}`, value);
      const ordered = [...endpoints.values()].sort((a, b) => a.timestamp - b.timestamp);
      const calendar = listAllFirstAndLastDays(dateRange.start, dateRange.end);
      const attributionPromise = queryAttribution(dateRange);
      const profitPromise = calculateTotalProfit(dateRange);
      const monthly = await mapAtMostFour(calendar, async ({ firstDay, lastDay }) => {
        const result = await calculateTotalProfit({ start: firstDay, end: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999) });
        const baseline = result.lastRecordDate ? await queryPreviousProfitSnapshotDate(firstDay) : undefined;
        return { firstDay, result, baseline };
      });
      const months = monthly.map(({ firstDay, result, baseline }) => {
        const end = ordered.find((value) => {
          const date = new Date(value.timestamp);
          return date.getFullYear() === firstDay.getFullYear() && date.getMonth() === firstDay.getMonth();
        });
        const changes = result.coins.filter((coin) => !stableSymbols.includes(coin.symbol)).map((coin) => coin.value);
        return {
          date: end ? new Date(end.timestamp) : firstDay, end: end?.totalValue ?? 0,
          profit: result.total, knownTotal: result.knownTotal,
          percentage: result.total === null ? result.percentage
            : end && end.totalValue !== result.total ? result.total / (end.totalValue - result.total) * 100 : result.percentage,
          flow: 0, hasData: Boolean(result.lastRecordDate), unknownCoins: result.unknownCoins,
          gapDate: baseline && baseline < new Date(firstDay.getFullYear(), firstDay.getMonth() - 1, 1) ? baseline : undefined,
          up: changes.filter((value) => value !== null && value > .005).length,
          down: changes.filter((value) => value !== null && value < -.005).length,
          flat: changes.filter((value) => value !== null && Math.abs(value) <= .005).length,
        };
      });
      for (let index = 0; index < months.length; index++) {
        const month = months[index];
        if (month.hasData && month.profit !== null) {
          const prior = months.slice(0, index).reverse().find((item) => item.hasData);
          month.flow = month.end - (prior?.end ?? values[0]?.totalValue ?? 0) - month.profit;
        }
      }
      const [attribution, profit] = await Promise.all([attributionPromise, profitPromise]);
      const plotted = months.filter((month) => month.hasData);
      let running = 0;
      let runningKnown = 0;
      let unknown = false;
      const chart: ChartProfit[] = plotted.map((month) => {
        running += month.profit ?? month.knownTotal ?? 0;
        runningKnown += month.knownTotal ?? 0;
        unknown ||= month.profit === null;
        return { total: unknown ? null : running, knownTotal: runningKnown, unknownCoins: month.unknownCoins };
      });
      if (chart.length) chart[chart.length - 1] = profit;
      const eligibleYears = [...new Set(calendar.map(({ firstDay }) => firstDay.getFullYear()))]
        .filter((year) => {
          const inYear = values.filter((value) => new Date(value.timestamp).getFullYear() === year);
          return inYear.length > 0 && (inYear.length >= 2 || values.some((value) => value.timestamp < new Date(year, 0, 1).getTime()));
        });
      const years = await mapAtMostFour(eligibleYears, async (year) => {
          const start = new Date(year, 0, 1), end = new Date(year, 11, 31, 23, 59, 59, 999);
          const result = await calculateTotalProfit({ start, end });
          const ms = months.filter((month) => month.date.getFullYear() === year);
          return { year, profit: result, start: ms[0].date, end: ms.at(-1)!.date,
            endingValue: ms.at(-1)!.end, months: ms.length,
            flow: result.total === null ? null : ms.reduce((sum, month) => sum + month.flow, 0) };
        });
      const yearMoves: Record<number, { up: number; down: number }> = {};
      for (const item of years) {
        const changes = item.profit.coins.filter((coin) => !stableSymbols.includes(coin.symbol)).map((coin) => coin.value);
        yearMoves[item.year] = { up: changes.filter((value) => value !== null && value > .005).length,
          down: changes.filter((value) => value !== null && value < -.005).length };
      }
      if (!active) return;
      setDisplay({ values, months, years, chart, profit, attribution: attribution.attribution,
        assets: new Set(lastAssets.map((a) => `${a.assetType}:${a.symbol}`)).size,
        sources: new Set(lastAssets.map((a) => a.wallet)).size, stableSymbols, coinValues, yearMoves });
      setStatus("ready");
    })().catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [key, checking]);
  const loading = status === "loading";
  const empty = status === "ready" && (display?.values.length ?? 0) <= 1;
  const values = display?.values ?? [];
  const first = values[0], last = values.at(-1);
  const firstDate = first ? new Date(first.timestamp) : dateRange.start;
  const lastDate = last ? new Date(last.timestamp) : dateRange.end;
  const rangeDays: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };
  const selectedStart = new Date(Math.max(firstDate.getTime(), lastDate.getTime() - (rangeDays[range] ?? 0) * 86_400_000));
  useEffect(() => {
    if (status !== "ready" || range === "All") return;
    let active = true;
    setSelectedStats(null);
    calculateTotalProfit({ start: selectedStart, end: lastDate }).then((result) => {
      if (active) setSelectedStats({ range, total: result.total, percentage: result.percentage });
    }).catch(() => { if (active) setSelectedStats({ range, total: null, percentage: null }); });
    return () => { active = false; };
  }, [status, range, selectedStart.getTime(), lastDate.getTime(), version]);
  const full = display?.attribution;
  const pnl = display?.profit.total ?? null;
  const gain = (last?.totalValue ?? 0) - (first?.totalValue ?? 0);
  const flow = pnl === null ? null : gain - pnl;
  const shownPnl = range === "All" ? pnl : selectedStats?.range === range ? selectedStats.total : null;
  const allInvested = pnl === null ? null : (last?.totalValue ?? 0) - pnl;
  const shownPercentage = range === "All" ? allInvested ? pnl! / allInvested : null
    : selectedStats?.range === range && selectedStats.percentage != null ? selectedStats.percentage / 100 : null;
  const shownInvested = range === "All" ? allInvested
    : shownPnl !== null && shownPercentage ? shownPnl / shownPercentage : null;
  const selectedMonths = display?.months.filter((m) => m.date.getFullYear() === lastDate.getFullYear()) ?? [];
  const years = display?.years.slice().reverse() ?? [];
  const peak = values.reduce((best, v) => v.totalValue > best.totalValue ? v : best, values[0] ?? { timestamp: 0, totalValue: 0 });
  const peakIndex = values.indexOf(peak);
  const previousHigh = peakIndex > 0 ? values.slice(0, peakIndex).reduce((best, v) => v.totalValue > best.totalValue ? v : best) : null;
  const lowestSince = peakIndex < values.length - 1 ? values.slice(peakIndex + 1).reduce((best, v) => v.totalValue < best.totalValue ? v : best) : null;
  const distance = (last?.totalValue ?? 0) - peak.totalValue;
  const grouped = useMemo(() => {
    const map = new Map<string, { market: number; flow: number; total: number }>();
    for (const a of full?.entries ?? []) {
      const row = map.get(a.symbol) ?? { market: 0, flow: 0, total: 0 };
      row.market += a.priceEffect; row.flow += a.flowEffect + a.residual; row.total += a.totalChange;
      map.set(a.symbol, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [full]);
  const attributionPaging = useAttributionPage(grouped, `${dateRange.start.getTime()}-${dateRange.end.getTime()}:${range}`);
  const attrRange = attributionRange(first?.totalValue ?? 0, last?.totalValue ?? 0, currency, locale);
  const attrEndpoints = grouped.flatMap(([, row]) => [0, row.market, row.market + row.flow]);
  const attrMin = Math.min(0, ...attrEndpoints);
  const attrMax = Math.max(0, ...attrEndpoints);
  const attrSpan = Math.max(1, attrMax - attrMin);
  const rawTickStep = attrSpan / 4;
  const tickMagnitude = 10 ** Math.floor(Math.log10(rawTickStep));
  const tickStep = ([1, 2, 2.5, 5, 10].map((step) => step * tickMagnitude).find((step) => step >= rawTickStep) ?? 10 * tickMagnitude);
  const attrTicks = Array.from({ length: Math.ceil(attrMax / tickStep) + 1 }, (_, index) => index * tickStep);
  const attrStart = attrMin - attrSpan * .05;
  const attrEnd = Math.max(attrMax + attrSpan * .05, attrTicks.at(-1) ?? 0);
  const attrScale = (value: number) => (value - attrStart) / (attrEnd - attrStart) * 100;
  const flowStart = (row: { market: number; flow: number }) => row.market < 0 && row.flow > 0 ? 0 : row.market;
  const monthPercentMax = Math.max(...(display?.months ?? []).map((month) => Math.abs((month.percentage ?? 0) / 100)), 1e-9);
  const moving = (display?.profit.coins ?? []).filter((coin) => !display?.stableSymbols.includes(coin.symbol));
  const positionCounts = { up: moving.filter((coin) => coin.value !== null && coin.value > .005).length,
    down: moving.filter((coin) => coin.value !== null && coin.value < -.005).length,
    flat: Math.max(0, (display?.assets ?? 0) - moving.filter((coin) => coin.value === null || Math.abs(coin.value) > .005).length) };
  const yearsLabel = String(lastDate.getFullYear());
  const pnlText = pnl === null ? dash : cash(pnl, 0, true);
  const sub = loading ? t("fidelity.summary.loading") : empty ? t("fidelity.summary.oneSnapshot") :
    t("fidelity.summary.explainer.dynamic").replace("{pnl}", pnlText).replace("{gain}", cash(gain, 0)).replace("{flow}", flow === null ? dash : cash(flow, 0)).replace("{date}", monthYearLabel(firstDate));
  const subParts = sub.split(pnlText);
  const title = (key: string) => t(`fidelity.summary.${key}`);
  const profitText = (value: number | null, known: number | null, coins: Profit["unknownCoins"]) =>
    value === null ? known !== null && coins.length ? cash(known, 0, true) : "—" : cash(value, 0, true);
  const partialBadge = (coins: Profit["unknownCoins"], period: string, year = false) =>
    <PartialProfitHint names={coins.map((coin) => coin.symbol)} period={period} t={t}
      className={`fd-partial-badge${year ? " fd-year-badge" : ""}`} />;
  const emptyCopy = t("fidelity.summary.oneSnapshot.rich").split("**");
  const card = (children: React.ReactNode, className = "") => <section className={`fd-card ${className}`}>{children}</section>;
  const placeholder = (text: string, height: number) => <div className="fd-empty" style={{ minHeight: height }}>{text}</div>;
  return <div className="fd-page fd-summary d2-summary" data-state={status} data-empty={empty} data-quote-color={quoteColor} aria-busy={loading}>
    <header className="fd-page-head"><h1>{t("summary.design.title")}</h1><p>{empty ? <>{emptyCopy[0]}<strong>{emptyCopy[1]}</strong>{emptyCopy[2]}</> : subParts.length === 2 ? <>{subParts[0]}<strong>{pnlText}</strong>{subParts[1]}</> : sub}</p>
      <div className="fd-actions"><div className="fd-range" role="radiogroup" aria-label={title("range")}>{["1D", "7D", "30D", "90D", "1Y", "All"].map((option) => <button type="button" role="radio" aria-checked={(empty ? "1D" : range) === option} disabled={loading || empty} onClick={() => setRange(option)} key={option}>{option}</button>)}</div>
      <button type="button" className={`fd-refresh ${loading ? "fd-refresh-loading" : ""}`} disabled={loading} aria-label={title("refresh")} onClick={() => window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT))}><RefreshIcon size={loading ? 14 : 16} />{loading && <span>{title("refresh")}</span>}</button></div></header>
    {status === "error" && <p role="alert">{title("error")}</p>}
    {card(<><Heading title={title("profitLoss")} />
      {loading ? <><div className="fd-primary-stat"><Skeleton width="60%" /><Skeleton width="80%" height={24} /><Skeleton width="50%" /></div><div className="fd-kpis fd-three">{[0,1,2].map(i=><div key={i}><Skeleton width="60%" /><Skeleton width="75%" height={24} /><Skeleton width="50%" /></div>)}</div><div className="fd-block" style={{ height: 190 }} /></>
      : <><div className="fd-primary-stat"><span className="fd-label">{range === "All" ? title("netPnl") : title("netPnl.range").replace("{range}", range)}</span><strong data-tone={empty ? "neutral" : tone(shownPnl)}>{empty || shownPnl === null ? dash : cash(shownPnl, 2, true)}</strong><small>{empty ? title("needsSecond") : t("profitSummary.since").replace("{date}", dateLabel(range === "All" ? firstDate : selectedStart))}</small></div>
      <div className="fd-kpis fd-three"><div><span className="fd-label">{title("pnlPercent")}</span><strong data-tone={empty ? "neutral" : tone(shownPercentage)}>{empty || shownPercentage === null ? dash : percent(shownPercentage)}</strong><small>{empty ? title("onCapital") : title("onAmount").replace("{amount}", shownInvested === null ? dash : cash(shownInvested, 0))}</small></div><div><span className="fd-label">{title("breakeven")}</span><strong data-tone={empty ? "neutral" : undefined}>{empty || shownInvested === null ? dash : cash(shownInvested, 0)}</strong><small>{title(empty ? "breakevenDetail" : "pnlZero").replace("{zero}", cash(0, 0))}</small></div><div><span className="fd-label">{title("positions")}</span><strong>{display?.assets ?? 0}</strong><small>{empty ? title("inOneSnapshot") : <><span data-tone="gain">{title("upCount").replace("{n}", String(positionCounts.up))}</span> · <span data-tone="loss">{title("downCount").replace("{n}", String(positionCounts.down))}</span><br />{title("flatCount").replace("{n}", String(positionCounts.flat))}</>}</small></div></div>
      {empty ? <Empty refresh>{title("lineNeedsSecond")}</Empty> : <><p className="fd-chart-caption">{title("cumulative").replace("{date}", dateLabel(firstDate))}</p><LineChart values={[0,...(display?.chart.map((p) => currencyWrapper(currency)(p.total ?? p.knownTotal ?? 0)) ?? [])]} dates={[firstDate,...(display?.months.filter((m) => m.hasData).map((m)=>m.date)??[])]} label={title("cumulative").replace("{date}", dateLabel(firstDate))} symbol={currency.symbol} formatMonth={monthLabel} bestMonthText={title("bestMonth")} focusedMonth={focusedMonth} approximate={display?.chart.some((p) => p.total === null)} /></>}</>}
    </>, "fd-profit-loss")}
    {card(<><Heading title={title("ath")} right={loading ? t("profitSummary.since").replace("{date}", dateLabel(dateRange.start)) : empty ? title("fromOneSnapshot") : t("profitSummary.since").replace("{date}", dateLabel(firstDate))} />
      {loading ? <div className="fd-ath-skeleton"><Skeleton width="40%"/><Skeleton width="70%" height={30}/><Skeleton width="55%"/><Skeleton width="100%" height={6}/>{[0,1,2].map(i=><Skeleton key={i} width="100%" height={14}/>)}</div> : <><div className="fd-label">{empty ? title("highestSoFar") : title("highestRecorded")}</div><div className="fd-big-value">{cash(peak.totalValue)}</div><div className="fd-sub">{empty ? title("onlySnapshotAt").replace("{date}", dateLabel(new Date(peak.timestamp))) : title("athWhen").replace("{date}", dateLabel(new Date(peak.timestamp))).replace("{days}", String(Math.floor((lastDate.getTime()-peak.timestamp)/86_400_000)))}</div><div className="fd-meter" role="progressbar" aria-label={title("ath")} aria-valuenow={peak.totalValue ? (last?.totalValue ?? 0) / peak.totalValue * 100 : 0} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${peak.totalValue ? Math.min(100,(last?.totalValue ?? 0)/peak.totalValue*100):0}%`}} /></div><div className="fd-sub fd-meter-label">{empty ? title("atHigh").replace("{zero}", cash(0, 0)) : <><span>{title("nowOfAth.dynamic").replace("{percent}", peak.totalValue ? ((last?.totalValue ?? 0)/peak.totalValue*100).toFixed(1) : "0")}</span><span>ATH</span></>}</div><div className="fd-facts">{(empty ? [[title("firstSnapshot"), dateTimeLabel(firstDate)], [title("assets"), String(display?.assets ?? 0)], [title("sources"), String(display?.sources ?? 0)], [title("currentValue"), cash(last?.totalValue ?? 0)]] : [[title("distanceAth"), `${cash(distance,2,true)} · ${percent(peak.totalValue ? distance/peak.totalValue : 0)}`], [title("gainNeeded"), peak.totalValue && last?.totalValue ? percent(peak.totalValue/last.totalValue-1) : dash], [title("previousHigh"), previousHigh ? `${cash(previousHigh.totalValue)} · ${dateLabel(new Date(previousHigh.timestamp))}` : dash], [title("lowestSince"), lowestSince ? `${cash(lowestSince.totalValue)} · ${dateLabel(new Date(lowestSince.timestamp))}` : dash], [title("currentValue"), cash(last?.totalValue ?? 0)]]).map(([label,value])=><div key={label}><span>{label}</span><span data-tone={label===title("distanceAth")?tone(distance):undefined}>{value}</span></div>)}</div></>}
    </>, "fd-ath")}
    {card(<><Heading title={title("profitSummary")} right={title("monthsOfYear").replace("{year}", yearsLabel)} />
      <div className="fd-profit-hint"><PnlPercentHint names={moving.map((coin) => coin.symbol)} t={t} /></div>
      {loading ? <div className="fd-month-grid">{Array.from({length:6},(_,i)=><div className="fd-block" key={i} style={{height:126}} />)}</div>
      : empty ? placeholder(title("monthsNeedSecond"),150)
      : <><div className="fd-month-grid">{selectedMonths.map((m) => {
        const amount = profitText(m.profit, m.knownTotal, m.unknownCoins);
        const amountValue = m.profit ?? (m.unknownCoins.length ? m.knownTotal : null);
        const partial = m.hasData && m.profit === null && m.unknownCoins.length > 0;
        const period = m.gapDate ? t("profitSummary.since").replace("{date}", dateLabel(m.gapDate))
          : m.date.getMonth() === lastDate.getMonth() && m.date.getFullYear() === lastDate.getFullYear()
            ? title("toDate.dynamic").replace("{date}", dateLabel(lastDate).replace(` ${lastDate.getFullYear()}`, ""))
            : String(m.date.getFullYear());
        const partialKey = m.date.toISOString();
        return <div className="fd-month" key={partialKey} data-partial={partial}>
          <button type="button" className="fd-month-main" disabled={!m.hasData}
          onClick={() => { setFocusedMonth(m.date); document.querySelector(".fd-summary-chart")?.scrollIntoView({ block: "center" }); }}
          aria-label={`${monthLabel(m.date)} ${m.hasData ? amount : t("profitSummary.noSnapshot")}`}>
          <span className="fd-month-top"><b>{monthLabel(m.date)}</b><span>{period}</span></span>
          <strong data-tone={tone(m.profit ?? m.knownTotal)} title={m.hasData ? amount : undefined}>{m.hasData && amountValue !== null
            ? <FittingAttributionAmount full={amount} compact={attributionCompactAmount(amountValue, currency, locale)} />
            : m.hasData ? amount : "—"}</strong>
          <small data-tone={tone(m.profit)}>{m.hasData && m.percentage != null ? percent(m.percentage / 100) : dash}</small>
          <span className="fd-zero-bar"><i data-tone={tone(m.profit ?? m.knownTotal)} style={{width:`${Math.min(50, Math.abs((m.percentage ?? 0) / 100)/monthPercentMax*50)}%`}} /></span>
          <span className="fd-month-foot">{!m.hasData ? t("profitSummary.noSnapshot") : <><span data-tone={m.up ? "gain" : "neutral"}>{title("upCount").replace("{n}", String(m.up))}</span> · <span data-tone={m.down ? "loss" : "neutral"}>{title("downCount").replace("{n}", String(m.down))}</span>{m.flat > 0 && <span> · {title("flatCount").replace("{n}", String(m.flat))}</span>}</>}</span>
          </button>
          {partial && partialBadge(m.unknownCoins, monthLabel(m.date))}
        </div>;
      })}</div></>}
    </>,"fd-profit-summary")}
    {card(<><Heading title={title("byYear")} right={title("yearToDate").replace("{year}", yearsLabel)} />
      <div className="fd-profit-hint"><PnlPercentHint names={moving.map((coin) => coin.symbol)} t={t} /></div>
      {loading ? <div className="fd-year-list">{[0,1].map(i=><div className="fd-block" key={i} style={{height:150}} />)}</div>
      : empty ? placeholder(title("yearsNeedSecond"),150)
      : <div className="fd-year-list">{years.map((item,index)=>{
        const { year, profit, flow: deposits } = item;
        const moves = display?.yearMoves[year];
        const partial = profit.total === null && profit.unknownCoins.length > 0;
        return <div key={year} className={`fd-year ${index===0?"selected":""}`} data-partial={partial}>
          <span className="fd-month-top"><b>{year}</b><span>{monthLabel(item.start)}–{monthLabel(item.end)}</span></span>
          <strong data-tone={tone(profit.total ?? profit.knownTotal)}>{profitText(profit.total, profit.knownTotal, profit.unknownCoins)}</strong>
          <small data-tone={tone(profit.total)}>{profit.total === null || item.endingValue === profit.total
            ? dash : percent(profit.total / (item.endingValue - profit.total))}</small>
          <span className="fd-year-deposit">{title("deposits")}<span>{deposits === null ? dash : cash(deposits,0,true)}</span></span>
          <span className="fd-year-foot"><span><span data-tone="gain">{title("upCount").replace("{n}", String(moves?.up??0))}</span> · <span data-tone="loss">{title("downCount").replace("{n}", String(moves?.down??0))}</span></span><span>{title(item.months === 1 ? "monthCountOne" : "monthCount").replace("{n}", String(item.months))}</span></span>
          {partial && partialBadge(profit.unknownCoins, String(year), true)}
        </div>;
      })}</div>}
    </>,"fd-years")}
    {card(<><Heading title={title("attribution")} right={empty?title("attributionDateOnly").replace("{date}",dateLabel(lastDate)).replace("{currency}",currency.currency):title("attributionDateRange").replace("{start}",dateLabel(firstDate)).replace("{end}",dateLabel(lastDate)).replace("{currency}",currency.currency)} />{loading ? <div className="fd-row-skeleton">{Array.from({length:8},(_,i)=><div key={i}><Skeleton width="36px"/><Skeleton width="55%" height={8}/></div>)}</div> : empty ? placeholder(title("attributionNeedsSecond"),260) : <><div className="fd-key"><span><i />{title("marketMove")}</span><span><i />{title("quantityChange")}</span></div>{attributionPaging.rows.map(([symbol,row])=><div className="fd-attr-row" key={symbol}><b>{symbol}</b><span className="fd-attr-track" style={{ "--fd-zero": `${attrScale(0)}%` } as React.CSSProperties}><i className="fd-attr-market" style={{left:`${attrScale(Math.min(0,row.market))}%`,width:`${attrScale(Math.max(0,row.market))-attrScale(Math.min(0,row.market))}%`}} /><i className="fd-attr-flow" style={{left:`${attrScale(Math.min(flowStart(row),flowStart(row)+row.flow))}%`,width:`${attrScale(Math.max(flowStart(row),flowStart(row)+row.flow))-attrScale(Math.min(flowStart(row),flowStart(row)+row.flow))}%`}} /></span><strong data-tone={tone(row.total)} title={attributionAmount(row.total, currency, true)}><FittingAttributionAmount full={attributionAmount(row.total, currency)} compact={attributionCompactAmount(row.total, currency, locale)} /></strong><small className="sr-only"><span>{title("market")} <span data-tone={tone(row.market)}>{cash(row.market,0,true)}</span></span><span>{title("quantity")} {cash(row.flow,0,true)}</span></small></div>)}<div ref={axisRef} className="fd-axis"><span />{attrTicks.map(tick=><span key={tick} data-axis-tick="" data-value={tick} style={{left:`${attrScale(tick)}%`}}>{tick<0?"−":""}{currency.symbol}{new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(currencyWrapper(currency)(tick))).replace("K","k")}</span>)}</div><div className="fd-attr-row fd-attr-total"><b>{title("total")}</b><span title={attrRange.full}><FittingAttributionAmount full={attrRange.text} compact={attrRange.compact} /></span><strong title={attributionAmount(gain, currency, true)}><FittingAttributionAmount full={attributionAmount(gain, currency)} compact={attributionCompactAmount(gain, currency, locale)} /></strong><small className="sr-only"><span>{title("market")} {cash(full?.totals.priceEffect??0,0,true)}</span><span>{title("quantity")} {cash((full?.totals.flowEffect??0)+(full?.totals.residual??0),0,true)}</span></small></div><AttributionPager count={grouped.length} {...attributionPaging} t={t} /></>}</>,"fd-attribution")}
    {card(<><div className="fd-card-heading"><button className="fd-top-dialog-trigger" type="button" disabled={checking} onClick={() => setRankOpen(true)}>{title("topCoins")}</button><span>{title("allTime")}</span></div>{loading ? <div className="fd-row-skeleton">{Array.from({length:6},(_,i)=><div key={i}><Skeleton width="36px"/><Skeleton width="50%" height={8}/></div>)}</div> : empty ? placeholder(title("topNeedsSecond"),260) : <><div role="table" aria-label={title("topCoins")} className="summary-top-collection"><div role="row" className="sr-only"><span role="columnheader">{title("assets")}</span><span role="columnheader">{title("market")}</span><span role="columnheader">%</span></div>{([
      [title("topProfit"), moving.filter((coin)=>coin.value !== null && coin.value > 0).sort((a,b)=>(b.value??0)-(a.value??0))],
      [title("topLoss"), moving.filter((coin)=>coin.value !== null && coin.value < 0).sort((a,b)=>(a.value??0)-(b.value??0))],
      [title("noMarketPnl"), (display?.profit.coins??[]).filter((coin)=>display?.stableSymbols.includes(coin.symbol))
        .sort((a,b)=>(display?.coinValues[`${b.assetType}:${b.symbol}`]??0)-(display?.coinValues[`${a.assetType}:${a.symbol}`]??0))],
    ] as const).map(([heading,items])=><SummaryTopList key={heading} heading={heading}
      rows={items.map((coin) => ({ ...coin, stable: display?.stableSymbols.includes(coin.symbol) ?? false,
        percentage: display?.stableSymbols.includes(coin.symbol) ? 0
          : marketProfitPercentage(coin.value, display?.coinValues[`${coin.assetType}:${coin.symbol}`]) }))}
      scaleValues={moving.map((coin) => coin.value ?? 0)} amount={(value) => cash(value,0,true)} tone={tone} />)}</div><p className="fd-footnote">{title("topNote.market").replace("{date}",dateLabel(firstDate)).replace("{one}",cash(1,0))}</p></>}</>,"fd-top-coins")}
    <BottomSheet open={rankOpen} onOpenChange={setRankOpen} title={t("analytics.rank")} detents={["large"]} initialDetent="large">
      <div className="d2-rank-sheet"><TopCoinsRank dateRange={dateRange} currency={currency} /></div>
    </BottomSheet>
  </div>;
}
