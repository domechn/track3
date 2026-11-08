import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fittingDateTickIndices, needsMetricStack } from "./coin-metric-fit";
import type { AssetModel, AssetReference, CurrencyRateDetail, HistoricalData, TDateRange, Transaction } from "@/middlelayers/types";
import type { AssetType } from "@/middlelayers/datafetch/types";
import { listAllowedSymbols, queryEditLog, queryHistoricalData, queryTransactionsBySymbolAndDateRange } from "@/middlelayers/charts";
import type { SnapshotEdit } from "@/middlelayers/charts-history";
import { calculateCostBasis, fromStoredTransactions } from "@/middlelayers/cost-basis";
import { getConfiguration, getCostBasisMethod } from "@/middlelayers/configuration";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { persistedTransactionPrice } from "@/middlelayers/ui-state/transaction-price";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/mobile/i18n";
import { toast } from "@/mobile/components/ui/use-toast";
import { BottomSheet } from "@/mobile/components/mobile";
import { ArchiveIcon, BackpackIcon, ChevronRightIcon, ClockIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import { buildAssetDetailsPath, formatAssetLabel, getAssetLogoKey } from "@/utils/assets";
import { currencyWrapper } from "@/utils/currency";
import { sourceDisplayNames } from "@/components/source-display-name";
import { CoinSourceSummary } from "@/components/coin-source-summary";
import { useLatestWalletOrdinals } from "@/components/source-name-order";
import { Pager, usePager } from "@/components/ui/pager";
import { groupCoinSources } from "@/components/coin-detail-sections";
import AssetLabel from "@/components/common/asset-label";
import { sourceIconKind } from "@/components/source-allocation-list";
import "@/mobile/components/mobile/fidelity.css";
import { useChartHitArea } from "@/components/chart-tooltip";

type Source = { name: string; amount: number; value: number; wallet: string };
type Point = { date: Date; amount: number; value: number; price: number };
type ImportedEdit = { type: Transaction["txnType"]; price: number };
type Data = { points: Point[]; sources: Source[]; transactions: Transaction[]; currentTotal: number; manual: boolean; manualSetAt?: string; manualUsd?: number; followSymbol?: string; displayName?: string;
  aliases: Record<string, { wallet: string; alias: string; type: string } | undefined>; edits: Record<number, ImportedEdit> };
const dash = "–";
const formatDate = (value: string | Date, locale: string, withTime = false, short = false) => {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short",
    ...(!short ? { year: "numeric" } : {}), ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}) };
  const formatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", options);
  if (locale === "zh") return formatter.format(new Date(value));
  const parts = formatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month")}${short ? "" : ` ${part("year")}`}${withTime ? `, ${part("hour")}:${part("minute")}` : ""}`;
};
const fmt = (n: number, digits = 2) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (n: number, sign = false, digits = 2, currency = "$") => `${sign ? n > 0 ? "+" : n < 0 ? "−" : "" : n < 0 ? "−" : ""}${currency}${fmt(Math.abs(n), digits)}`;
const pct = (n: number, digits = 2) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n * 100), digits)}%`;
const tone = (n: number | null | undefined) => n == null || n === 0 ? "neutral" : n > 0 ? "gain" : "loss";
const quantity = (amount: number, assetType: AssetType, manual: boolean) => fmt(amount, manual ? 2 : assetType === "stock" ? 0 : 4);
function importedEdits(transactions: Transaction[], logs: SnapshotEdit[]): Record<number, ImportedEdit> {
  const result: Record<number, ImportedEdit> = {};
  for (const tx of transactions) {
    const sameAsset = (item: Transaction) => item.uuid === tx.uuid && item.assetType === tx.assetType && item.symbol === tx.symbol;
    const peers = transactions.filter(sameAsset);
    const relevant = logs.filter((log) => log.target === "transaction" && log.asset_type === tx.assetType
      && log.symbol === tx.symbol);
    const prices = relevant.filter((log) => log.action === "price" && Number(log.new_value) === tx.price
      && peers.filter((peer) => peer.price === tx.price).length === 1);
    const price = prices.length === 1 ? prices[0] : undefined;
    const types = relevant.filter((log) => log.action === "txnType" && log.new_value === tx.txnType
      && (price ? log.id === price.id - 1 : peers.filter((peer) => peer.txnType === tx.txnType).length === 1));
    const type = types.length === 1 ? types[0] : undefined;
    if (price || type) result[tx.id] = {
      type: (type?.old_value ?? tx.txnType) as Transaction["txnType"],
      price: price ? Number(price.old_value) : tx.price,
    };
  }
  return result;
}

function CoinChart({ points, mode, symbol, currency, shortDate, emptyText }: { points: Point[]; mode: "value" | "price"; symbol: string; currency: CurrencyRateDetail; shortDate: (value: string | Date) => string; emptyText: string }) {
  const { t } = useTranslation();
  const chart = useChartHitArea();
  const chartRef = useRef<SVGSVGElement>(null);
  const [visibleDates, setVisibleDates] = useState<number[] | null>(null);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !chartRef.current) return;
      const dates = [...chartRef.current.querySelectorAll<SVGTextElement>("[data-date-index]")].map((node) => {
        const box = node.getBoundingClientRect();
        return { index: Number(node.dataset.dateIndex), left: box.left, right: box.right };
      });
      setVisibleDates(fittingDateTickIndices(dates));
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => { active = false; };
  }, [points, mode, shortDate, currency]);
  const values = points.map((point) => currencyWrapper(currency)(mode === "value" ? point.value : point.price));
  if (values.length === 0) return <EmptyState icon={ClockIcon} className="fd-empty fd-coin-chart-empty"
    title={t("coin.market.history.empty.title")} hint={emptyText} />;
  if (values.length < 3) return <div className="fd-empty fd-coin-chart-empty">{emptyText}</div>;
  const lowest = Math.min(...values), highest = Math.max(...values);
  const magnitude = 10 ** Math.floor(Math.log10(highest - lowest || Math.abs(highest) || 1));
  const min = Math.floor((lowest - (highest - lowest) * .25) / magnitude) * magnitude;
  const rawStep = (highest - min) / 4;
  const stepMagnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(n => n * stepMagnitude).find(n => n >= rawStep) ?? 10 * stepMagnitude;
  const tickMin = Math.floor(min / step) * step;
  let tickMax = Math.ceil(highest / step) * step;
  if (tickMax <= highest) tickMax += step;
  const ticks = Array.from({ length: Math.round((tickMax - tickMin) / step) + 1 }, (_, i) => tickMin + i * step);
  const tickLabel = (n: number) => Math.abs(n) >= 1000
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: step < 1000 ? 3 : 0 }).format(n / 1000)}K`
    : `${currency.symbol}${fmt(n, Math.abs(n) < 10 ? 2 : 0)}`;
  const endLabel = money(values.at(-1)!, false, mode === "price" ? 2 : 0, currency.symbol);
  const padL = 12 + Math.max(...ticks.map(n => tickLabel(n).length * 8));
  const padR = Math.min(120, 10 + endLabel.length * 7.5);
  const x = (i: number) => padL + i / (values.length - 1) * (324 - padL - padR);
  const y = (v: number) => 174 - (v - tickMin) / (tickMax - tickMin) * 166;
  const labelIndices = (points.length <= 8 ? [0, 2, 4, points.length - 1] : [0, 10, 20, points.length - 1])
    .filter((index, position, indices) => index < points.length && indices.indexOf(index) === position);
  const axisDate = (i: number) => shortDate(points[i].date);
  return <><svg ref={chartRef} viewBox="0 0 324 200" className="fd-coin-chart" role="group"
    data-chart-group="" aria-label={`${symbol} ${mode} chart`}>
    {ticks.map(n=><g key={n}><line x1={padL} y1={y(n)} x2="324" y2={y(n)} stroke="var(--fd-border)"/><text x={padL-8} y={y(n)+4} textAnchor="end" fill="var(--fd-faint)" fontSize="12">{tickLabel(n)}</text></g>)}
    {/* color-semantics: neutral this path shows price over time. */}
    <path fill="none" stroke="var(--fd-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" d={values.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")}/>
    {values.map((value, index) => {
      const detail = `${axisDate(index)}: ${money(value, false, 2, currency.symbol)}`;
      return <circle key={index} role="button" {...chart.markProps(index, detail, detail)}
        cx={x(index)} cy={y(value)} r="10" fill="transparent" />;
    })}
    {labelIndices.map(index => {
      const hidden = visibleDates !== null && !visibleDates.includes(index);
      return <text key={index} data-date-index={index} x={x(index)} y="192" fill="var(--fd-faint)" fontSize="12" textAnchor={index===0?"start":index===points.length-1?"end":"middle"} opacity={hidden ? 0 : undefined} aria-hidden={hidden}>{axisDate(index)}</text>;
    })}
    <text x={x(values.length-1)+6} y={y(values.at(-1)!)+4} fill="var(--fd-text)" fontSize="12" fontWeight="600">{endLabel}</text>
  </svg>{chart.tooltip}</>;
}

function Metric({ label, value, detail, valueTone, help }: { label: string; value: string; detail?: React.ReactNode; valueTone?: string; help?: string }) {
  const [showHelp, setShowHelp] = useState(false);
  const { t } = useTranslation();
  return <div className="fd-coin-metric"><span className="fd-label">{label}{help &&
    <button type="button" className="fd-info-button" aria-label={t("fidelity.coin.help").replace("{label}", label)}
      aria-description={help} aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)} />}</span>
    {showHelp && help && <span className="fd-info-tooltip">{help}</span>}<strong data-tone={valueTone}>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export default function CoinFidelity({ symbol, assetType, currency, dateRange, onDataChanged, commitPrice, commitType }: {
  symbol: string; assetType: AssetType; currency: CurrencyRateDetail; dateRange: TDateRange; onDataChanged?: () => void;
  commitPrice: (id: number, price: number) => Promise<void>;
  commitType: (id: number, type: Transaction["txnType"]) => Promise<void>;
}) {
  const { t, locale } = useTranslation();
  const date = (value: string | Date, withTime = false) => formatDate(value, locale, withTime);
  const shortDate = (value: string | Date) => formatDate(value, locale, false, true);
  const navigate = useNavigate();
  const version = useDataChangedVersion();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<"FIFO" | "LIFO" | "HIFO" | "AVERAGE">("FIFO");
  const [range, setRange] = useState("all");
  const [chartMode, setChartMode] = useState<"value" | "price">("value");
  const [chartRange, setChartRange] = useState<"7D" | "30D">("30D");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<Transaction["txnType"]>("buy");
  const [editPrice, setEditPrice] = useState("");
  const [editPriceDirty, setEditPriceDirty] = useState(false);
  const [editPriceRate, setEditPriceRate] = useState(Number.NaN);
  const editSession = useRef(0);
  const transactionScroll = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [coinSelectOpen, setCoinSelectOpen] = useState(false);
  const [coinKeyword, setCoinKeyword] = useState("");
  const [emptySourcesExpanded, setEmptySourcesExpanded] = useState(false);
  const [lotsExpanded, setLotsExpanded] = useState(false);
  const [allowSymbols, setAllowSymbols] = useState<AssetReference[]>([]);
  const coinRef = useRef<HTMLDivElement>(null);
  const [longMetrics, setLongMetrics] = useState(0);
  useEffect(() => {
    let active = true;
    void listAllowedSymbols().then((symbols) => {
      if (active) setAllowSymbols(symbols);
    });
    return () => { active = false; };
  }, [version]);
  const filteredSymbols = allowSymbols.filter((item) =>
    formatAssetLabel(item).toLowerCase().includes(coinKeyword.toLowerCase()));
  const label = (key: string) => t(`fidelity.coin.${key}`);
  const sourceCount = (count: number) => label(count === 1 ? "sourceCount.one" : "sourceCount.other").replace("{n}", String(count));
  const saleCount = (count: number, withMethod = false) => label(`${withMethod ? "salesMethod" : "salesInRange"}.${count === 1 ? "one" : "other"}`).replace("{n}", String(count)).replace("{method}", method);
  const lotCount = (count: number) => label(count === 1 ? "lotCount.one" : "lotCount.other").replace("{method}", method).replace("{n}", String(count));
  const currentPriceDigits = data?.manual ? 4 : 2;
  const moneyInCurrency = (n: number, sign = false, digits = 2) => money(n * currency.rate, sign, digits, currency.symbol);
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const allTime: TDateRange = { start: new Date("1970-01-01T00:00:00.000Z"), end: dateRange.end };
      const [latest, transactions, config, savedMethod] = await Promise.all([
        queryHistoricalData(1, false, { includeTransactions: false }),
        queryTransactionsBySymbolAndDateRange(symbol, allTime, assetType),
        getConfiguration(), getCostBasisMethod(),
      ]);
      const latestAt = new Date(latest[0]?.createdAt ?? dateRange.end);
      const historyStart = new Date(Math.max(dateRange.start.getTime(), latestAt.getTime() - 30 * 86_400_000));
      const history = await queryHistoricalData(40, true, { includeTransactions: false,
        dateRange: { start: historyStart, end: latestAt } });
      const points: Point[] = history.map((snap: HistoricalData) => {
        const rows = snap.assets.filter((asset) => asset.symbol === symbol && asset.assetType === assetType);
        const amount = rows.reduce((sum, row) => sum + row.amount, 0);
        const value = rows.reduce((sum, row) => sum + row.value, 0);
        return { date: new Date(snap.createdAt), amount, value, price: amount ? value / amount : 0 };
      }).filter((point) => point.amount > 0 && point.date >= historyStart && point.date <= latestAt).sort((a,b)=>a.date.getTime()-b.date.getTime());
      const rows = latest[0]?.assets ?? [];
      const latestTotal = rows.reduce((sum, asset) => sum + asset.value, 0);
      const sourceRows = rows.filter((asset: AssetModel) => asset.symbol === symbol && asset.assetType === assetType);
      const sources = sourceRows.map((row) => ({ wallet: row.wallet ?? "", name: row.wallet ?? "", amount: row.amount, value: row.value }))
        .sort((a, b) => a.wallet.localeCompare(b.wallet));
      const custom = config?.others?.find((item) => item.symbol?.toUpperCase() === symbol.toUpperCase());
      const aliases = await new WalletAnalyzer(async () => []).listWalletAliases(
        [...new Set([...sources.map((source) => source.wallet), ...transactions.map((transaction) => transaction.wallet ?? "")])]);
      const logGroups = await Promise.all([...new Set(transactions.map((transaction) => transaction.uuid))].map((uuid) =>
        queryEditLog(uuid).then((logs) => ({ uuid, logs })).catch(() => ({ uuid, logs: [] as SnapshotEdit[] }))));
      const edits = Object.assign({}, ...logGroups.map(({ uuid, logs }) =>
        importedEdits(transactions.filter((transaction) => transaction.uuid === uuid), logs))) as Record<number, ImportedEdit>;
      if (!active) return;
      setData({ points, sources, transactions, currentTotal: latestTotal, manual: Boolean(custom?.price?.kind === "manual"), manualSetAt: custom?.price?.kind === "manual" ? custom.price.setAt : undefined, manualUsd: custom?.price?.kind === "manual" ? custom.price.usd : undefined, followSymbol: custom?.price?.kind === "follow" ? custom.price.symbol : undefined, displayName: custom?.alias, aliases, edits });
      setMethod(savedMethod);
      setLoading(false);
    })().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol, assetType, dateRange.start.getTime(), dateRange.end.getTime(), version]);
  const points = data?.points ?? [];
  const point = points.at(-1);
  const price = point?.price ?? 0, held = point?.amount ?? 0, value = point?.value ?? 0;
  const transactions = data?.transactions ?? [];
  const transactionRows = useMemo(() => transactions.filter((tx) => filter === "all" || tx.txnType === filter)
    .slice().sort((a, b) => b.txnCreatedAt.localeCompare(a.txnCreatedAt) || b.id - a.id), [transactions, filter]);
  const transactionPaging = usePager(transactionRows,
    `${symbol}:${assetType}:${filter}:${dateRange.start.getTime()}:${dateRange.end.getTime()}`, 15,
    () => document.querySelector(".fd-coin-transactions")?.scrollIntoView?.({ block: "start" }), "coin-transactions-phone");
  const manualPriceRows = useMemo(() => transactions.slice().sort((a, b) => b.txnCreatedAt.localeCompare(a.txnCreatedAt)), [transactions]);
  const manualPricePaging = usePager(manualPriceRows, `${symbol}:${assetType}:manual`, 15, undefined, "coin-manual-prices-phone");
  const rangeStart = range === "all" ? 0 : dateRange.end.getTime() - (range === "1y" ? 365 : range === "90d" ? 90 : 30) * 86_400_000;
  const rangedTransactions = transactions.filter((item) => Date.parse(item.txnCreatedAt) >= rangeStart);
  const basisEvents = useMemo(() => fromStoredTransactions(transactions.map((tx) => ({...tx, wallet: tx.wallet ?? ""}))), [transactions]);
  const basis = useMemo(() => calculateCostBasis(basisEvents, { method, prices: { [`${assetType}:${symbol}`]: price } }), [basisEvents, method, assetType, symbol, price]);
  const buys = rangedTransactions.filter((tx) => tx.txnType === "buy");
  const sells = rangedTransactions.filter((tx) => tx.txnType === "sell");
  const weightedPrice = (rows: Transaction[]) => { const qty = rows.reduce((sum,row)=>sum+row.amount,0); return qty ? rows.reduce((sum,row)=>sum+row.amount*row.price,0)/qty : null; };
  const buyPrice = weightedPrice(buys), sellPrice = weightedPrice(sells);
  const realized = basis.disposals.filter((row) => Date.parse(row.disposedAt) >= rangeStart).reduce((sum,row)=>sum+row.gainLoss,0);
  const unknownLots = basisEvents.filter((event) => event.type === "deposit");
  const lotRows = [...basis.openLots.map((lot) => ({ id: lot.id, date: lot.acquiredAt, amount: lot.amount,
    cost: lot.costBasis / lot.amount, gain: lot.amount * price - lot.costBasis })),
    ...unknownLots.map((lot) => ({ id: lot.id, date: lot.date, amount: lot.amount, cost: null, gain: null }))];
  const unknownBasis = unknownLots.length > 0 || basis.warnings.some((warning) => warning.code === "missing-lots" || warning.code === "unknown-basis");
  const unrealized = unknownBasis ? null : basis.unrealized.reduce((sum,row)=>sum+row.gainLoss,0);
  const breakeven = unknownBasis || !held ? null : (buys.reduce((sum,row)=>sum+row.amount*row.price,0)-sells.reduce((sum,row)=>sum+row.amount*row.price,0))/held;
  const chartPoints = points.filter((item) => item.date.getTime() >= (points.at(-1)?.date.getTime() ?? 0) - (chartRange === "7D" ? 7 : 30) * 86_400_000);
  const chartValues = chartPoints.map((item)=>chartMode==="value"?item.value:item.price);
  const high = chartValues.length ? Math.max(...chartValues) : null;
  const low = chartValues.length ? Math.min(...chartValues) : null;
  const delta = chartValues.length > 1 ? chartValues.at(-1)! - chartValues[0] : null;
  const change = (days: number) => {
    const latest = points.at(-1);
    if (!latest || !price) return null;
    const target = latest.date.getTime() - days * 86_400_000;
    const old = points.slice(0, -1).reduce<Point | null>((best, item) =>
      !best || Math.abs(item.date.getTime() - target) < Math.abs(best.date.getTime() - target) ? item : best, null);
    return old?.price && Math.abs(old.date.getTime() - target) <= 36 * 3_600_000
      ? { pct: price / old.price - 1, dollars: price - old.price } : null;
  };
  const ch1=change(1),ch7=change(7),ch30=change(30);
  const kind = data?.manual ? label("customAsset") : assetType === "stock" ? label("stock") : label("crypto");
  const name = data?.displayName?.trim() || symbol;
  const walletOrdinals = useLatestWalletOrdinals();
  const sourceLabels = useMemo(() => {
    const ordered = [...(data?.sources ?? [])].sort((a, b) => b.value - a.value || a.wallet.localeCompare(b.wallet));
    const ids = [...new Set([...ordered.map((source) => source.wallet), ...transactions.map((tx) => tx.wallet).filter((wallet): wallet is string => !!wallet)])];
    const labels = sourceDisplayNames(ids.map((id) => ({
      id, wallet: data?.aliases[id]?.wallet, alias: data?.aliases[id]?.alias, type: data?.aliases[id]?.type,
    })), (index) => t("wallets.fallbackName").replace("{number}", String(index)), walletOrdinals);
    return Object.fromEntries(ids.map((id, index) => [id, labels[index]]));
  }, [data, transactions, t, walletOrdinals]);
  const sourceName = (wallet: string) => sourceLabels[wallet] ?? dash;
  const sourceKind = (wallet: string) => {
    if (assetType === "stock") return label("broker");
    const kind = (data?.aliases[wallet]?.type ?? wallet).toLowerCase();
    return ["binance", "okx", "okex", "kraken", "bybit", "coinbase", "gate", "bitget", "htx", "mexc"].includes(kind)
      ? label("exchange") : kind === "ibkr" ? label("broker") : label("wallet");
  };
  const sourceGroups = groupCoinSources((data?.sources ?? []).map((source) => ({
    id: source.wallet, label: sourceName(source.wallet), kind: sourceKind(source.wallet),
    amount: source.amount, value: source.value,
  })), label("others"));
  const sourceNames = data?.sources.map((source) => sourceName(source.wallet)) ?? [];
  const descriptionNames = data?.manual || assetType === "stock" ? sourceGroups.visible.slice(0, 1).map((source) => source.label) : sourceNames;
  const sourceTemplate = data?.manual ? label("manualDescription.dynamic")
    : assetType === "stock" ? label("stockDescription.full").replace("{name}", name) : label("heldOn");
  const lastSourcePrefix = !data?.manual && assetType !== "stock" && data?.sources.length === 2 && sourceKind(data.sources[1].wallet) !== label("exchange") && locale !== "zh" ? "a " : "";
  const transactionName = (txn: Transaction) => t(`coin.txnType.${txn.txnType}`);
  const transferCounterpart = (txn: Transaction) => {
    const opposite = txn.txnType === "deposit" ? "withdraw" : txn.txnType === "withdraw" ? "deposit" : null;
    if (!opposite) return "";
    const paired = transactions.find((candidate) => candidate.id !== txn.id && candidate.txnType === opposite
      && candidate.wallet !== txn.wallet && Math.abs(candidate.amount - txn.amount) < 1e-8
      && candidate.txnCreatedAt.slice(0, 10) === txn.txnCreatedAt.slice(0, 10));
    return paired ? `${txn.txnType === "deposit" ? " ← " : " → "}${sourceName(paired.wallet ?? "")}` : "";
  };
  const beginEdit = (txn: Transaction) => { editSession.current += 1; setSelected(txn); setEditType(txn.txnType); setEditPrice(fmt(txn.price * currency.rate,currentPriceDigits)); setEditPriceDirty(false); setEditPriceRate(currency.rate); setEditing(true); };
  const openTransaction = (txn: Transaction) => {
    const main = document.getElementById("app-main-content");
    transactionScroll.current = main?.scrollTop ?? 0;
    main?.scrollTo(0, 0);
    setSelected(txn);
  };
  const closeTransaction = () => {
    editSession.current += 1;
    setSelected(null);
    setEditing(false);
    const scroll = transactionScroll.current;
    transactionScroll.current = null;
    if (scroll !== null) requestAnimationFrame(() => document.getElementById("app-main-content")?.scrollTo(0, scroll));
  };
  const goBack = () => { if (window.history.state?.idx > 0 || window.history.length > 2) navigate(-1); else navigate("/overview"); };
  const applyTransactionEdit = async (nextType: Transaction["txnType"], nextPrice: number) => {
    if (!selected || saving) return;
    const session = editSession.current;
    setSaving(true);
    let committed = false;
    try {
      if (nextType !== selected.txnType) { await commitType(selected.id, nextType); committed = true; }
      if (nextPrice !== selected.price) { await commitPrice(selected.id, nextPrice); committed = true; }
      if (session === editSession.current) closeTransaction();
    } catch { if (session === editSession.current) toast({description:t("coin.transactionUpdateFailed"),variant:"destructive"}); }
    finally { if (committed) onDataChanged?.(); setSaving(false); }
  };
  const save = async () => {
    if (!selected || saving) return;
    const quotePrice = Number(editPrice.replaceAll(",", ""));
    const nextPrice = persistedTransactionPrice(editPriceDirty, quotePrice, editPriceRate, selected.price);
    if (!editPrice.trim() || !Number.isFinite(quotePrice) || quotePrice < 0 || !Number.isFinite(editPriceRate) || editPriceRate <= 0 || !Number.isFinite(nextPrice) || nextPrice < 0) { toast({description:t("coin.invalidPrice"),variant:"destructive"}); return; }
    await applyTransactionEdit(editType, nextPrice);
  };
  const resetToImported = async () => {
    if (!selected) return;
    const original = data?.edits[selected.id];
    await applyTransactionEdit(original?.type ?? selected.txnType, original?.price ?? selected.price);
  };
  const selectedEdit = selected && data?.edits[selected.id];
  const editedPriceNumber = Number(editPrice.replaceAll(",", ""));
  const editedValue = selected && Number.isFinite(editedPriceNumber) ? editedPriceNumber * selected.amount : 0;
  const editedPriceHint = data?.manual && selected
    ? label("ownPriceOn").replace("{date}", date(selected.txnCreatedAt))
    : label("editValueHint").replace("{value}", money(editedValue, false, 2, currency.symbol))
      .replace("{percent}", fmt(price ? Math.abs(editedPriceNumber / (price * currency.rate) - 1) * 100 : 0, 1))
      .replace("{direction}", label(editedPriceNumber < price * currency.rate ? "below" : "above"));
  const card = (children: React.ReactNode, cls="") => <section className={`fd-card ${cls}`}>{children}</section>;
  const cardHeading = (heading: string, right?: React.ReactNode) => <div className="fd-card-heading"><h3>{heading}</h3>{right && <span>{right}</span>}</div>;
  useLayoutEffect(() => {
    const root = coinRef.current;
    if (!root || loading) return;
    let active = true;
    let frame = 0;
    const check = () => {
      if (!active || !root.clientWidth) return;
      const grids = [...root.querySelectorAll<HTMLElement>(".fd-coin-changes, .fd-position-grid, .fd-coin-stats")];
      grids.forEach((grid) => grid.classList.remove("long-amount"));
      const overflowed = grids.reduce((mask, grid, index) => {
        const boundary = grid.getBoundingClientRect();
        const metrics = [...grid.querySelectorAll<HTMLElement>(":scope > .fd-coin-metric")];
        const textBounds = (metric: HTMLElement, tag: "strong" | "small") => {
          const text = metric.querySelector(tag);
          if (!text) return undefined;
          const range = document.createRange();
          range.selectNodeContents(text);
          return range.getBoundingClientRect();
        };
        const crowded = needsMetricStack(boundary, metrics.map((metric) => ({
          strong: textBounds(metric, "strong"),
          small: textBounds(metric, "small"),
          contentRight: metric.getBoundingClientRect().right - parseFloat(getComputedStyle(metric).paddingRight),
        })));
        return mask | (crowded ? 1 << index : 0);
      }, 0);
      grids.forEach((grid, index) => grid.classList.toggle("long-amount", Boolean(overflowed & (1 << index))));
      setLongMetrics(overflowed);
    };
    check();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    if (root.parentElement) observer?.observe(root.parentElement);
    document.fonts?.ready.then(check);
    return () => { active = false; cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [loading, data, chartMode, chartRange, range, currency, method, locale]);
  if (loading) return <div className="fd-page fd-coin" data-state="loading" aria-busy="true">
    <div className="fd-coin-loading" role="status"><span className="sr-only">{t("common.loading")}</span>
      <span className="fd-skeleton" /><span className="fd-skeleton" /><span className="fd-skeleton" />
    </div>
    <section className="fd-card fd-coin-loading-transactions" aria-label={label("transactions")}>
      {Array.from({ length: transactionPaging.pageSize }, (_, index) => <div className="fd-tx-skeleton-row" key={index}><span className="fd-skeleton" /></div>)}
    </section>
  </div>;
  return <div ref={coinRef} className="fd-page fd-coin d2-coin" data-state={loading?"loading":"ready"} data-asset-type={assetType} data-manual={Boolean(data?.manual)}>
    <header className="fd-page-head fd-coin-head"><nav aria-label={label("breadcrumbs")}><button type="button" onClick={goBack}>{label("overview")}</button><ChevronRightIcon aria-hidden="true" /><button type="button" aria-expanded={coinSelectOpen} onClick={() => setCoinSelectOpen(true)}>{label("coins")}</button><ChevronRightIcon aria-hidden="true" /><span>{symbol}</span></nav>
      <h1><AssetLabel kind={data?.manual ? "custom" : assetType === "stock" ? "stock" : "coin"} symbol={symbol}
        name={name === symbol ? name : `${name} ${symbol}`} size={32} tag={kind} /></h1>
      {descriptionNames.length ? <CoinSourceSummary names={descriptionNames} template={sourceTemplate} locale={locale} moreLabel={t("coin.sourcesMore")} allLabel={t("coin.sourcesAll")} lastPrefix={lastSourcePrefix} /> : <p /> }<button type="button" className="fd-cost-link" onClick={()=>navigate("/cost-basis")}><svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2.5v13M12 5.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.2 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" /></svg>{label("openCostBasis")}</button></header>
    <BottomSheet open={coinSelectOpen} onOpenChange={setCoinSelectOpen} title={t("coin.symbol")}>
      <input className="fd-coin-search" value={coinKeyword} onChange={(event) => setCoinKeyword(event.target.value)} placeholder={t("coin.searchPlaceholder")} aria-label={t("coin.searchPlaceholder")} />
      <div className="mobile-coin-options">{filteredSymbols.slice(0, 200).map((item) => <button type="button" key={getAssetLogoKey(item)} className="mobile-coin-option" onClick={() => { setCoinSelectOpen(false); navigate(buildAssetDetailsPath(item)); }}><AssetLabel asset={item} size={20} /></button>)}</div>
    </BottomSheet>
    {card(<><div className="fd-coin-primary"><span className="fd-label">{data?.manual?label("manualPrice"):label("assetPrice").replace("{name}",name)}</span><strong>{point?moneyInCurrency(price,false,currentPriceDigits):dash}</strong><small>{data?.manual?label("setByYouOn").replace("{date}",date(data.manualSetAt??point?.date??new Date())):data?.followSymbol?t("coin.customPrice.follow").replace("{symbol}",data.followSymbol):assetType==="stock"?label("stockFeed.generic"):label("perAsset").replace("{symbol}",symbol)}</small></div>
      <div className={`fd-coin-changes ${data?.manual?"manual":""}${longMetrics & 1 ? " long-amount" : ""}`}>{data?.manual?<Metric label={label("priceFeed")} value={label("none")} detail={label("changesUnavailable")} />:<>{[[assetType==="stock"?label("oneDay"):"24h",ch1],["7D",ch7],["30D",ch30]].map(([name,result])=>{const v=result as ReturnType<typeof change>;return <Metric key={name as string} label={name as string} value={v?pct(v.pct):dash} valueTone={tone(v?.pct)} detail={v?moneyInCurrency(v.dollars,true):dash} />})}</>}
      <Metric label={label("holdingsValue")} value={moneyInCurrency(value)} detail={`${quantity(held,assetType,Boolean(data?.manual))} ${symbol}`} />
      <Metric label={label("sharePortfolio")} value={data?.currentTotal?pct(value/data.currentTotal,1).replace("+",""):dash} detail={data?.currentTotal?label("ofTotal").replace("{amount}",moneyInCurrency(data.currentTotal)):label("notInTotal")} /></div>
      <div className="fd-position"><div className="fd-card-heading"><h3>{label("position")}</h3><span>{method}<label className="fd-range-select">{label("rangePrefix")} <select aria-label={label("range")} value={range} onChange={e=>setRange(e.target.value)}><option value="all">{label("rangeAll")}</option><option value="1y">{label("rangeYear")}</option><option value="90d">{label("range90")}</option><option value="30d">{label("range30")}</option></select></label></span></div><div className={`fd-position-grid${longMetrics & 2 ? " long-amount" : ""}`}>
        <Metric label={label("positions")} value={`${quantity(held,assetType,Boolean(data?.manual))} ${symbol}`} detail={sourceCount(data?.sources.length??0)} />
        <Metric label={label("costPrice")} help={t("coin.costPriceHelp")} value={buyPrice===null?dash:moneyInCurrency(buyPrice,false,currentPriceDigits)} detail={<>{label("avgBuyRange")}{unknownBasis && <><br/><span className="fd-warning">{label("pricedBuysCount").replace("{priced}",fmt(held-unknownLots.reduce((sum,lot)=>sum+lot.amount,0),data?.manual?0:4)).replace("{total}",fmt(held,data?.manual?0:4))}</span></>}</>} />
        <Metric label={label("avgSellPrice")} value={sellPrice===null?dash:moneyInCurrency(sellPrice,false,currentPriceDigits)} detail={sellPrice===null?label("noSalesInRange"): saleCount(sells.length)} />
        <Metric label={label("breakevenPrice")} help={t("coin.breakevenHelp")} value={breakeven===null?dash:moneyInCurrency(breakeven,false,currentPriceDigits)} detail={breakeven===null?label("needsEveryPrice"):label("priceAbove").replace("{percent}",pct(price/breakeven-1,1).replace("+",""))} />
        <Metric label={label("realizedPnl")} value={moneyInCurrency(realized,true)} valueTone={tone(realized)} detail={sells.length?saleCount(sells.length,true):label("nothingSold")} />
        <Metric label={label("unrealizedPnl")} value={unrealized===null?dash:moneyInCurrency(unrealized,true)} valueTone={tone(unrealized)} detail={unrealized===null?label("missingPriceFirst"):label("openLotsToday")} />
      </div></div></>,"fd-coin-hero")}
    {data?.manual ? card(<>{cardHeading(label("price"),label("manual"))}<div className="fd-empty">{label("manualNoHistory").replaceAll("{symbol}",symbol)}</div><div className="fd-manual-rows"><div>{date(data.manualSetAt??new Date())}<strong>{moneyInCurrency(price,false,4)}</strong><small>{label("manualPrice")}</small></div>{manualPricePaging.rows.map(tx=><div key={tx.id}>{date(tx.txnCreatedAt)}<strong>{tx.price>0?moneyInCurrency(tx.price,false,4):dash}</strong><small>{tx.price>0?label("fromBuy").replace("{amount}",fmt(tx.amount,0)).replace("{symbol}",symbol):label("depositNoPrice")}</small></div>)}</div><Pager count={manualPriceRows.length} {...manualPricePaging} pageSizes={[15,25,50,100]} t={t} labelPrefix="fidelity.coin.pager" ariaLabel={label("price")} /><button className="fd-outline-pill" type="button" onClick={()=>navigate(`/settings/configuration?edit=${encodeURIComponent(symbol)}`)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M3 15l.8-3.5L12.5 3l2.5 2.5-8.7 8.7L3 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{label("setCurrentPrice")}</button></>,"fd-coin-trend") : card(<>{cardHeading(chartMode==="value"?label("valueHoldings"):label("price"))}<p className="fd-sub">{chartMode==="value"?label("currentHoldingsEachDay").replace("{amount}",quantity(held,assetType,false)).replace("{symbol}",symbol):label("quoteInCurrency").replace("{symbol}",symbol).replace("{currency}",currency.currency)}</p><div className="fd-chart-controls"><div role="group" aria-label={label("chartMode")}>{(["value","price"] as const).map(mode=><button type="button" aria-pressed={chartMode===mode} key={mode} onClick={()=>{setChartMode(mode);setChartRange(mode==="price"?"7D":"30D")}}>{label(mode)}</button>)}</div><div role="group" aria-label={label("chartRange")}>{(["7D","30D"] as const).map(r=><button type="button" aria-pressed={chartRange===r} key={r} onClick={()=>setChartRange(r)}>{r}</button>)}</div></div><CoinChart points={chartPoints} mode={chartMode} symbol={symbol} currency={currency} shortDate={shortDate} emptyText={chartPoints.length ? label("notEnoughHistory") : label("noPriceHistory").replace("{symbol}", symbol)}/><div className={`fd-coin-stats${longMetrics & 4 ? " long-amount" : ""}`}><Metric label={label("high")} value={high===null?dash:moneyInCurrency(high,false,chartMode==="price"?2:2)} detail={high===null?"":shortDate(chartPoints[chartValues.indexOf(high)].date)} /><Metric label={label("low")} value={low===null?dash:moneyInCurrency(low)} detail={low===null?"":shortDate(chartPoints[chartValues.indexOf(low)].date)} /><Metric label={label("sinceDate").replace("{date}",chartPoints.length?shortDate(chartPoints[0].date):dash)} value={delta===null?dash:moneyInCurrency(delta,true)} valueTone={tone(delta)} detail={delta===null||!chartValues[0]?dash:pct(delta/chartValues[0])} /></div></>,"fd-coin-trend")}
      {card(<>
        {cardHeading(label("holdingsSource"), sourceCount(data?.sources.length ?? 0))}
        {data?.sources.length ? <div className="fd-source-list">
          {sourceGroups.visible.map((source) => <div className="fd-source-row" key={source.id}>
            <AssetLabel kind={sourceIconKind(data?.aliases[source.id]?.type)} type={data?.aliases[source.id]?.type}
              name={source.label} size={20} secondary={`${quantity(source.amount, assetType, Boolean(data?.manual))} ${symbol} · ${source.share.toFixed(1)}% · ${source.kind}`} />
            <strong>{moneyInCurrency(source.value)}</strong>
          </div>)}
          {sourceGroups.empty.length > 0 && <>
            <button className="fd-source-empty-toggle" type="button" aria-expanded={emptySourcesExpanded} onClick={() => setEmptySourcesExpanded(!emptySourcesExpanded)}>
              {label("emptySources").replace("{count}", String(sourceGroups.empty.length))} <span aria-hidden="true">{emptySourcesExpanded ? "⌃" : "⌄"}</span>
            </button>
            {emptySourcesExpanded && sourceGroups.empty.map((source) => <div className="fd-source-row fd-source-zero" key={source.id}>
              <AssetLabel kind={sourceIconKind(data?.aliases[source.id]?.type)} type={data?.aliases[source.id]?.type}
                name={source.label} size={20} secondary={`${quantity(source.amount, assetType, Boolean(data?.manual))} ${symbol} · 0.0% · ${source.kind}`} />
              <strong>{moneyInCurrency(source.value)}</strong>
            </div>)}
          </>}
          <div className="fd-source-row total"><b>{label("total")}</b><strong>{moneyInCurrency(value)}</strong><small>{quantity(held,assetType,Boolean(data?.manual))} {symbol}</small></div>
        </div> : <EmptyState icon={BackpackIcon} title={t("coin.sources.empty.title")} hint={t("coin.sources.empty.hint")} />}
        <div className="fd-open-lots fd-coin-lots">
      {cardHeading(label("openLots"), lotCount(lotRows.length))}
      {lotRows.length ? <>
      <div className={lotsExpanded ? "fd-lots-scroll expanded" : "fd-lots-scroll"} role="region" aria-label={label("openLots")} tabIndex={0}>
        <div className="fd-lot-header"><span>{label("acquired")}</span><span>{label("quantity")}</span><span>{label("costPrice")}</span><span>{label("unrealized")}</span></div>
        {(lotsExpanded ? lotRows : lotRows.slice(0, 8)).map(lot => <div className="fd-lot-row" key={lot.id}>
          <span>{date(lot.date)}</span><span>{quantity(lot.amount,assetType,Boolean(data?.manual))}</span>
          <span>{lot.cost === null ? dash : moneyInCurrency(lot.cost,false,currentPriceDigits)}</span>
          <span data-tone={tone(lot.gain)}>{lot.gain === null ? dash : moneyInCurrency(lot.gain,true)}</span>
        </div>)}
      </div>
      {lotRows.length > 8 && <button className="fd-lots-toggle" type="button" aria-expanded={lotsExpanded} onClick={() => setLotsExpanded(!lotsExpanded)}>
        {lotsExpanded ? label("showFewerLots") : label("showAllLots").replace("{count}", String(lotRows.length))}
      </button>}
      </> : <EmptyState icon={ArchiveIcon} title={t("coin.lots.empty.title")} hint={t("coin.lots.empty.hint")} />}
            </div>
      </>, "fd-coin-holdings")}
    {card(<>{cardHeading(label("transactions"))}<div className="fd-tx-filters" role="group" aria-label={label("filterTransactions")}>{["all","buy","sell","deposit","withdraw"].filter(x=>x==="all"||transactions.some(tx=>tx.txnType===x)).map(x=><button type="button" aria-pressed={filter===x} key={x} onClick={()=>setFilter(x)}>{x==="all"?label("all"):t(`coin.txnType.${x}`)} {x==="all"?transactions.length:transactions.filter(tx=>tx.txnType===x).length}</button>)}</div>{transactionRows.length ? <><div className="fd-tx-list" style={transactionRows.length > transactionPaging.pageSize ? { minHeight: transactionPaging.pageSize * 64 } : undefined}>{transactionPaging.rows.map(tx=><button type="button" className="fd-tx-row" key={tx.id} onClick={()=>openTransaction(tx)}><span className="fd-tx-main"><em className="t3-tag" data-tone="neutral">{transactionName(tx)}</em><b>{quantity(tx.amount,assetType,Boolean(data?.manual))} {symbol}</b><strong>{tx.price>0?moneyInCurrency(tx.amount*tx.price):dash}</strong></span><small>{data?.edits[tx.id] && <><span className="fd-edited">{label("edited")}</span> · </>}{date(tx.txnCreatedAt)} · {sourceName(tx.wallet??"")}{transferCounterpart(tx)}{tx.price>0?` · @ ${moneyInCurrency(tx.price,false,currentPriceDigits)}`:""}<span className="sr-only"> · {label("note")}: {dash}</span></small></button>)}</div><Pager count={transactionRows.length} {...transactionPaging} pageSizes={[15,25,50,100]} t={t} labelPrefix="fidelity.coin.pager" /><p className="fd-footnote">{label("editNote")}</p></> : <EmptyState icon={ClockIcon} title={t("coin.transactions.empty.title")} hint={t("coin.transactions.empty.hint")} />}</>,"fd-coin-transactions")}
    <BottomSheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeTransaction(); }}
      title={selected ? editing ? label("editTransaction") : label("transactionTitle").replace("{type}",transactionName(selected)).replace("{amount}",quantity(selected.amount,assetType,Boolean(data?.manual))).replace("{symbol}",symbol) : ""}
      className={`fd-sheet ${editing ? "edit" : "detail"} ${data?.manual ? "manual" : ""}`} detents={["medium"]}>
      {selected && <div className="fd-sheet-content">{editing?<><p>{label("editDescription")}</p><div className="fd-edit-summary"><b className={selectedEdit?.type && selectedEdit.type !== selected.txnType ? "fd-imported" : undefined}>{selectedEdit?.type && selectedEdit.type !== selected.txnType ? label("importedAs").replace("{type}", t(`coin.txnType.${selectedEdit.type}`).toLowerCase()) : transactionName(selected)}</b><span>{quantity(selected.amount,assetType,Boolean(data?.manual))} {symbol}</span><span>·</span><span>{date(selected.txnCreatedAt,true)}</span><span>·</span><span>{sourceName(selected.wallet??"")}</span></div>{data?.manual&&<div className="fd-info-banner"><span className="fd-info-icon" aria-hidden="true">ⓘ</span><div><b>{label("noMarketPrice").replace("{symbol}",symbol)}</b>{label("setPricesHere")}</div></div>}<label className="fd-edit-label">{label("type")}{(editType!==selected.txnType || (selectedEdit && selectedEdit.type !== selected.txnType))&&<span className="t3-tag fd-change-chip" data-tone="accent">{label("changedFrom").replace("{type}",t(`coin.txnType.${selectedEdit?.type ?? selected.txnType}`).toLowerCase())}</span>}</label><div className="fd-edit-types">{(["buy","sell","deposit","withdraw"] as const).map(type=><button type="button" key={type} aria-pressed={editType===type} onClick={()=>setEditType(type)}>{t(`coin.txnType.${type}`)}</button>)}</div><p>{selectedEdit?.type && selectedEdit.type !== selected.txnType ? label("typeHintImported").replace("{type}",t(`coin.txnType.${selectedEdit.type}`).toLowerCase()) : label("typeHint")}</p><label className="fd-edit-label" htmlFor="fd-edit-price">{label("pricePer").replace("{symbol}",symbol)}</label><div className="fd-price-input">{currency.symbol}<input id="fd-edit-price" type="text" inputMode="decimal" autoFocus value={editPrice} onChange={e=>{setEditPrice(e.target.value);setEditPriceDirty(true);}}/><span>{label("priceUnit").replace("{currency}",currency.currency).replace("{symbol}",symbol)}</span></div><div className="fd-edit-value-hint">{editedPriceHint}</div>{data?.manual&&<><hr/><h3>{label("assetWithSymbol").replace("{symbol}",symbol)}</h3><label className="fd-edit-label">{label("assetType")}</label><div className="fd-select-static fd-asset-type-static">{assetType==="stock"?label("stock"):label("crypto")}<span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="m3 5 4 4 4-4" /></svg></span></div><label className="fd-edit-label">{label("currentPrice")}</label><div className="fd-select-static">{moneyInCurrency(price,false,4)} <span>{currency.currency}</span></div><p className="fd-asset-settings-hint">{label("assetSettingsHint").replace("{symbol}",symbol)}</p></>}<div className="fd-edit-footer"><div className="fd-sheet-actions"><button type="button" onClick={()=>setEditing(false)}>{label("cancel")}</button><button type="button" disabled={saving} onClick={save}>{label("save")}</button></div><button type="button" className="fd-reset" disabled={saving} onClick={resetToImported}>{label("resetImported")}</button></div></>:<><p>{date(selected.txnCreatedAt,true)} · {sourceName(selected.wallet??"")}</p><div className="fd-detail-list">{[[label("type"),transactionName(selected)],[label("quantity"),`${quantity(selected.amount,assetType,Boolean(data?.manual))} ${symbol}`],[label("price"),selected.price>0?moneyInCurrency(selected.price,false,currentPriceDigits):dash],[label("value"),selected.price>0?moneyInCurrency(selected.price*selected.amount):dash],[label("sourceField"),sourceName(selected.wallet??"")],[label("reference"),dash],[label("realizedMethod").replace("{method}", method),moneyInCurrency(basis.disposals.filter(d=>d.eventId===String(selected.id)).reduce((sum,d)=>sum+d.gainLoss,0),true)]].map(([k,v])=><div key={k}><span>{k}</span><strong data-tone={k===label("realizedMethod").replace("{method}", method)?tone(basis.disposals.filter(d=>d.eventId===String(selected.id)).reduce((sum,d)=>sum+d.gainLoss,0)):undefined}>{v}{k===label("type") && selectedEdit && <span className="t3-tag fd-detail-edited" data-tone="accent">{label("edited")}</span>}</strong></div>)}</div><button type="button" className="fd-primary-pill" onClick={()=>beginEdit(selected)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M3 15l.8-3.5L12.5 3l2.5 2.5-8.7 8.7L3 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{label("editTypePrice")}</button><button type="button" className="fd-outline-pill" onClick={closeTransaction}>{label("close")}</button></>}</div>}</BottomSheet>
  </div>;
}
