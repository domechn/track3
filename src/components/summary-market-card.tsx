import { useContext, useEffect, useMemo, useState } from "react";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { queryLatestAssets } from "@/middlelayers/charts";
import { groupAttribution } from "@/middlelayers/charts-attribution";
import type { AttributionDimension } from "@/middlelayers/charts-attribution";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { axisForValues, compactMoney } from "./fidelity-data";
import { AttributionPager, useAttributionPage } from "./attribution-pager";
import { attributionAmount, attributionRange, attributionRoundedValue } from "./attribution-amount";
import { FittingAttributionAmount } from "./fitting-attribution-amount";
import { useFittingAttributionTicks } from "./use-fitting-attribution-ticks";

type Result = Awaited<ReturnType<typeof queryAttribution>>;
const num = (n: number, decimals = 0) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(Math.abs(n));

export default function SummaryMarketCard({ mode, currency, dateRange, quoteColor }: {
  mode: "attribution" | "leaders";
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) {
  const { t, locale } = useTranslation();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const dataVersion = useDataChangedVersion();
  const [result, setResult] = useState<Result>();
  const [assetValues, setAssetValues] = useState<Record<string, number>>({});
  const [error, setError] = useState(false);
  const [dimension, setDimension] = useState<AttributionDimension>("coin");
  const [retry, setRetry] = useState(0);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  useEffect(() => {
    let active = true;
    setError(false);
    Promise.all([queryAttribution(dateRange), queryLatestAssets()]).then(([value, assets]) => {
      if (!active) return;
      setResult(value);
      setAssetValues(Object.fromEntries(assets.map((asset) => [`${asset.assetType}:${asset.symbol}`, asset.value])));
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => { if (active) reportLoaded(); });
    return () => { active = false; };
  }, [rangeKey, dataVersion, retry]);

  const groups = useMemo(() => result
    ? groupAttribution(result.attribution.entries, dimension, result.aliases, t("profit.attribution.stock"))
    : [], [result, dimension, t]);
  const paging = useAttributionPage(groups, `${rangeKey}:${dimension}`);
  const hasResidual = !!result && (attributionRoundedValue(result.attribution.totals.residual, currency) !== 0 ||
    groups.some((group) => attributionRoundedValue(group.residual, currency) !== 0));
  const coinGroups = useMemo(() => result
    ? groupAttribution(result.attribution.entries, "coin", result.aliases, t("profit.attribution.stock"))
    : [], [result, t]);
  const cents = (value: number) => Math.round(value * 100) / 100;
  const money = (value: number) => attributionAmount(value, currency);
  const exactMoney = (value: number) => attributionAmount(value, currency, true);
  const tone = (value: number) => attributionRoundedValue(value, currency) === 0 ? "text-muted-foreground" : value > 0
    ? quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"
    : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive";
  const date = (value: Date) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value);
  const empty = !result || result.attribution.entries.length === 0;
  const negative = Math.min(0, ...groups.flatMap((group) => [group.priceEffect, group.flowEffect]));
  const positiveAxis = axisForValues([...groups.flatMap((group) => [group.priceEffect, group.priceEffect + group.flowEffect]).filter((value) => value >= 0), Math.abs(negative)]);
  const negativeUnit = (positiveAxis.ticks[1] - positiveAxis.ticks[0]) / 5;
  const axis = { ...positiveAxis, lower: negative < 0 ? Math.floor(negative / negativeUnit) * negativeUnit - negativeUnit : 0 };
  const axisPosition = (value: number) => (value - axis.lower) / (axis.upper - axis.lower) * 100;
  const zero = axisPosition(0);
  const leaderNegative = Math.max(0, ...coinGroups.map((group) => -cents(group.priceEffect)));
  const leaderPositive = Math.max(0, ...coinGroups.map((group) => cents(group.priceEffect)));
  const leaderZero = leaderNegative / Math.max(1, leaderPositive) * 30 + 2;
  const leaderUnit = (100 - leaderZero - 2) / Math.max(1, leaderPositive);
  const valueRange = result && attributionRange(result.attribution.startValue, result.attribution.endValue, currency, locale);
  const axisRef = useFittingAttributionTicks();
  const axisTicks = axis.ticks.map((tick) => ({
    tick, label: compactMoney(currencyWrapper(currency)(tick), currency.symbol).replace("K", "k"),
  }));

  if (mode === "leaders") {
    const positives = coinGroups.filter((g) => cents(g.priceEffect) > 0).sort((a, b) => b.priceEffect - a.priceEffect).slice(0, 4);
    const negatives = coinGroups.filter((g) => cents(g.priceEffect) < 0).sort((a, b) => a.priceEffect - b.priceEffect).slice(0, 4);
    const flats = coinGroups.filter((g) => cents(g.priceEffect) === 0).slice(0, 4);
    const row = (group: typeof coinGroups[number]) => {
      const base = (assetValues[group.key] ?? 0) - group.priceEffect - group.residual;
      const percentage = Math.abs(base) >= 1 ? group.priceEffect / Math.abs(base) * 100 : null;
      return <div className="fidelity-leader-row" role="row" key={group.key}>
        <b role="rowheader">{group.label.split(" · ")[0]}</b>
        <span className="fidelity-leader-track" aria-hidden="true"><b style={{ left: `${leaderZero}%` }} /><i className={cents(group.priceEffect) === 0 ? "" : group.priceEffect > 0 ? "positive" : "negative"} style={{ left: `${group.priceEffect >= 0 ? leaderZero : leaderZero - Math.abs(cents(group.priceEffect)) * leaderUnit}%`, width: `${Math.abs(cents(group.priceEffect)) * leaderUnit}%` }} /></span>
        <span role="cell" className={cn("number", tone(group.priceEffect))}>{money(group.priceEffect)}</span>
        <span role="cell" className={cn("number", tone(group.priceEffect))}>{cents(group.priceEffect) === 0 ? "0.0%" : percentage === null ? "–" : `${group.priceEffect > 0 ? "+" : "−"}${num(percentage, 1)}%`}</span>
      </div>;
    };
    return <section className="fidelity-card fidelity-leaders">
      <div className="fidelity-card-head"><h2>{t("summary.fidelity.topCoins")}</h2><span>{t("summary.fidelity.allTime")}</span></div>
      {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
        empty ? <div className="fidelity-empty"><span className="fidelity-empty-message">{t("summary.fidelity.topEmpty")}</span></div> : <>
          <div role="table" aria-label={t("summary.fidelity.topCoins")}>
          <div role="row" className="sr-only"><span role="columnheader">{t("summary.fidelity.asset")}</span><span role="columnheader">{t("summary.fidelity.market")}</span><span role="columnheader">%</span></div>
          <div className="fidelity-group-label" role="row"><span role="cell" aria-colspan={3}>{t("summary.fidelity.topProfit")}</span></div>{positives.map(row)}
          <div className="fidelity-group-label" role="row"><span role="cell" aria-colspan={3}>{t("summary.fidelity.topLoss")}</span></div>{negatives.map(row)}
          <div className="fidelity-group-label" role="row"><span role="cell" aria-colspan={3}>{t("summary.fidelity.noMarket")}</span></div>{flats.map(row)}
          </div>
          <p className="fidelity-caption">{t("summary.fidelity.topNote").replace("{date}", date(dateRange.start))}</p>
        </>}
    </section>;
  }

  return <section className="fidelity-card fidelity-attribution">
    <div className="fidelity-card-head"><h2>{t("summary.attributionTitle")}</h2><details className="fidelity-attribution-options">
      <summary title={t("profit.attribution.groupBy")}>{date(dateRange.start)} {t("summary.fidelity.to")} {date(dateRange.end)}, {currency.currency}<span className="sr-only"> {t("summary.fidelity.groupBy")}</span><span className="fidelity-options-hint" aria-hidden="true">⌄</span></summary>
      <div>{(["coin", "source", "wallet", "assetType"] as const).map((name) => <button key={name} type="button" aria-pressed={dimension === name} onClick={() => setDimension(name)}>{t(`profit.attribution.${name}`)}</button>)}</div>
    </details></div>
    {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
      empty ? <div className="fidelity-empty"><span className="fidelity-empty-message">{t("summary.fidelity.attributionEmpty")}</span></div> : <>
        <div className="fidelity-attribution-key"><span><i />{t("summary.fidelity.marketMove")}</span><span><i />{t("summary.fidelity.quantityChange")}</span></div>
        <div role="table" tabIndex={0} aria-label={t("summary.attributionTitle")} className={hasResidual ? "fidelity-attribution-table has-residual" : "fidelity-attribution-table"}>
        <div className="fidelity-attribution-row head" role="row"><span role="columnheader">{t("summary.fidelity.asset")}</span><span role="columnheader"><span className="sr-only">{t("profit.attribution.chart")}</span></span><span role="columnheader">{t("summary.fidelity.market")}</span><span role="columnheader">{t("summary.fidelity.quantity")}</span>{hasResidual && <span role="columnheader">{t("profit.attribution.residual")}</span>}<span role="columnheader">{t("summary.fidelity.total")}</span></div>
        {paging.rows.map((group) => {
          const quantityStart = group.priceEffect * group.flowEffect < 0 ? 0 : group.priceEffect;
          return <div className="fidelity-attribution-row" role="row" key={group.key}>
          <b role="rowheader">{group.label.split(" · ")[0]}</b>
          <span className="fidelity-attribution-track" role="cell" aria-label={t("profit.attribution.chart")}><b style={{ left: `${zero}%` }} /><i className="market" style={{ left: `${axisPosition(Math.min(0, group.priceEffect))}%`, width: `${Math.abs(axisPosition(group.priceEffect) - zero)}%` }} /><i className="quantity" style={{ left: `${axisPosition(Math.min(quantityStart, quantityStart + group.flowEffect))}%`, width: `${Math.abs(axisPosition(group.flowEffect) - axisPosition(0))}%` }} /></span>
          <span role="cell" className={tone(group.priceEffect)} title={exactMoney(group.priceEffect)}>{money(group.priceEffect)}</span>
          <span role="cell" title={exactMoney(group.flowEffect)}>{money(group.flowEffect)}</span>
          {hasResidual && <span role="cell" title={exactMoney(group.residual)}>{money(group.residual)}</span>}
          <span role="cell" title={exactMoney(group.totalChange)}>{money(group.totalChange)}</span>
        </div>; })}
        <div ref={axisRef} className="fidelity-attribution-axis" aria-hidden="true"><span /><span>{axisTicks.map(({ tick, label }) => <span key={tick} data-axis-tick="" style={{ left: `${axisPosition(tick)}%` }}>{label}</span>)}</span></div>
        <div className="fidelity-attribution-row total" role="row">
          <b role="rowheader">{t("summary.fidelity.total")}</b><span role="cell" title={valueRange!.full}><FittingAttributionAmount full={valueRange!.text} compact={valueRange!.compact} /></span>
          <span role="cell" className={tone(result!.attribution.totals.priceEffect)} title={exactMoney(result!.attribution.totals.priceEffect)}>{money(result!.attribution.totals.priceEffect)}</span>
          <span role="cell" title={exactMoney(result!.attribution.totals.flowEffect)}>{money(result!.attribution.totals.flowEffect)}</span>
          {hasResidual && <span role="cell" title={exactMoney(result!.attribution.totals.residual)}>{money(result!.attribution.totals.residual)}</span>}
          <span role="cell" title={exactMoney(result!.attribution.totals.totalChange)}>{money(result!.attribution.totals.totalChange)}</span>
        </div>
        </div>
        <AttributionPager count={groups.length} {...paging} t={t} />
      </>}
  </section>;
}
