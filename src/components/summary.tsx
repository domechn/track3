import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { roundedSummaryBreakdown } from "@/middlelayers/summary-breakdown";
import { selectSummaryRange } from "@/middlelayers/summary-range";
import SummaryProfitLoss from "./summary-profit-loss";
import AthValue from "./ath-value";
import ProfitSummary from "./profit-summary";
import SummaryMarketCard from "./summary-market-card";
import { SummaryLoadingContext } from "./summary-loading-context";
import { SummaryFidelityRangeContext, SummaryFidelityYearContext } from "./summary-fidelity-range-context";

const SECTION_COUNT = 6;
function SkeletonCard({ title, caption, kind }: { title: string; caption: string; kind: "pnl" | "ath" | "months" | "years" | "attribution" | "leaders" }) {
  return <section className={`fidelity-card fidelity-skeleton ${kind}`}>
    <div className="fidelity-card-head"><h2>{title}</h2><span>{caption}</span></div>
    {kind === "pnl" && <><div className="fidelity-skeleton-kpis">{[0, 1, 2, 3].map((i) => <div key={i}><i /><i /><i /></div>)}</div><div className="fidelity-skeleton-box" /></>}
    {kind === "ath" && <><i className="short" /><i className="large" /><i className="medium" /><i className="meter" />{[0, 1, 2].map((i) => <i className="fact" key={i} />)}</>}
    {kind === "months" && <div className="fidelity-skeleton-months">{Array.from({ length: 10 }, (_, i) => <div key={i} />)}</div>}
    {kind === "years" && <div className="fidelity-skeleton-years"><div /><div /></div>}
    {kind === "attribution" && <div className="fidelity-skeleton-rows">{Array.from({ length: 8 }, (_, i) => <div key={i}><i /><i /></div>)}</div>}
    {kind === "leaders" && <div className="fidelity-skeleton-rows">{Array.from({ length: 6 }, (_, i) => <div key={i}><i /><i /></div>)}</div>}
  </section>;
}

function FidelitySummary({ currency, dateRange, quoteColor }: {
  currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor;
}) {
  const { t, locale } = useTranslation();
  const setSummaryLoading = useContext(SummaryLoadingContext);
  const dataVersion = useDataChangedVersion();
  const [loading, setLoading] = useState(true);
  const [subtitle, setSubtitle] = useState("");
  const [subtitleEmphasis, setSubtitleEmphasis] = useState("");
  const [selectedYear, setSelectedYear] = useState(dateRange.end.getFullYear());
  const [moverNames, setMoverNames] = useState<string[]>([]);
  const loaded = useRef(0);
  const summaryGridRef = useRef<HTMLDivElement>(null);
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  const hasValidRange = dateRange.start.getTime() > new Date("1970-01-01").getTime() &&
    dateRange.end.getTime() >= dateRange.start.getTime();
  const { availableDates, label: rangePreset } = useContext(SummaryFidelityRangeContext);
  const selectedRange = useMemo(() => selectSummaryRange(availableDates, dateRange), [availableDates, rangeKey]);
  const oneSnapshot = selectedRange.databaseCount < 2;
  const rangeLabel = rangePreset === "custom"
    ? `${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "2-digit", month: "short" }).format(dateRange.start)} - ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "2-digit", month: "short" }).format(dateRange.end)}`
    : rangePreset;

  useEffect(() => { setSummaryLoading(loading); }, [loading, setSummaryLoading]);
  useEffect(() => () => { setSummaryLoading(false); }, [setSummaryLoading]);
  useEffect(() => { setSelectedYear(dateRange.end.getFullYear()); }, [dateRange.end.getFullYear()]);
  useLayoutEffect(() => {
    if (loading) return;
    const grid = summaryGridRef.current;
    const monthPanel = grid?.querySelector<HTMLElement>(".fidelity-period-card:has(.fidelity-month-grid)");
    if (!grid || !monthPanel) return;
    const observer = new ResizeObserver(() => {
      grid.style.setProperty("--fidelity-period-height", `${Math.max(360, monthPanel.getBoundingClientRect().height)}px`);
    });
    observer.observe(monthPanel);
    return () => observer.disconnect();
  }, [loading, oneSnapshot]);

  useLayoutEffect(() => {
    setLoading(hasValidRange);
    setSubtitle("");
    setSubtitleEmphasis("");
    loaded.current = 0;
  }, [rangeKey, dataVersion, hasValidRange]);

  useEffect(() => {
    let active = true;
    if (!hasValidRange || oneSnapshot) return;
    queryAttribution(dateRange).then((data) => {
      if (!active) return;
      const amounts = roundedSummaryBreakdown(data.attribution.totals, currencyWrapper(currency)(1));
      const value = (amount: number) => `${amount < 0 ? "−" : ""}${currency.symbol}${new Intl.NumberFormat("en-US").format(Math.abs(amount))}`;
      const signedValue = (amount: number) => `${amount > 0 ? "+" : ""}${value(amount)}`;
      setSubtitleEmphasis(signedValue(amounts.market));
      setSubtitle(t("summary.fidelity.fullSubtitleAdditive")
        .replace("{market}", signedValue(amounts.market))
        .replace("{gain}", value(amounts.gain))
        .replace("{date}", new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { month: "short", year: "numeric" }).format(selectedRange.baseline ?? dateRange.start))
        .replace("{deposits}", value(amounts.added))
        .replace("{other}", value(amounts.other)));
    }).catch(() => {});
    return () => { active = false; };
  }, [rangeKey, dataVersion, hasValidRange, oneSnapshot, t, locale, selectedRange.baseline?.getTime()]);

  const reportLoaded = useCallback(() => {
    loaded.current += 1;
    if (loaded.current >= SECTION_COUNT) setLoading(false);
  }, []);
  const context = useMemo(() => ({ reportLoaded }), [reportLoaded]);
  const cardCaption = t("summary.fidelity.netPnlUsd").replace("{currency}", currency.currency);
  const periodCaption = t("summary.fidelity.monthsOf").replace("{year}", String(dateRange.end.getFullYear()));
  const yearCaption = t("summary.fidelity.currentYear").replace("{year}", String(dateRange.end.getFullYear()));
  const attributionCaption = `${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dateRange.start)} ${t("summary.fidelity.to")} ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dateRange.end)}, ${currency.currency}`;

  return <OverviewLoadingContext.Provider value={context}>
    <SummaryFidelityYearContext.Provider value={{ year: selectedYear, setYear: setSelectedYear, moverNames, setMoverNames }}>
    <div className={`analyze-summary fidelity-summary${oneSnapshot ? " fidelity-summary-single" : ""}${quoteColor === "red-up-green-down" ? " fidelity-reverse" : ""}`} aria-busy={loading}>
      <header className="fidelity-page-head">
        <h1>{t("summary.h1")}</h1>
        <p>{loading ? t("summary.fidelity.loadingSubtitle") : oneSnapshot ? (() => {
          const text = t("summary.fidelity.emptySubtitle");
          const emphasis = t("summary.fidelity.emptyEmphasis");
          const index = text.indexOf(emphasis);
          return index < 0 ? text : <>{text.slice(0, index)}<strong>{emphasis}</strong>{text.slice(index + emphasis.length)}</>;
        })() : subtitle && subtitleEmphasis && subtitle.includes(subtitleEmphasis)
          ? <>{subtitle.slice(0, subtitle.indexOf(subtitleEmphasis))}<strong>{subtitleEmphasis}</strong>{subtitle.slice(subtitle.indexOf(subtitleEmphasis) + subtitleEmphasis.length)}</>
          : subtitle || t("summary.fidelity.defaultSubtitle")}</p>
      </header>
      {!hasValidRange ? <div className="fidelity-card fidelity-empty">{t("summary.noData")}</div> : <>
        <div ref={summaryGridRef} className="fidelity-summary-grid" style={loading ? { visibility: "hidden", position: "absolute", inset: 0, height: 0, overflow: "hidden", pointerEvents: "none" } : undefined}>
          <SummaryProfitLoss currency={currency} dateRange={dateRange} quoteColor={quoteColor} oneSnapshot={oneSnapshot}
            baseline={selectedRange.baseline} snapshotCount={selectedRange.snapshots.length} rangeLabel={rangeLabel} />
          <AthValue fidelity currency={currency} dateRange={dateRange} quoteColor={quoteColor} />
          <ProfitSummary fidelity currency={currency} dateRange={dateRange} quoteColor={quoteColor} oneSnapshot={oneSnapshot}
            unavailableReason={!oneSnapshot && !selectedRange.baseline ? t("summary.fidelity.noBaselineRange").replace("{range}", rangeLabel) : undefined} />
          <ProfitSummary fidelity initialType="year" currency={currency} dateRange={dateRange} quoteColor={quoteColor} oneSnapshot={oneSnapshot}
            unavailableReason={!oneSnapshot && !selectedRange.baseline ? t("summary.fidelity.noBaselineRange").replace("{range}", rangeLabel) : undefined} />
          <SummaryMarketCard mode="attribution" currency={currency} dateRange={dateRange} quoteColor={quoteColor}
            baseline={selectedRange.baseline} rangeLabel={rangeLabel} oneSnapshot={oneSnapshot} />
          <SummaryMarketCard mode="leaders" currency={currency} dateRange={dateRange} quoteColor={quoteColor}
            baseline={selectedRange.baseline} rangeLabel={rangeLabel} oneSnapshot={oneSnapshot} />
        </div>
        {loading && <div className="fidelity-summary-grid" role="status" aria-label={t("summary.fidelity.loadingSubtitle")}>
          <SkeletonCard kind="pnl" title={t("summary.fidelity.profitLoss")} caption={cardCaption} />
          <SkeletonCard kind="ath" title={t("summary.fidelity.allTimeHigh")} caption={t("summary.fidelity.since").replace("{date}", new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(dateRange.start))} />
          <SkeletonCard kind="months" title={t("summary.fidelity.profitSummary")} caption={periodCaption} />
          <SkeletonCard kind="years" title={t("summary.fidelity.byYear")} caption={yearCaption} />
          <SkeletonCard kind="attribution" title={t("summary.attributionTitle")} caption={attributionCaption} />
          <SkeletonCard kind="leaders" title={t("summary.fidelity.topCoins")} caption={t("summary.fidelity.allTime")} />
        </div>}
      </>}
    </div>
    </SummaryFidelityYearContext.Provider>
  </OverviewLoadingContext.Provider>;
}

export default function Summary(props: { currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor }) {
  const { range } = useContext(SummaryFidelityRangeContext);
  return <FidelitySummary {...props} dateRange={range ?? props.dateRange} />;
}
