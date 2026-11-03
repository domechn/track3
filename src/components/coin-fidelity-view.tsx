import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import type { Asset, CurrencyRateDetail, TDateRange, Transaction, TransactionType, WalletAssetsPercentageData, CoinsAmountAndValueChangeData } from "@/middlelayers/types";
import type { AssetType } from "@/middlelayers/datafetch/types";
import type { OtherPrice } from "@/middlelayers/datafetch/types";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import { getConfiguration } from "@/middlelayers/configuration";
import { validateCustomPrice } from "@/middlelayers/custom-price";
import { loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import { queryCoinsAmountChange, queryTotalValue, WALLET_ANALYZER } from "@/middlelayers/charts";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "./ui/use-toast";
import { downsampleIndices } from "@/middlelayers/chart-downsample";
import { changeFromDaysAgo, coinAxisForValues, coinChartY, compactMoney, isExchangeSource, tickIndices } from "./fidelity-data";

type Props = {
  symbol: string;
  assetType: AssetType;
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  lastAsset?: Asset;
  transactions: Transaction[];
  walletAliasMap: Record<string, string | undefined>;
  quoteColor: "green-up-red-down" | "red-up-green-down";
  onEdit: (transaction: Transaction, type: TransactionType, quotePrice: number | undefined) => Promise<boolean>;
};

const num = (value: number, digits = 2) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const roundedCents = (value: number) => Math.sign(value) * Math.round((Math.abs(value) + 1e-8) * 100) / 100;
const signedTone = (value: number) => value > 0 ? "positive" : value < 0 ? "negative" : "";
const date = (value: string | number) => format(new Date(value), "d MMM yyyy");
const dataRange = (days: number, end: Date): TDateRange => {
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
};

function line(values: number[], indices: number[], total: number, lower: number, upper: number, width = 720, height = 315) {
  if (!values.length) return "";
  return values.map((value, index) => `${index ? "L" : "M"}${(indices[index] / Math.max(1, total - 1) * width).toFixed(2)} ${coinChartY(value, lower, upper, height).toFixed(2)}`).join(" ");
}

export default function CoinFidelityView({ symbol, assetType, currency, dateRange, lastAsset, transactions, walletAliasMap, quoteColor, onEdit }: Props) {
  const { t, locale } = useTranslation();
  const money = (value: number | undefined, sign = false, digits = 2) => value === undefined || !Number.isFinite(value) ? "–" : `${sign && value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${num(Math.abs(value * currency.rate), digits)}`;
  const navigate = useNavigate();
  const changed = useDataChangedVersion();
  const [series, setSeries] = useState<CoinsAmountAndValueChangeData>();
  const [metricSeries, setMetricSeries] = useState<CoinsAmountAndValueChangeData>();
  const [sources, setSources] = useState<WalletAssetsPercentageData>([]);
  const [report, setReport] = useState<CostBasisReport>();
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [customPrice, setCustomPrice] = useState<OtherPrice>();
  const [mode, setMode] = useState<"value" | "price">("value");
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const [range, setRange] = useState<"all" | "30d" | "1y">("all");
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [edit, setEdit] = useState<Transaction>();
  const [sheet, setSheet] = useState<Transaction>();
  const [editType, setEditType] = useState<TransactionType>("buy");
  const [editPrice, setEditPrice] = useState("");
  const [editPriceDirty, setEditPriceDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const metricsQuery = queryCoinsAmountChange(symbol, dataRange(30, dateRange.end), 800, assetType);
    Promise.all([
      windowDays === 30 ? metricsQuery : queryCoinsAmountChange(symbol, dataRange(windowDays, dateRange.end), 800, assetType),
      metricsQuery,
      WALLET_ANALYZER.queryWalletAssetsPercentage(symbol, assetType),
      loadCostBasisReport({ method: "FIFO" }),
      queryTotalValue(),
    ]).then(([nextSeries, nextMetrics, nextSources, nextReport, nextTotal]) => {
      if (!active) return;
      setLoadError(false);
      setSeries(nextSeries);
      setMetricSeries(nextMetrics);
      setSources([...nextSources].sort((a, b) => (a.walletAlias ?? a.walletType ?? "").localeCompare(b.walletAlias ?? b.walletType ?? "")));
      setReport(nextReport);
      setPortfolioTotal(nextTotal.totalValue);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [symbol, assetType, windowDays, dateRange.end, changed, retry]);

  useEffect(() => {
    let active = true;
    getConfiguration().then((config) => {
      if (!active) return;
      const row = assetType === "crypto" ? config?.others.find((item) =>
        !item.attachTo && item.symbol.trim().toUpperCase() === symbol.trim().toUpperCase()) : undefined;
      setCustomPrice(row?.price && validateCustomPrice(row.price, config!.others.map((item) => item.symbol), row.symbol)
        ? row.price : undefined);
    }).catch(() => { if (active) setCustomPrice(undefined); });
    return () => { active = false; };
  }, [symbol, assetType, changed]);

  const sourceName = (wallet: string) => (walletAliasMap[wallet]?.replace(/\s+\([^)]*\)$/, "") ?? sources.find((row) => row.wallet === wallet)?.walletAlias ?? sources.find((row) => row.wallet === wallet)?.walletType ?? wallet.slice(0, 10)).replaceAll("...", "…");
  const amount = lastAsset?.amount ?? 0;
  const custom = !!customPrice;
  const value = lastAsset?.value ?? 0;
  const price = lastAsset?.price ?? 0;
  const rows = transactions.filter((row) => filter === "all" || row.txnType === filter);
  const rangeStart = range === "all" ? 0 : dateRange.end.getTime() - (range === "30d" ? 30 : 365) * 86400000;
  const rangeTransactions = transactions.filter((row) => new Date(row.txnCreatedAt).getTime() >= rangeStart);
  const buys = rangeTransactions.filter((row) => row.txnType === "buy");
  const sells = rangeTransactions.filter((row) => row.txnType === "sell");
  const buyQty = buys.reduce((sum, row) => sum + row.amount, 0);
  const sellQty = sells.reduce((sum, row) => sum + row.amount, 0);
  const buyCost = buys.reduce((sum, row) => sum + row.amount * row.price, 0);
  const sellProceeds = sells.reduce((sum, row) => sum + row.amount * row.price, 0);
  const averageBuy = buyQty ? buyCost / buyQty : undefined;
  const averageSell = sellQty ? sellProceeds / sellQty : undefined;
  const breakEven = amount && buyQty ? (buyCost - sellProceeds) / amount : undefined;
  const lots = report?.openLots.filter((row) => row.symbol === symbol && row.assetType === assetType) ?? [];
  const valuedLots = report?.unrealized.filter((row) => row.symbol === symbol && row.assetType === assetType) ?? [];
  const unpricedDeposits = custom && !transactions.some((row) => row.txnType === "sell") ? transactions.filter((row) => row.txnType === "deposit" && row.price === 0) : [];
  const allDisposals = report?.disposals.filter((row) => row.symbol === symbol && row.assetType === assetType) ?? [];
  const disposals = allDisposals.filter((row) => new Date(row.disposedAt).getTime() >= rangeStart);
  const realized = disposals.reduce((total, row) => total + row.gainLoss, 0);
  const unrealized = valuedLots.reduce((total, row) => total + roundedCents(row.gainLoss), 0);
  const values = useMemo(() => series?.values.map((value, index) => mode === "value" ? value : value / (series.amounts[index] || 1)) ?? [], [series, mode]);
  const plotIndices = useMemo(() => downsampleIndices([values], 100), [values]);
  const plotValues = plotIndices.map((index) => values[index]);
  const priceChange = (days: number) => {
    if (!metricSeries?.values.length) return null;
    const prices = metricSeries.values.map((value, index) => value / (metricSeries.amounts[index] || 1));
    const change = changeFromDaysAgo(metricSeries.timestamps, prices, dateRange.end.getTime(), days, price);
    return change && { percent: change.ratio * 100, dollars: change.dollars };
  };
  const p1 = priceChange(1), p7 = priceChange(7), p30 = priceChange(30);
  const changeMetric = (label: string, change: ReturnType<typeof priceChange>) => metric(label, change ? `${change.percent > 0 ? "+" : change.percent < 0 ? "−" : ""}${num(Math.abs(change.percent))}%` : "–", change ? money(change.dollars, true) : "–", change ? signedTone(change.percent) : "");
  const startValue = values[0], endValue = values.at(-1);
  const high = values.length ? Math.max(...values) : 0, low = values.length ? Math.min(...values) : 0;
  const { lower: axisLow, upper: axisHigh, ticks: axisTicks } = coinAxisForValues(values);
  const axisLabels = [...axisTicks].reverse().map((tick) => values.length ? compactMoney(tick * currency.rate, currency.symbol).replace(currency.symbol, "") : "–");
  const endLabel = money(endValue, false, mode === "value" ? 0 : 2);
  const plotStyle = {
    "--coin-axis-pad": `${12 + Math.max(...axisLabels.map((label) => label.length)) * 8}px`,
    "--coin-end-pad": `${6 + endLabel.length * 8}px`,
    "--coin-grid-pitch": `${(assetType === "stock" ? 165.6 : 334) / Math.max(1, axisTicks.length - 1)}px`,
  } as CSSProperties;
  const xDates = (windowDays === 7 && series?.timestamps.length === 8
    ? [0, 2, 4, 7] : tickIndices(series?.timestamps.length ?? 0, windowDays === 30 ? 7 : 4))
    .map((index) => ({ timestamp: series?.timestamps[index], index }));
  const tickDate = (timestamp: number | undefined) => timestamp ? format(new Date(timestamp), "d MMM") : "–";
  const coinName = symbol;
  const sourceCount = sources.length === 1 ? t("coin.fidelity.sourceOne") : t("coin.fidelity.sourcesCount").replace("{count}", String(sources.length));
  const sourceNames = new Intl.ListFormat(locale === "zh" ? "zh-CN" : "en", { style: "long", type: "conjunction" })
    .format(sources.map((source) => source.walletAlias ?? source.walletType ?? source.wallet.slice(0, 10)));
  const subtitle = custom ? t("coin.fidelity.customSubtitle").replace("{source}", sourceNames)
    : t(assetType === "stock" ? "coin.fidelity.heldAtBrokerStandalone" : "coin.fidelity.held").replace("{sources}", sources.length === 2 && sources.some((source) => !isExchangeSource(source.walletType)) && locale !== "zh"
      ? sourceNames.replace(" and ", " and a ") : sourceNames);
  const saleRange = disposals.length === 0 ? t("coin.fidelity.noSalesRange") : disposals.length === 1 ? t("coin.fidelity.saleRangeOne") : t("coin.fidelity.salesRange").replace("{count}", String(disposals.length));
  const saleFifo = disposals.length === 1 ? t("coin.fidelity.saleFifoOne") : t("coin.fidelity.salesFifo").replace("{count}", String(disposals.length));
  const metric = (label: string, main: string, sub: string, cls = "", note?: string) => <div className="coin-fidelity-metric"><span>{label}</span><strong className={main === "–" ? "zero" : cls}>{main}</strong><small>{sub}</small>{note && <small className="coin-fidelity-warning">{note}</small>}</div>;
  const editPriceFor = (row: Transaction) => num(row.price * currency.rate, custom ? 4 : 2);
  const openEdit = (row: Transaction) => { setSheet(undefined); setEdit(row); setEditType(row.txnType); setEditPrice(editPriceFor(row)); setEditPriceDirty(false); };

  async function commitEdit() {
    if (!edit || saving) return;
    const nextPrice = Number(editPrice.replaceAll(",", ""));
    if (editPrice.trim() === "" || !Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(currency.rate) || currency.rate <= 0) {
      toast({ description: t("coin.invalidPrice"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (await onEdit(edit, editType, editPriceDirty ? nextPrice : undefined)) setEdit(undefined);
    } finally { setSaving(false); }
  }

  const sheetDisposals = sheet ? allDisposals.filter((disposal) => disposal.eventId === String(sheet.id)) : [];
  const sheetGain = sheetDisposals.reduce((total, disposal) => total + disposal.gainLoss, 0);
  return <div className={`analyze-coin coin-fidelity${assetType === "stock" ? " coin-fidelity-stock" : ""}${custom ? " coin-fidelity-custom" : ""}${quoteColor === "red-up-green-down" ? " fidelity-reverse" : ""}`}>
    <div className="coin-fidelity-heading">
      <div><div className="coin-fidelity-crumb"><span>{t("coin.fidelity.overview")}</span><CoinChevron /><span>{t("coin.fidelity.coins")}</span><CoinChevron /><span>{symbol}</span></div><h1>{coinName} <b>{custom ? t("coin.fidelity.customAsset") : assetType === "stock" ? t("coin.assetType.stock") : t("coin.assetType.crypto")}</b></h1><p>{subtitle}</p></div>
      <Button variant="outline" onClick={() => navigate("/cost-basis")}><svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.5v13M12 5.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.2 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" /></svg> {t("coin.openCostBasis")}</Button>
    </div>
    {loadError && <div className="fidelity-empty" role="alert">{t("summary.fidelity.loadError")} <button onClick={() => setRetry((value) => value + 1)}>{t("summary.fidelity.retry")}</button></div>}
    <section className="coin-fidelity-card coin-fidelity-hero">
      {custom ? <div className="coin-fidelity-metrics top custom">
        {metric(customPrice.kind === "manual" ? t("coin.fidelity.manualPrice") : t("coin.fidelity.currentPrice"), money(price, false, 4), customPrice.kind === "manual" ? t("coin.fidelity.setByYou").replace("{date}", date(customPrice.setAt)) : t("coin.customPrice.follow").replace("{symbol}", customPrice.symbol), "primary")}
        {metric(t("coin.fidelity.priceFeed"), customPrice.kind === "follow" ? customPrice.symbol : t("coin.fidelity.none"), customPrice.kind === "follow" ? "" : t("coin.fidelity.noChanges"))}
        {metric(t("coin.fidelity.holdingsValue"), money(value), `${num(amount, 2)} ${symbol}`)}
        {metric(t("coin.fidelity.sharePortfolio"), portfolioTotal ? `${num(value / portfolioTotal * 100, 1)}%` : "–", t("coin.fidelity.ofTotal").replace("{value}", money(portfolioTotal)))}
      </div> : <div className="coin-fidelity-metrics top">
        {metric(t("coin.fidelity.priceFor").replace("{name}", coinName), money(price, false, price < 0.01 ? 8 : 2), t("coin.fidelity.perAll").replace("{symbol}", symbol), "primary")}
        {changeMetric(assetType === "stock" ? t("coin.fidelity.oneDay") : "24h", p1)}
        {changeMetric("7D", p7)}
        {changeMetric("30D", p30)}
        {metric(t("coin.fidelity.holdingsValue"), money(value), `${num(amount, assetType === "stock" ? 0 : 4)} ${symbol}`)}
        {metric(t("coin.fidelity.sharePortfolio"), portfolioTotal ? `${num(value / portfolioTotal * 100, 1)}%` : "–", t("coin.fidelity.ofTotal").replace("{value}", money(portfolioTotal)))}
      </div>}
      <div className="coin-fidelity-position-header"><h2>{t("coin.fidelity.position")}</h2><div>FIFO <select aria-label={t("coin.fidelity.position")} value={range} onChange={e => setRange(e.target.value as typeof range)}><option value="all">{t("coin.fidelity.rangeAll")}</option><option value="30d">{t("coin.fidelity.range30")}</option><option value="1y">{t("coin.fidelity.rangeYear")}</option></select></div></div>
      <div className="coin-fidelity-metrics bottom">
        {metric(t("coin.fidelity.positions"), `${num(amount, custom ? 2 : assetType === "stock" ? 0 : 4)} ${symbol}`, sourceCount)}
        {metric(t("coin.fidelity.costPrice"), money(averageBuy, false, custom ? 4 : 2), t("coin.fidelity.avgBuy"), "", custom && buyQty < amount ? t("coin.fidelity.pricedBuysOnly").replace("{priced}", num(buyQty, 0)).replace("{total}", num(amount, 0)) : undefined)}
        {metric(t("coin.fidelity.avgSell"), money(averageSell), saleRange)}
        {metric(t("coin.fidelity.breakevenPrice"), money(custom && buyQty < amount ? undefined : breakEven), custom && buyQty < amount ? t("coin.fidelity.needsEveryPrice") : price && breakEven ? t("coin.fidelity.priceAbove").replace("{percent}", num((price / breakEven - 1) * 100, 1)) : "–")}
        {metric(t("coin.fidelity.realized"), money(realized, realized !== 0), disposals.length ? saleFifo : t("coin.fidelity.nothingSold"), signedTone(realized) || "zero")}
        {metric(t("coin.fidelity.unrealized"), custom && buyQty < amount ? "–" : money(unrealized, true), custom && buyQty < amount ? t("coin.fidelity.missingFirst") : t("coin.fidelity.openToday"), custom && buyQty < amount ? "" : signedTone(unrealized))}
      </div>
    </section>
    <div className="coin-fidelity-grid">
      {custom ? <section className="coin-fidelity-card coin-fidelity-chart coin-fidelity-manual-history">
        <div className="coin-fidelity-section-head"><h2>{t("coin.fidelity.price")}</h2><small>{t("coin.fidelity.manual")}</small></div>
        <div className="fidelity-empty">{t("coin.fidelity.noMarketHistory").replace("{symbol}", symbol)}</div>
        {customPrice.kind === "manual" && <div className="coin-fidelity-price-history-row"><div>{date(customPrice.setAt)}<small>{t("coin.fidelity.manualPrice")}</small></div><span>{money(customPrice.usd, false, 4)}</span></div>}
        {buys.map(row => <div key={row.id} className="coin-fidelity-price-history-row"><div>{date(row.txnCreatedAt)}<small>{t("coin.fidelity.fromBuy").replace("{amount}", num(row.amount, 0)).replace("{symbol}", symbol)}</small></div><span>{money(row.price, false, 4)}</span></div>)}
        {transactions.filter(row => row.txnType === "deposit" && row.price === 0).map(row => <div key={row.id} className="coin-fidelity-price-history-row"><div>{date(row.txnCreatedAt)}<small>{t("coin.fidelity.depositNoPrice")}</small></div><span className="zero">–</span></div>)}
        <button className="coin-fidelity-set-price" onClick={() => navigate("/settings/configuration")}><FidelityPencil />{t("coin.fidelity.setCurrentPrice")}</button>
      </section> : <section className="coin-fidelity-card coin-fidelity-chart" style={plotStyle}>
        <div className="coin-fidelity-section-head"><div><h2>{t(mode === "value" ? "coin.fidelity.valueHoldings" : "coin.fidelity.price")}</h2><p>{mode === "value" ? t("coin.fidelity.currentHoldings").replace("{amount}", num(amount, assetType === "stock" ? 0 : 4)).replace("{symbol}", symbol) : t("coin.fidelity.inUsd").replace("{symbol}", symbol).replace("{currency}", currency.currency)}</p></div><div className="coin-fidelity-chart-controls">
          <div className="coin-fidelity-controls" role="group" aria-label={t("coin.fidelity.valueHoldings")}><button type="button" aria-pressed={mode === "value"} className={mode === "value" ? "active" : ""} onClick={() => setMode("value")}>{t("coin.fidelity.value")}</button><button type="button" aria-pressed={mode === "price"} className={mode === "price" ? "active" : ""} onClick={() => setMode("price")}>{t("coin.fidelity.price")}</button></div>
          <div className="coin-fidelity-controls" role="group" aria-label={t("datePicker.predefined")}><button type="button" aria-pressed={windowDays === 7} className={windowDays === 7 ? "active" : ""} onClick={() => setWindowDays(7)}>7D</button><button type="button" aria-pressed={windowDays === 30} className={windowDays === 30 ? "active" : ""} onClick={() => setWindowDays(30)}>30D</button></div>
        </div></div>
        <div className="coin-fidelity-plot"><div className="coin-fidelity-ylabels">{axisLabels.map((label, index) => <span key={index}>{label}</span>)}</div><svg viewBox="0 0 720 315" preserveAspectRatio="none" role="img" aria-label={t(mode === "value" ? "coin.fidelity.valueHoldings" : "coin.fidelity.price")}><path d={line(plotValues, plotIndices, values.length, axisLow, axisHigh)} />{plotIndices.map((sourceIndex) => {
          const point = values[sourceIndex];
          const label = `${date(series?.timestamps[sourceIndex] ?? 0)}: ${money(point)}`;
          return <circle key={sourceIndex} data-point cx={sourceIndex / Math.max(1, values.length - 1) * 720} cy={coinChartY(point, axisLow, axisHigh, 315)} r="6" fill="transparent" role="img" tabIndex={0} aria-label={label}><title>{label}</title></circle>;
        })}</svg>{values.length > 0 && <b style={{ top: `${Math.max(0, Math.min(90, (1 - ((endValue ?? axisLow) - axisLow) / (axisHigh - axisLow)) * 100))}%` }}>{endLabel}</b>}</div>
        <div className="coin-fidelity-xlabels">{xDates.map(({ timestamp, index }, tick) => <span key={index} style={{ left: `${index / Math.max(1, (series?.timestamps.length ?? 1) - 1) * 100}%`, transform: tick === 0 ? "none" : tick === xDates.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>{tickDate(timestamp)}</span>)}</div>
        <div className="coin-fidelity-chart-stats">{metric(t("coin.fidelity.high"), money(high), values.length ? tickDate(series!.timestamps[values.indexOf(high)]) : "–")}{metric(t("coin.fidelity.low"), money(low), values.length ? tickDate(series!.timestamps[values.indexOf(low)]) : "–")}{metric(t("coin.fidelity.since").replace("{date}", tickDate(series?.timestamps[0])), startValue && endValue ? money(endValue-startValue, true) : "–", startValue && endValue ? `${endValue >= startValue ? "+" : "−"}${num(Math.abs((endValue/startValue-1)*100),2)}%` : "–")}</div>
      </section>}
      <section className="coin-fidelity-card coin-fidelity-sources" tabIndex={0}>
        <div className="coin-fidelity-section-head"><h2>{t("coin.fidelity.holdingsSource")}</h2><small>{sourceCount}</small></div>
        <table><thead><tr><th>{t("coin.fidelity.source")}</th><th>{t("coin.fidelity.quantity")}</th><th>{t("coin.fidelity.value")}</th><th>{t("coin.fidelity.share")}</th></tr></thead>
          <tbody>{sources.map(row => <tr key={row.wallet}><td>{(row.walletAlias ?? row.walletType ?? row.wallet.slice(0, 10)).replaceAll("...", "…")} <small>{assetType === "stock" ? t("coin.fidelity.broker") : isExchangeSource(row.walletType) ? t("coin.fidelity.exchange") : t("coin.fidelity.wallet")}</small></td><td>{num(row.amount, custom ? 2 : assetType === "stock" ? 0 : 4)}</td><td>{money(row.value)}</td><td>{num(row.percentage,1)}%</td></tr>)}<tr className="total"><td>{t("coin.fidelity.total")}</td><td>{num(amount, custom ? 2 : assetType === "stock" ? 0 : 4)}</td><td>{money(value)}</td><td>100.0%</td></tr></tbody></table>
        <div className="coin-fidelity-lots-head"><h2>{t("coin.fidelity.openLots")}</h2><small>{t("coin.fidelity.lotsCount").replace("{count}", String(lots.length + unpricedDeposits.length))}</small></div>
        <table><thead><tr><th>{t("coin.fidelity.acquired")}</th><th>{t("coin.fidelity.quantity")}</th><th>{t("coin.fidelity.costPrice")}</th><th>{t("coin.fidelity.unrealizedShort")}</th></tr></thead>
          <tbody>{lots.map((lot, i) => { const valued = valuedLots.find((row) => row.id === lot.id); return <tr key={`${lot.id}-${i}`}><td>{date(lot.acquiredAt)}</td><td>{num(lot.amount, custom ? 2 : assetType === "stock" ? 0 : 4)}</td><td className={valued ? "" : "zero"}>{valued ? money(lot.costBasis / lot.amount, false, custom ? 4 : 2) : "–"}</td><td className={valued ? signedTone(valued.gainLoss) : "zero"}>{valued ? money(roundedCents(valued.gainLoss), true) : "–"}</td></tr>; })}
            {unpricedDeposits.map((row) => <tr key={`unpriced-${row.id}`}><td>{date(row.txnCreatedAt)}</td><td>{num(row.amount, 2)}</td><td className="zero">–</td><td className="zero">–</td></tr>)}</tbody></table>
      </section>
    </div>
    <section className="coin-fidelity-card coin-fidelity-transactions">
      <div className="coin-fidelity-section-head"><h2>{t("coin.fidelity.transactions")}</h2><div className="coin-fidelity-controls" role="group" aria-label={t("coin.fidelity.transactions")}>{(["all","buy","sell","deposit","withdraw"] as const).filter((key) => key === "all" || transactions.some((row) => row.txnType === key)).map((key) => {
        const count = key === "all" ? transactions.length : transactions.filter((row) => row.txnType === key).length;
        return <button type="button" key={key} aria-pressed={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{t(`coin.fidelity.${key}`)} {count}</button>;
      })}</div></div>
      <table><thead><tr><th>{t("coin.fidelity.date")}</th><th>{t("coin.fidelity.type")}</th><th>{t("coin.fidelity.quantity")}</th><th>{t("coin.fidelity.price")}</th><th>{t("coin.fidelity.value")}</th><th>{t("coin.fidelity.source")}</th><th /></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td><button className="coin-fidelity-detail-link" onClick={() => setSheet(row)}><span className="sr-only">{t("coin.fidelity.detail").replace("{date}", date(row.txnCreatedAt)).replace("{type}", t(`coin.fidelity.${row.txnType}`))}</span>{date(row.txnCreatedAt)}<small>{format(new Date(row.txnCreatedAt), "HH:mm")}</small></button></td><td><span className="coin-fidelity-pill">{t(`coin.fidelity.${row.txnType}`)}</span></td><td>{num(row.amount, custom ? 2 : assetType === "stock" ? 0 : 4)}</td><td className={row.txnType === "deposit" || row.txnType === "withdraw" ? "zero" : ""}>{row.txnType === "deposit" || row.txnType === "withdraw" ? "–" : money(row.price, false, custom ? 4 : 2)}</td><td className={row.txnType === "deposit" || row.txnType === "withdraw" ? "zero" : ""}>{row.txnType === "deposit" || row.txnType === "withdraw" ? "–" : money(row.price * row.amount)}</td><td>{sourceName(row.wallet ?? "")}</td><td><button className="coin-fidelity-edit-button" aria-label={t("coin.fidelity.editFor").replace("{date}", date(row.txnCreatedAt))} onClick={() => openEdit(row)}><FidelityPencil /></button></td></tr>)}</tbody></table>
      <p>{t("coin.fidelity.editNote")}</p>
    </section>
    <Dialog open={!!edit} onOpenChange={(open) => { if (!open) setEdit(undefined); }}><DialogContent className={`coin-fidelity-dialog${custom ? " custom" : ""}`} closeIcon={<FidelityClose />} onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById("fidelity-edit-price")?.focus(); }}>
      <DialogHeader><DialogTitle>{t("coin.fidelity.editTransaction")}</DialogTitle></DialogHeader><p>{t("coin.fidelity.editDescription")}</p>
      {edit && <>
        <div className="coin-fidelity-imported"><strong>{t(`coin.fidelity.${edit.txnType}`)}</strong><span>{num(edit.amount, custom ? 2 : assetType === "stock" ? 0 : 4)} {symbol}</span><span>·</span><span>{date(edit.txnCreatedAt)}, {format(new Date(edit.txnCreatedAt), "HH:mm")}</span><span>·</span><span>{sourceName(edit.wallet ?? "")}</span></div>
        {custom && <div className="coin-fidelity-custom-warning"><svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></svg><div><strong>{t("coin.fidelity.noMarketPrice").replace("{symbol}", symbol)}</strong>{t("coin.fidelity.yourPrices")}</div></div>}
        <label>{t("coin.fidelity.type")} {editType !== edit.txnType && <span className="coin-fidelity-changed">{t("coin.fidelity.changedFrom").replace("{type}", t(`coin.fidelity.${edit.txnType}`).toLowerCase())}</span>}</label>
        <div className="coin-fidelity-controls coin-fidelity-type" role="group" aria-label={t("coin.fidelity.type")}>{(["buy","sell","deposit","withdraw"] as TransactionType[]).map((type) => <button type="button" key={type} aria-pressed={editType === type} className={editType === type ? "active" : ""} onClick={() => setEditType(type)}>{t(`coin.fidelity.${type}`)}</button>)}</div>
        <p className="coin-fidelity-hint">{t("coin.fidelity.typeExplanation")}</p>
        <label htmlFor="fidelity-edit-price">{t("coin.fidelity.pricePer").replace("{symbol}", symbol)}</label>
        <div className="coin-fidelity-price-input"><span>{currency.symbol}</span><Input id="fidelity-edit-price" value={editPrice} onChange={(event) => { setEditPrice(event.target.value); setEditPriceDirty(true); }} /><small>{t("coin.fidelity.usdPer").replace("{symbol}", symbol).replace("{currency}", currency.currency)}</small></div>
        <p className="coin-fidelity-value-hint">{custom ? t("coin.fidelity.yourPriceOn").replace("{date}", date(edit.txnCreatedAt))
          : t("coin.fidelity.valueVsToday")
            .replace("{amount}", `${currency.symbol}${num(Number(editPrice.replaceAll(",", "")) * edit.amount)}`)
            .replace("{percent}", price ? num(Math.abs(Number(editPrice.replaceAll(",", "")) / currency.rate / price - 1) * 100, 1) : "–")
            .replace("{direction}", Number(editPrice.replaceAll(",", "")) / currency.rate < price ? t("coin.fidelity.below") : t("coin.fidelity.above"))}</p>
        {custom && <div className="coin-fidelity-custom-settings"><hr /><strong>{t("coin.fidelity.assetNamed").replace("{symbol}", symbol)}</strong><div><label htmlFor="fidelity-asset-type">{t("coin.fidelity.assetType")}</label><label htmlFor="fidelity-current-price">{t("coin.fidelity.currentPrice")}</label><output id="fidelity-asset-type">{t("coin.assetType.crypto")}</output><output id="fidelity-current-price" title={t("coin.fidelity.assetPriceEditHint")}>{money(customPrice?.kind === "manual" ? customPrice.usd : undefined, false, 4)} <small>{currency.currency}</small></output></div><p>{t("coin.fidelity.assetSettingsNote").replace("{symbol}", symbol)}</p></div>}
        <div className="coin-fidelity-dialog-actions"><button onClick={() => { setEditType(edit.txnType); setEditPrice(editPriceFor(edit)); setEditPriceDirty(false); }}>{t("coin.fidelity.resetChanges")}</button><span /><Button variant="outline" onClick={() => setEdit(undefined)}>{t("common.cancel")}</Button><Button disabled={saving} onClick={commitEdit}>{t("common.save")}</Button></div>
      </>}
    </DialogContent></Dialog>
    <Dialog open={!!sheet} onOpenChange={(open) => { if (!open) setSheet(undefined); }}><DialogContent className={`coin-fidelity-sheet${quoteColor === "red-up-green-down" ? " fidelity-reverse" : ""}`} closeIcon={<FidelityClose />}>
      {sheet && <><DialogHeader><DialogTitle>{t(`coin.fidelity.${sheet.txnType}`)} {num(sheet.amount, custom ? 2 : assetType === "stock" ? 0 : 4)} {symbol}</DialogTitle></DialogHeader><p>{date(sheet.txnCreatedAt)}, {format(new Date(sheet.txnCreatedAt), "HH:mm")} · {sourceName(sheet.wallet ?? "")}</p>
      <div className="coin-fidelity-sheet-row"><span>{t("coin.fidelity.type")}</span><span className="coin-fidelity-pill">{t(`coin.fidelity.${sheet.txnType}`)}</span></div>
      {[[t("coin.fidelity.quantity"), `${num(sheet.amount, 4)} ${symbol}`], [t("coin.fidelity.price"), money(sheet.price)], [t("coin.fidelity.value"), money(sheet.price * sheet.amount)], [t("coin.fidelity.source"), sourceName(sheet.wallet ?? "")]].map(([label, val]) => <div className="coin-fidelity-sheet-row" key={label}><span>{label}</span><strong>{val}</strong></div>)}
      <div className="coin-fidelity-sheet-row"><span>{t("coin.fidelity.reference")}</span><strong className="zero">–</strong></div>
      {sheetDisposals.length > 0 && <div className="coin-fidelity-sheet-row"><span>{t("coin.fidelity.realizedFifo")}</span><strong className={signedTone(sheetGain)}>{money(sheetGain, true)}</strong></div>}
      <Button className="coin-fidelity-sheet-action primary" onClick={() => openEdit(sheet)}><FidelityPencil /> {t("coin.fidelity.editTypePrice")}</Button><Button className="coin-fidelity-sheet-action" variant="outline" onClick={() => setSheet(undefined)}>{t("coin.fidelity.close")}</Button>
      </>}
    </DialogContent></Dialog>
  </div>;
}
function FidelityPencil({ size = 14 }: { size?: number }) {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 15l.8-3.5L12.5 3l2.5 2.5-8.7 8.7z" />
  </svg>;
}
function FidelityClose() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l10 10M14 4L4 14" /></svg>;
}
function CoinChevron() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l5 5-5 5" /></svg>;
}
