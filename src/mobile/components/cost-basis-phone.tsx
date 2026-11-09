import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { CostBasisMethod, CostBasisWarning } from "@/middlelayers/cost-basis";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { QuoteColor } from "@/middlelayers/types";
import { queryTransactionsBySymbolAndDateRange } from "@/middlelayers/charts-profit";
import { queryLatestAssets } from "@/middlelayers/charts-assets";
import { useTranslation } from "@/mobile/i18n";
import { BottomSheet } from "@/mobile/components/mobile";
import { ArchiveIcon, BarChartIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import { directionPhysicalTone } from "@/utils/color";
import { costBasisPageSizes } from "@/components/cost-basis-page-sizes";

const { lots: lotPageSize, gaps: gapPageSize } = costBasisPageSizes.phone;
const methods: CostBasisMethod[] = ["FIFO", "LIFO", "HIFO", "AVERAGE"];
const amountFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const moneyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function amount(value: number) {
  return amountFormatter.format(value);
}

function lotAmount(value: number, assetType: string) {
  return assetType === "stock" ? amount(value) : new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 4, maximumFractionDigits: 8,
  }).format(value);
}

function money(value: number) {
  return `${value < 0 ? "−" : ""}$${moneyFormatter.format(Math.abs(value))}`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${moneyFormatter.format(Math.abs(value))}`;
}

function dateLabel(value: string | undefined, locale: string, year = true) {
  if (!value || !Number.isFinite(Date.parse(value))) return "–";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}),
  }).format(/^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : new Date(value)).replace("Sept", "Sep");
}

type GapRow = { key: string; date: string; symbol: string; amount: string; reason: string; dust?: number };
type PriceAverage = { bought: number; buyPrice: number | null; sold: number; sellPrice: number | null };

function gapRows(report: CostBasisReport, locale: string): GapRow[] {
  const prices = new Map(report.unrealized.filter((row) => row.amount > 0)
    .map((row) => [`${row.assetType}:${row.symbol}`, row.marketValue / row.amount]));
  const rows: GapRow[] = [];
  let dust = 0;
  for (const warning of report.warnings) {
    const value = Math.abs(warning.amount);
    const price = prices.get(`${warning.assetType}:${warning.symbol}`);
    if (value < 1e-8 || (price !== undefined && value * price < 0.01)) {
      dust++;
      continue;
    }
    rows.push({
      key: `${warning.eventId}:${rows.length}`,
      date: dateLabel(warning.date, locale),
      symbol: warning.symbol,
      amount: lotAmount(warning.amount, warning.assetType),
      reason: warning.code,
    });
  }
  if (dust) rows.push({ key: "dust", date: "–", symbol: "–", amount: "–", reason: "dust", dust });
  return rows;
}

function Icon({ kind }: { kind: "download" | "info" | "alert" | "clock" | "chevron" }) {
  const paths = {
    download: <><path d="M9 3v8M5.5 8 9 11.5 12.5 8M3.5 14.5h11" /></>,
    info: <><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></>,
    alert: <><path d="M9 3 16 15H2zM9 7.5v3M9 12.6v.2" /></>,
    clock: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5v4l2.5 1.5" /></>,
    chevron: <path d="m4 7 5 5 5-5" />,
  };
  return <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export function PhoneCostBasis({
  report, loading, method, year, from, to, holdingDays, validRange, filtersCurrent, quoteColor,
  onMethod, onYear, onFrom, onTo, onHoldingDays, onExport,
}: {
  report?: CostBasisReport; loading: boolean; method: CostBasisMethod; year: string; from: string; to: string;
  holdingDays: string; validRange: boolean; filtersCurrent: boolean; quoteColor: QuoteColor;
  onMethod: (method: CostBasisMethod) => void; onYear: (year: string) => void;
  onFrom: (from: string) => void; onTo: (to: string) => void;
  onHoldingDays: (days: string) => void;
  onExport: (format: "csv" | "json") => void;
}) {
  const { t, locale } = useTranslation();
  const [exportOpen, setExportOpen] = useState(false);
  const yearRef = useRef<HTMLSelectElement>(null);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const [lotTab, setLotTab] = useState<"disposals" | "open">("disposals");
  const [gapReason, setGapReason] = useState("all");
  const [gapPage, setGapPage] = useState(0);
  const [lotPage, setLotPage] = useState(0);
  useEffect(() => {
    setGapPage(0);
    setLotPage(0);
  }, [report, method]);
  const custom = !year;
  const methodText = method === "AVERAGE" ? t("fidelity.cost.averageMethod") : method;
  const today = format(new Date(), "yyyy-MM-dd");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1969 }, (_, index) => String(currentYear - index));
  if (year && !years.includes(year)) years.unshift(year);
  useEffect(() => {
    const close = () => setExportOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, []);
  const shownTo = to && to > today ? today : to;
  const rangeText = `${dateLabel(from, locale, false)} – ${dateLabel(shownTo, locale)}`;
  const subtitle = (custom ? t("fidelity.cost.subtitleCustom") : t("fidelity.cost.subtitleYear"))
    .replace("{year}", year).replace("{range}", rangeText).replace("{method}", methodText);
  const emphasizedSubtitle = subtitle.split(
    new RegExp(`(${locale === "en" ? custom ? "custom range|" : `tax year ${year}|` : ""}${methodText})`, "g"),
  ).map((part, index) => part === methodText || part === `tax year ${year}` || part === "custom range"
    ? <strong key={index}>{part}</strong> : part);
  const tone = (value: number) => directionPhysicalTone(value, quoteColor);
  const gain = (value: number) => <span className="cost-gain ios-money" data-tone={tone(value)}>{signed(value)}</span>;
  const kpiGain = (value: number) => <strong className={signed(value).length > 12 ? "fidelity-long-money" : undefined}>{gain(value)}</strong>;
  const kpiMoney = (value: number) => <strong className={money(value).length > 12 ? "fidelity-long-money" : undefined}>{money(value)}</strong>;
  const unrealized = report?.unrealized.reduce((sum, row) => sum + row.gainLoss, 0) ?? 0;
  const openValue = report?.unrealized.reduce((sum, row) => sum + row.marketValue, 0) ?? 0;
  const openCost = report?.unrealized.reduce((sum, row) => sum + row.costBasis, 0) ?? 0;
  const openRows = useMemo(() => {
    if (!report || method !== "AVERAGE") return report?.unrealized ?? [];
    const grouped = new Map<string, CostBasisReport["unrealized"][number]>();
    for (const row of report.unrealized) {
      const key = `${row.assetType}:${row.symbol}`;
      const previous = grouped.get(key);
      grouped.set(key, previous ? {
        ...previous, amount: previous.amount + row.amount, costBasis: previous.costBasis + row.costBasis,
        marketValue: previous.marketValue + row.marketValue, gainLoss: previous.gainLoss + row.gainLoss,
      } : { ...row });
    }
    return [...grouped.values()];
  }, [report, method]);
  const gaps = useMemo(() => report ? gapRows(report, locale) : [], [report, locale]);
  const reasons = [...new Set(gaps.map((row) => row.reason))];
  const filteredGaps = gapReason === "all" ? gaps : gaps.filter((row) => row.reason === gapReason);
  const pagedGaps = filteredGaps.slice(gapPage * gapPageSize, (gapPage + 1) * gapPageSize);
  const displayDisposals = useMemo(() => {
    if (!report || method !== "AVERAGE") return report?.disposals ?? [];
    const grouped = new Map<string, CostBasisReport["disposals"][number]>();
    for (const row of report.disposals) {
      const previous = grouped.get(row.eventId);
      grouped.set(row.eventId, previous ? {
        ...previous, amount: previous.amount + row.amount, proceeds: previous.proceeds + row.proceeds,
        costBasis: previous.costBasis + row.costBasis, gainLoss: previous.gainLoss + row.gainLoss,
      } : { ...row });
    }
    return [...grouped.values()];
  }, [report, method]);
  const sales = report ? new Set(report.disposals.map((row) => row.eventId)).size : 0;
  const unknown = report?.warnings.filter((row) => row.code === "unknown-disposal") ?? [];
  const firstUnknown = unknown[0];
  const byAsset = (report?.assets ?? []).slice().sort((a, b) => b.gainLoss - a.gainLoss);
  const chartUnknown = unknown.filter((row) => !byAsset.some((asset) =>
    asset.assetType === row.assetType && asset.symbol === row.symbol));
  const biggestPositive = Math.max(0, ...byAsset.map((row) => row.gainLoss));
  const biggestNegative = Math.max(0, ...byAsset.map((row) => -row.gainLoss));
  const zero = biggestNegative / (biggestPositive + biggestNegative || 1) * 92 + 4;
  const barUnit = (100 - zero - 4) / (biggestPositive || 1);
  const selectedLots = lotTab === "open"
    ? openRows.map((row) => ({ kind: "lot" as const, row }))
    : [
      ...displayDisposals.map((row) => ({ kind: "lot" as const, row })),
      ...unknown.map((row) => ({ kind: "unknown" as const, row })),
    ];
  const visibleLots = selectedLots.slice(lotPage * lotPageSize, (lotPage + 1) * lotPageSize);
  const lotGroups = new Map<string, (typeof visibleLots)[number][]>();
  const lotTypes = new Map<string, Set<string>>();
  for (const item of visibleLots) {
    const key = `${item.row.assetType}:${item.row.symbol}`;
    const group = lotGroups.get(key) ?? [];
    group.push(item);
    lotGroups.set(key, group);
    const types = lotTypes.get(item.row.symbol) ?? new Set<string>();
    types.add(item.row.assetType);
    lotTypes.set(item.row.symbol, types);
  }
  const marketValue = (key: string) => report?.unrealized.filter((row) =>
    `${row.assetType}:${row.symbol}` === key)
    .reduce((sum, row) => sum + row.marketValue, 0) ?? 0;
  const sortedLotGroups = [...lotGroups.entries()].sort(([a], [b]) => marketValue(b) - marketValue(a));
  const [currentValues, setCurrentValues] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!report) return;
    let active = true;
    void queryLatestAssets().then((assets) => {
      if (active) setCurrentValues(new Map(assets.map((asset) => [`${asset.assetType}:${asset.symbol}`, asset.value])));
    }).catch(() => { /* The report still has its own position values. */ });
    return () => { active = false; };
  }, [report]);
  const averageAssets = useMemo(() => [...new Map([
    ...report?.disposals ?? [],
    ...report?.openLots ?? [],
  ].map((row) => [`${row.assetType}:${row.symbol}`, { symbol: row.symbol, assetType: row.assetType }])).values()]
    .filter((row) => !report?.warnings.some((warning) => warning.symbol === row.symbol &&
      warning.assetType === row.assetType && warning.code === "unknown-basis")), [report]);
  const averageRows = useMemo(() => averageAssets.slice().sort((a, b) => {
      const value = ({ assetType, symbol }: { assetType: string; symbol: string }) =>
        currentValues.get(`${assetType}:${symbol}`) ?? report?.unrealized.filter((row) =>
          row.symbol === symbol && row.assetType === assetType).reduce((sum, row) => sum + row.marketValue, 0) ?? 0;
      return value(b) - value(a);
    }), [averageAssets, report, currentValues]);
  const [priceAverages, setPriceAverages] = useState<Record<string, PriceAverage>>({});
  useEffect(() => {
    if (!report || !from || !to) return;
    let active = true;
    setPriceAverages({});
    const range = { start: new Date(`${from}T00:00:00.000`), end: new Date(`${to}T23:59:59.999`) };
    void Promise.all(averageAssets.map(async ({ symbol, assetType }) => {
      const transactions = await queryTransactionsBySymbolAndDateRange(symbol, range, assetType);
      const buys = transactions.filter((transaction) => transaction.txnType === "buy");
      const sells = transactions.filter((transaction) => transaction.txnType === "sell");
      const bought = buys.reduce((sum, transaction) => sum + transaction.amount, 0);
      const sold = sells.reduce((sum, transaction) => sum + transaction.amount, 0);
      return [`${assetType}:${symbol}`, {
        bought, buyPrice: bought ? buys.reduce((sum, transaction) => sum + transaction.amount * transaction.price, 0) / bought : null,
        sold, sellPrice: sold ? sells.reduce((sum, transaction) => sum + transaction.amount * transaction.price, 0) / sold : null,
      }] as const;
    })).then((rows) => { if (active) setPriceAverages(Object.fromEntries(rows)); })
      .catch(() => { if (active) setPriceAverages({}); });
    return () => { active = false; };
  }, [report, from, to, averageAssets]);
  const holdingControl = <label className="fidelity-holding-days">
    <span>{t("fidelity.cost.holdingDaysShort")}</span>
    <input type="number" min="1" step="1" value={holdingDays} aria-label={t("cost.holdingDays")}
      onChange={(event) => onHoldingDays(event.target.value)} />
  </label>;

  return <div className="d2-cost fidelity-cost" aria-busy={loading || !filtersCurrent}>
    <header className="fidelity-cost-head">
      <p>{emphasizedSubtitle}</p>
      <button type="button" className="fidelity-pill fidelity-export-button"
        disabled={!report || loading || !filtersCurrent} aria-expanded={exportOpen}
        onClick={() => setExportOpen((open) => !open)}>
        <Icon kind="download" />{t("cost.design.export")}<Icon kind="chevron" />
      </button>
    </header>
    <section className="fidelity-cost-card fidelity-cost-controls" aria-label={t("cost.method")}
      data-average={method === "AVERAGE"}>
      <div className="fidelity-control-row">
        <span className="fidelity-control-label">{t("fidelity.cost.method")}</span>
        <div className="fidelity-segments fidelity-methods" role="group" aria-label={t("cost.method")}>
          {methods.map((value) => <button type="button" key={value} className={method === value ? "selected" : ""}
            aria-pressed={method === value} onClick={() => onMethod(value)}>
            {value === "AVERAGE" ? t("fidelity.cost.averageMethod").replace(/^a/, "A") : value}
          </button>)}
        </div>
      </div>
      <div className="fidelity-control-row">
        <span className="fidelity-control-label">{t("fidelity.cost.period")}</span>
        <div className="fidelity-segments" role="group" aria-label={t("fidelity.cost.period")}>
          <button type="button" className={!custom ? "selected" : ""} aria-pressed={!custom}
            onClick={() => onYear(String(new Date().getFullYear()))}>{t("fidelity.cost.taxYear")}</button>
          <button type="button" className={custom ? "selected" : ""} aria-pressed={custom}
            onClick={() => { if (!custom) onYear(""); }}>{t("fidelity.cost.customRange")}</button>
        </div>
      </div>
      {custom ? <div className="fidelity-date-fields">
        <label><Icon kind="clock" /><span>{dateLabel(from, locale)}</span>
          <input aria-label={t("cost.from")} type="date" value={from} onChange={(event) => onFrom(event.target.value)} /></label>
        <span className="fidelity-date-to-label">{t("cost.to").toLowerCase()}</span>
        <label><Icon kind="clock" /><span>{dateLabel(to, locale)}</span>
          <input aria-label={t("cost.to")} type="date" value={to} onChange={(event) => onTo(event.target.value)} /></label>
      </div> : <label className="fidelity-year-select">
        <span className="sr-only">{t("cost.taxYear")}</span>
        <select ref={yearRef} value={year} aria-label={t("cost.taxYear")}
          onChange={(event) => onYear(event.target.value)}>
          {years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <Icon kind="chevron" />
      </label>}
      <button type="button" className="fidelity-cost-rule" aria-label={t("cost.holdingDays")}
        onClick={() => setHoldingOpen(true)}><Icon kind="info" />
        <span>{method === "AVERAGE" ? t("fidelity.cost.averageRule") :
          t(holdingDays === "365" ? "fidelity.cost.holdingRule" : "fidelity.cost.holdingRuleDays")
            .replace("{days}", holdingDays)}</span>
      </button>
    </section>
    <BottomSheet open={holdingOpen} onOpenChange={setHoldingOpen} title={t("cost.holdingDays")} detents={["medium"]}>
      {holdingControl}
    </BottomSheet>
    {!validRange && <p role="alert" className="fidelity-cost-error">{t("cost.invalidRange")}</p>}
    {firstUnknown && <section className="fidelity-cost-warning">
      <Icon kind="alert" /><div>
        <strong>{t("fidelity.cost.unknownTitle").replace("{coin}", firstUnknown.symbol)}</strong>
        <p>{t("fidelity.cost.unknownBody").replace("{amount}", firstUnknown.amount.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 }))
          .replace("{coin}", firstUnknown.symbol).replace("{date}", dateLabel(firstUnknown.date, locale))}</p>
        <button type="button" className="fidelity-pill" onClick={() => document.getElementById("fidelity-cost-gaps")?.scrollIntoView()}>
          {t("fidelity.cost.reviewWithdrawal")}
        </button>
      </div>
    </section>}
    {loading && !report && <div role="status" className="fidelity-cost-card">{t("common.loading")}</div>}
    {report && <>
      <section className="fidelity-cost-card fidelity-cost-kpis" data-no-sales={sales === 0}
        data-average={method === "AVERAGE"}>
        <div className="fidelity-kpi-primary">
          <div className="fidelity-kpi-metric">
            <span>{t("cost.design.realizedPnl")}</span>{kpiGain(report.totals.gainLoss)}
            <small>{sales ? t("fidelity.cost.salesUnknown").replace("{sales}", String(sales))
              .replace("{unknown}", String(unknown.length)) : t("fidelity.cost.noSales")}</small>
          </div>
          <div className="fidelity-kpi-metric"><span>{t("finance.unrealizedPnl")}</span>
            {kpiGain(unrealized)}<small>{t("fidelity.cost.openToday").replace("{count}", String(openRows.length))}</small>
          </div>
          <div className="fidelity-kpi-metric"><span>{t("cost.design.totalPnl")}</span>
            {kpiGain(report.totals.gainLoss + unrealized)}<small>{t("cost.design.realizedPlusUnrealized")}</small>
          </div>
        </div>
        <div className="fidelity-kpi-secondary">
          <div><span>{t("fidelity.cost.saleProceeds")}</span>{kpiMoney(report.totals.proceeds)}
            <small>{t("fidelity.cost.disposalsCount").replace("{count}", String(report.disposals.length))}</small></div>
          <div><span>{t("fidelity.cost.soldCost")}</span>{kpiMoney(report.totals.costBasis)}
            <small>{t("fidelity.cost.soldCostNote")}</small></div>
          <div><span>{t("cost.design.openValue")}</span>{kpiMoney(openValue)}
            <small>{t("fidelity.cost.openCost").replace("{amount}", money(openCost))}</small></div>
        </div>
      </section>
      <section className="fidelity-cost-card fidelity-cost-holding">
        <div className="fidelity-card-heading"><h2>{t("cost.design.holdingPeriod")}</h2><span>{t("fidelity.cost.realizedOnly")}</span></div>
        {(["long", "short"] as const).map((term) => {
          const rows = report.disposals.filter((row) => row.term === term);
          const value = term === "long" ? report.totals.longTerm : report.totals.shortTerm;
          return <div className="fidelity-holding-row" key={term}>
            <div><span>{t(`cost.term.${term}`)}</span><strong>{method === "AVERAGE" ? "–" : gain(value)}</strong></div>
            <div className="fidelity-holding-track"><span data-tone={tone(value)} style={{ width: `${method === "AVERAGE" ? 0 :
              Math.max(rows.length ? 3 : 0, Math.abs(value) / Math.max(1, Math.abs(report.totals.longTerm) + Math.abs(report.totals.shortTerm)) * 100)}%` }} /></div>
            <small>{method === "AVERAGE" ? t("fidelity.cost.notAvailable") :
              t(term === "long" ? "fidelity.cost.heldLong" : "fidelity.cost.heldShort").replace("{count}", String(rows.length))}</small>
          </div>;
        })}
        {method === "AVERAGE" && <p className="fidelity-holding-note">{t("fidelity.cost.averageHoldingNote")}</p>}
      </section>
      <section className="fidelity-cost-card fidelity-cost-by-asset">
        <div className="fidelity-card-heading"><h2>{t("finance.realizedByAsset")}</h2>
          <span>{t("fidelity.cost.assetRange").replace("{range}", year || t("fidelity.cost.selectedRange"))}</span></div>
        <div className="fidelity-card-scroll" role="region" aria-label={t("finance.realizedByAsset")} tabIndex={0}>
        {byAsset.length || chartUnknown.length ? byAsset.map((row) => <div className="fidelity-asset-bar" key={`${row.assetType}:${row.symbol}`}>
          <strong>{row.symbol}</strong><span className="fidelity-bar-track" style={{ "--z": `${zero}%` } as CSSProperties}>
            {row.gainLoss !== 0 && <i data-tone={tone(row.gainLoss)}
              style={{ width: `${Math.abs(row.gainLoss) * barUnit}%`,
                [row.gainLoss < 0 ? "right" : "left"]: row.gainLoss < 0 ? "calc(100% - var(--z))" : "var(--z)" }} />}
          </span>
          <span className="cost-gain ios-money" data-tone={tone(row.gainLoss)}>
            {`${row.gainLoss > 0 ? "+" : row.gainLoss < 0 ? "−" : ""}$${Math.round(Math.abs(row.gainLoss)).toLocaleString("en-US")}`}
          </span>
        </div>) : <EmptyState icon={BarChartIcon} className="fidelity-chart-empty"
          title={t("fidelity.cost.noChartSales")} hint={t("cost.chart.empty.hint")} />}
        {chartUnknown.map((row) => <div className="fidelity-asset-bar" key={`${row.assetType}:${row.symbol}:unknown`}>
          <strong>{row.symbol}</strong><span className="fidelity-bar-track" style={{ "--z": "0%" } as CSSProperties} /><span className="cost-gain" data-tone="neutral">–</span>
        </div>)}
        </div>
      </section>
      <section className="fidelity-cost-card fidelity-cost-prices">
        <div className="fidelity-card-heading"><h2>{t("fidelity.cost.averagePrices")}</h2></div>
        <div className="fidelity-card-scroll" role="region" aria-label={t("fidelity.cost.averagePrices")} tabIndex={0}>
        {averageRows.length ? averageRows.map(({ symbol, assetType }) => {
          const average = priceAverages[`${assetType}:${symbol}`];
          return <div className="fidelity-price-row" key={`${assetType}:${symbol}`}>
            <div><strong>{symbol}</strong><span>{average?.buyPrice == null
              ? <span className="fidelity-price-placeholder">–</span> : money(average.buyPrice)} <small>{t("cost.design.buy").toLowerCase()}</small>
              {" · "}{average?.sellPrice == null
                ? <span className="fidelity-price-placeholder">–</span> : money(average.sellPrice)} <small>{t("cost.design.sell").toLowerCase()}</small></span></div>
            <small>{t("fidelity.cost.boughtSold").replace("{bought}", average?.bought ? lotAmount(average.bought, assetType) : "–")
              .replace("{sold}", average?.sold ? lotAmount(average.sold, assetType) : "–")}</small>
          </div>;
        }) : <EmptyState icon={BarChartIcon} title={t("cost.prices.empty.title")} hint={t("cost.prices.empty.hint")} />}
        </div>
      </section>
      <section className="fidelity-cost-card fidelity-cost-lots">
        <div className="fidelity-segments" role="group" aria-label={t("cost.realized")}>
          <button type="button" className={lotTab === "disposals" ? "selected" : ""} aria-pressed={lotTab === "disposals"}
            onClick={() => { setLotTab("disposals"); setLotPage(0); }}>
            {t("fidelity.cost.dispositions").replace("{count}", String(displayDisposals.length + unknown.length))}</button>
          <button type="button" className={lotTab === "open" ? "selected" : ""} aria-pressed={lotTab === "open"}
            onClick={() => { setLotTab("open"); setLotPage(0); }}>
            {t("fidelity.cost.openLotsTab").replace("{count}", String(openRows.length))}</button>
        </div>
        <p className="fidelity-lot-note" data-tab={lotTab}>{t(lotTab === "open" ? "fidelity.cost.valueNote" : "fidelity.cost.gainNote")}</p>
        {!selectedLots.length && <EmptyState icon={ArchiveIcon} className="fidelity-no-lots"
          title={lotTab === "open" ? t("cost.lots.empty.title") : t("fidelity.cost.noSalesYear").replace("{year}", year)}
          hint={lotTab === "open" ? t("cost.lots.empty.hint") : t("fidelity.cost.noSalesBody").replace("{count}", String(openRows.length))}>
          <div className="fidelity-no-lots-actions">
            <button type="button" className="fidelity-pill primary" onClick={() => { setLotTab("open"); setLotPage(0); }}>{t("fidelity.cost.showOpenLots")}</button>
            <button type="button" className="fidelity-pill" onClick={() => {
              yearRef.current?.scrollIntoView({ block: "center" });
              yearRef.current?.focus();
            }}>{t("fidelity.cost.chooseAnotherYear")}</button>
          </div>
        </EmptyState>}
        <div className="fidelity-card-scroll" role="region" aria-label={t(lotTab === "open" ? "fidelity.cost.openLotsTab" : "fidelity.cost.dispositions").replace("{count}", "").trim()} tabIndex={0}>
        {sortedLotGroups.map(([key, rows]) => <div className="fidelity-lot-group" key={key}>
          <div className="fidelity-lot-group-head"><strong>{rows[0].row.symbol}
            {lotTypes.get(rows[0].row.symbol)!.size > 1 && <> · {t(`coin.assetType.${rows[0].row.assetType}`)}</>}
          </strong><small>
            {t(lotTab === "open"
              ? rows.length === 1 ? "fidelity.cost.lotGroupOne" : "fidelity.cost.lotGroupCount"
              : rows.length === 1 ? "fidelity.cost.disposalGroupOne" : "fidelity.cost.disposalGroupCount")
              .replace("{count}", String(rows.length))}</small>
            {rows.some((item) => item.kind === "lot")
              ? gain(rows.reduce((sum, item) => sum + (item.kind === "lot" ? item.row.gainLoss : 0), 0))
              : <span className="cost-gain" data-tone="neutral">–</span>}</div>
          {rows.map((item, index) => item.kind === "unknown"
            ? <div className="fidelity-lot-row" key={`${key}:${index}`}>
              <div><strong>{lotAmount(item.row.amount, item.row.assetType)}</strong>
                <span className="fidelity-unknown-term">–</span><span className="cost-gain" data-tone="neutral">–</span></div>
              <small>{t("fidelity.cost.unknownLot").replace("{date}", dateLabel(item.row.date, locale))}</small>
              <small>{t("fidelity.cost.unknownLotNote")}</small>
            </div>
            : <div className="fidelity-lot-row" key={`${key}:${index}`}>
              <div><strong>{lotAmount(item.row.amount, item.row.assetType)}</strong>{method !== "AVERAGE" && <span className="fidelity-term-pill">
                {t(("term" in item.row ? item.row.term === "long" :
                  differenceInCalendarDays(new Date(), new Date(item.row.acquiredAt)) > Number(holdingDays))
                  ? "fidelity.cost.termLong" : "fidelity.cost.termShort")}</span>}
                {method === "AVERAGE" && <span className="fidelity-unknown-term">–</span>}
                {gain(item.row.gainLoss)}</div>
              <small>{lotTab === "open" && method === "AVERAGE" ? t("fidelity.cost.pooled") : lotTab === "open"
                ? t("fidelity.cost.acquiredHeldCompact").replace("{acquired}", dateLabel(item.row.acquiredAt, locale))
                  .replace("{duration}", (() => {
                    const days = Math.max(0, differenceInCalendarDays(new Date(), new Date(item.row.acquiredAt)));
                    return days >= 365 ? `${(days / 365.25).toFixed(1)} y` : `${days} d`;
                  })())
                : method === "AVERAGE" ? t("fidelity.cost.pooledSold")
                  .replace("{sold}", dateLabel("disposedAt" in item.row ? item.row.disposedAt : undefined, locale))
                : t("fidelity.cost.acquiredSold").replace("{acquired}", dateLabel(item.row.acquiredAt, locale))
                  .replace("{sold}", dateLabel("disposedAt" in item.row ? item.row.disposedAt : undefined, locale))}</small>
              <small>{lotTab === "open"
                ? t("fidelity.cost.costValue").replace("{cost}", money(item.row.costBasis)).replace("{value}", money("marketValue" in item.row ? item.row.marketValue : 0))
                : t("fidelity.cost.costProceeds").replace("{cost}", money(item.row.costBasis)).replace("{proceeds}", money("proceeds" in item.row ? item.row.proceeds : 0))}</small>
            </div>)}
        </div>)}
        </div>
        {selectedLots.length > 0 && <div className="fidelity-lot-total">
          <div><strong>{t(lotTab === "open" || !unknown.length ? "history.total" : "fidelity.cost.totalExcludingUnknown")}</strong>
            {gain(lotTab === "open" ? unrealized : report.totals.gainLoss)}</div>
          <small>{lotTab === "open"
            ? t("fidelity.cost.costValue").replace("{cost}", money(openCost)).replace("{value}", money(openValue))
            : t("fidelity.cost.costProceeds").replace("{cost}", money(report.totals.costBasis))
              .replace("{proceeds}", money(report.totals.proceeds))}</small>
        </div>}
        {selectedLots.length > lotPageSize && <div className="fidelity-pager">
          <span>{t("fidelity.cost.gapPage").replace("{start}", String(lotPage * lotPageSize + 1))
            .replace("{end}", String(Math.min((lotPage + 1) * lotPageSize, selectedLots.length)))
            .replace("{count}", String(selectedLots.length))}</span>
          <button type="button" disabled={lotPage === 0} onClick={() => setLotPage(lotPage - 1)}>{t("fidelity.cost.previous")}</button>
          <button type="button" disabled={(lotPage + 1) * lotPageSize >= selectedLots.length}
            onClick={() => setLotPage(lotPage + 1)}>{t("common.next")}</button>
        </div>}
      </section>
      {gaps.length > 0 && <section className="fidelity-cost-card fidelity-cost-gaps" id="fidelity-cost-gaps">
        <div className="fidelity-card-heading"><h2>{t("cost.warnings")}</h2></div>
        <label className="fidelity-gap-filter"><span className="sr-only">{t("fidelity.cost.gapReason")}</span>
          <select value={gapReason} aria-label={t("fidelity.cost.gapReason")} onChange={(event) => { setGapReason(event.target.value); setGapPage(0); }}>
            <option value="all">{t("fidelity.cost.gapAll")}</option>
            {reasons.map((reason) => <option key={reason} value={reason}>{reason === "dust"
              ? t("fidelity.cost.gapDust").replace("{count}", String(gaps.find((row) => row.dust)?.dust ?? 0))
              : t(`fidelity.cost.reason.${reason}`)}</option>)}
          </select><Icon kind="chevron" />
        </label>
        <div className="fidelity-card-scroll" role="region" aria-label={t("cost.warnings")} tabIndex={0}>
        <table aria-label={t("cost.warnings")}><thead><tr>
          <th>{t("fidelity.cost.gapDate")}</th><th>{t("fidelity.cost.gapCoin")}</th>
          <th>{t("fidelity.cost.gapAmount")}</th><th>{t("fidelity.cost.gapReason")}</th>
        </tr></thead><tbody>{pagedGaps.map((row) => <tr key={row.key}>
          <td>{row.date}</td><td>{row.symbol}</td><td>{row.amount}</td>
          <td>{row.dust ? t("fidelity.cost.gapDust").replace("{count}", String(row.dust)) :
            t(`fidelity.cost.reason.${row.reason}`)}</td>
        </tr>)}</tbody></table>
        </div>
        {filteredGaps.length > gapPageSize && <div className="fidelity-pager">
          <span>{t("fidelity.cost.gapPage").replace("{start}", String(gapPage * gapPageSize + 1))
            .replace("{end}", String(Math.min((gapPage + 1) * gapPageSize, filteredGaps.length)))
            .replace("{count}", String(filteredGaps.length))}</span>
          <button type="button" aria-label={t("cost.previousPage").replace("{table}", t("cost.warnings"))}
            disabled={gapPage === 0} onClick={() => setGapPage(gapPage - 1)}>{t("fidelity.cost.previous")}</button>
          <button type="button" aria-label={t("cost.nextPage").replace("{table}", t("cost.warnings"))}
            disabled={(gapPage + 1) * gapPageSize >= filteredGaps.length} onClick={() => setGapPage(gapPage + 1)}>
            {t("common.next")}</button>
        </div>}
      </section>}
      <p className="fidelity-cost-stable-note"><Icon kind="info" />{t("fidelity.cost.stableNote")}</p>
    </>}
    <BottomSheet open={exportOpen} onOpenChange={setExportOpen} title={t("cost.design.export")}
      className="fidelity-cost-export" detents={["medium"]}>
        <button type="button" className="fidelity-export-row" onClick={() => { onExport("csv"); setExportOpen(false); }}>
          <Icon kind="download" /><span><strong>{t("cost.exportCsv")}</strong>
            <small>{t("fidelity.cost.exportCsvNote").replace("{count}", String((report?.disposals.length ?? 0) + (report?.openLots.length ?? 0)))}</small></span>
        </button>
        <button type="button" className="fidelity-export-row" onClick={() => { onExport("json"); setExportOpen(false); }}>
          <Icon kind="download" /><span><strong>{t("cost.exportJson")}</strong>
            <small>{t("fidelity.cost.exportJsonNote")}</small></span>
        </button>
        <p>{t("fidelity.cost.exportNote").replace("{method}", methodText).replace("{range}", rangeText)}</p>
    </BottomSheet>
  </div>;
}
