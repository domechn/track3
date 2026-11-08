import { useContext, useEffect, useMemo, useState } from "react";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { calculateTotalProfit, queryLatestAssets } from "@/middlelayers/charts";
import { groupAttribution } from "@/middlelayers/charts-attribution";
import type { AttributionDimension } from "@/middlelayers/charts-attribution";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { axisForValues, compactMoney } from "./fidelity-data";
import { AttributionPager, useAttributionPage } from "./attribution-pager";
import { attributionAmount, attributionRange, attributionRoundedValue } from "./attribution-amount";
import { FittingAttributionAmount } from "./fitting-attribution-amount";
import { useFittingAttributionTicks } from "./use-fitting-attribution-ticks";
import { SummaryTopList } from "./summary-top-list";
import { marketProfitPercentage } from "./profit-percentage";
import { classifyWalletType } from "@/utils/wallet-treemap";
import AssetLabel from "./common/asset-label";
import type { AssetIconKind } from "./ui/asset-icon";

import { useChartHitArea } from "./chart-tooltip";

type Result = Awaited<ReturnType<typeof queryAttribution>>;

export default function SummaryMarketCard({ mode, currency, dateRange, quoteColor, baseline, rangeLabel = "All", oneSnapshot = false }: {
  mode: "attribution" | "leaders";
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  baseline?: Date;
  rangeLabel?: string;
  oneSnapshot?: boolean;
}) {
  const { t, locale } = useTranslation();
  const chart = useChartHitArea();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const dataVersion = useDataChangedVersion();
  const [result, setResult] = useState<Result>();
  const [assetValues, setAssetValues] = useState<Record<string, number>>({});
  const [unknownCoins, setUnknownCoins] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [dimension, setDimension] = useState<AttributionDimension>("coin");
  const [retry, setRetry] = useState(0);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  useEffect(() => {
    let active = true;
    setError(false);
    Promise.all([queryAttribution(dateRange), queryLatestAssets(dateRange),
      mode === "leaders" ? calculateTotalProfit(dateRange) : Promise.resolve(undefined)]).then(([value, assets, profit]) => {
      if (!active) return;
      setResult(value);
      setAssetValues(Object.fromEntries(assets.map((asset) => [`${asset.assetType}:${asset.symbol}`, asset.value])));
      setUnknownCoins(new Set(profit?.unknownCoins.map((coin) => `${coin.assetType}:${coin.symbol}`.toUpperCase()) ?? []));
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => { if (active) reportLoaded(); });
    return () => { active = false; };
  }, [rangeKey, dataVersion, retry, mode]);

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
  const tone = (value: number | null) => value === null || attributionRoundedValue(value, currency) === 0 ? "text-muted-foreground" : value > 0
    ? quoteColor === "green-up-red-down" ? "text-positive" : "text-negative"
    : quoteColor === "green-up-red-down" ? "text-negative" : "text-positive";
  const date = (value: Date) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value);
  const empty = oneSnapshot || !result || result.attribution.entries.length === 0;
  const emptyMessage = oneSnapshot ? t(mode === "leaders" ? "summary.fidelity.topEmpty" : "summary.fidelity.attributionEmpty")
    : !baseline ? t("summary.fidelity.noBaselineRange").replace("{range}", rangeLabel)
    : t("summary.fidelity.noMarketChangesRange").replace("{range}", rangeLabel);
  const negative = Math.min(0, ...groups.flatMap((group) => [group.priceEffect, group.flowEffect]));
  const positiveAxis = axisForValues([...groups.flatMap((group) => [group.priceEffect, group.priceEffect + group.flowEffect]).filter((value) => value >= 0), Math.abs(negative)]);
  const negativeUnit = (positiveAxis.ticks[1] - positiveAxis.ticks[0]) / 5;
  const axis = { ...positiveAxis, lower: negative < 0 ? Math.floor(negative / negativeUnit) * negativeUnit - negativeUnit : 0 };
  const axisPosition = (value: number) => (value - axis.lower) / (axis.upper - axis.lower) * 100;
  const zero = axisPosition(0);
  const valueRange = result && attributionRange(result.attribution.startValue, result.attribution.endValue, currency, locale);
  const axisRef = useFittingAttributionTicks();
  const axisTicks = axis.ticks.map((tick) => ({
    tick, label: compactMoney(currencyWrapper(currency)(tick), currency.symbol).replace("K", "k"),
  }));

  if (mode === "leaders") {
    const isUnknown = (group: typeof coinGroups[number]) => unknownCoins.has(group.key.toUpperCase());
    const positives = coinGroups.filter((g) => !isUnknown(g) && cents(g.priceEffect) > 0).sort((a, b) => b.priceEffect - a.priceEffect).slice(0, 4);
    const negatives = coinGroups.filter((g) => !isUnknown(g) && cents(g.priceEffect) < 0).sort((a, b) => a.priceEffect - b.priceEffect).slice(0, 4);
    const flats = coinGroups.filter((g) => !isUnknown(g) && cents(g.priceEffect) === 0).slice(0, 4);
    const unknown = coinGroups.filter(isUnknown).slice(0, 4);
    const rows = (groups: typeof coinGroups) => groups.map((group) => {
      const value = cents(group.priceEffect);
      return {
        assetType: group.key.split(":")[0], symbol: group.label.split(" · ")[0], value,
        stable: false, isUnknown: isUnknown(group), percentage: marketProfitPercentage(value, assetValues[group.key]),
      };
    });
    const scaleValues = coinGroups.map((group) => cents(group.priceEffect));
    return <section className="fidelity-card fidelity-leaders">
      <div className="fidelity-card-head"><h2>{t("summary.fidelity.topCoins")}</h2><span>{rangeLabel === "All" ? t("summary.fidelity.allTime") : rangeLabel}</span></div>
      {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
        empty ? <div className="fidelity-empty"><span className="fidelity-empty-message">{emptyMessage}</span></div> : <>
          <div role="table" className="summary-top-collection" aria-label={t("summary.fidelity.topCoins")}>
          <div role="row" className="sr-only"><span role="columnheader">{t("summary.fidelity.asset")}</span><span role="columnheader">{t("profit.attribution.knownPnl")}</span><span role="columnheader">%</span></div>
          <SummaryTopList heading={t("summary.fidelity.topProfit")} rows={rows(positives)} scaleValues={scaleValues} amount={money} exactAmount={exactMoney} tone={tone} />
          <SummaryTopList heading={t("summary.fidelity.topLoss")} rows={rows(negatives)} scaleValues={scaleValues} amount={money} exactAmount={exactMoney} tone={tone} />
          <SummaryTopList heading={t("summary.fidelity.noPnl")} rows={rows(flats)} scaleValues={scaleValues} amount={money} exactAmount={exactMoney} tone={tone} />
          {unknown.length > 0 && <SummaryTopList heading={t("common.unknown")} rows={rows(unknown)} scaleValues={scaleValues} amount={money} exactAmount={exactMoney} tone={tone} />}
          </div>
          <p className="fidelity-caption">{t("summary.fidelity.topNoteAdditive").replace("{date}", date(dateRange.start))}</p>
        </>}
    </section>;
  }

  return <section className="fidelity-card fidelity-attribution">
    <div className="fidelity-card-head"><h2>{t("summary.attributionTitle")}</h2><details className="fidelity-attribution-options">
      <summary title={t("profit.attribution.groupBy")}>{date(baseline ?? dateRange.start)} {t("summary.fidelity.to")} {date(dateRange.end)}, {currency.currency}<span className="sr-only"> {t("summary.fidelity.groupBy")}</span><span className="fidelity-options-hint" aria-hidden="true">⌄</span></summary>
      <div>{(["coin", "source", "wallet", "assetType"] as const).map((name) => <button key={name} type="button" aria-pressed={dimension === name} onClick={() => setDimension(name)}>{t(`profit.attribution.${name}`)}</button>)}</div>
    </details></div>
    {error ? <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((n) => n + 1)}>{t("summary.fidelity.retry")}</button></div> :
      empty ? <div className="fidelity-empty"><span className="fidelity-empty-message">{emptyMessage}</span></div> : <>
        <div className="fidelity-attribution-key"><span><i />{t("profit.attribution.knownPnl")}</span><span><i />{t("profit.attribution.recordedFlow")}</span></div>
        <div role="table" tabIndex={0} data-chart-group="" aria-label={t("summary.attributionTitle")} className={hasResidual ? "fidelity-attribution-table has-residual" : "fidelity-attribution-table"}>
        <div className="fidelity-attribution-row head" role="row"><span role="columnheader">{t("summary.fidelity.asset")}</span><span role="columnheader"><span className="sr-only">{t("profit.attribution.chart")}</span></span><span role="columnheader">{t("profit.attribution.knownPnl")}</span><span role="columnheader">{t("profit.attribution.recordedFlow")}</span>{hasResidual && <span role="columnheader">{t("profit.attribution.residual")}</span>}<span role="columnheader">{t("summary.fidelity.total")}</span></div>
        {paging.rows.map((group, index) => {
          const quantityStart = group.priceEffect * group.flowEffect < 0 ? 0 : group.priceEffect;
          const name = group.label.split(" · ")[0];
          const provider = dimension === "wallet" ? result.aliases[group.key]?.type : group.key;
          const category = classifyWalletType(provider);
          const kind: AssetIconKind = dimension === "coin" ? group.key.startsWith("stock:") ? "stock" : "coin"
            : dimension === "assetType" ? "custom"
              : category === "cex" ? "exchange" : category === "broker" ? "broker" : "wallet";
          return <div className="fidelity-attribution-row" role="row" key={group.key}>
          <b role="rowheader"><AssetLabel kind={kind} symbol={name} type={provider} name={name} size={20} quiet tag={kind === "stock" ? "stock" : undefined} /></b>
          <span className="fidelity-attribution-track" role="cell"
            {...chart.markProps(index, `${group.label}: ${t("profit.attribution.knownPnl")} ${exactMoney(group.priceEffect)}, ${t("profit.attribution.recordedFlow")} ${exactMoney(group.flowEffect)}`,
              <><div>{group.label}</div><div className={tone(group.priceEffect)}>{t("profit.attribution.knownPnl")} {exactMoney(group.priceEffect)}</div><div>{t("profit.attribution.recordedFlow")} {exactMoney(group.flowEffect)}</div></>)}>
            <b style={{ left: `${zero}%` }} /><i className="market" style={{ left: `${axisPosition(Math.min(0, group.priceEffect))}%`, width: `${Math.abs(axisPosition(group.priceEffect) - zero)}%` }} /><i className="quantity" style={{ left: `${axisPosition(Math.min(quantityStart, quantityStart + group.flowEffect))}%`, width: `${Math.abs(axisPosition(group.flowEffect) - axisPosition(0))}%` }} />
          </span>
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
    {chart.tooltip}
  </section>;
}
