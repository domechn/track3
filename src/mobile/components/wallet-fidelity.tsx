import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { BackpackIcon, ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import type { AssetModel, CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { sourceStatusesChangedEvent } from "@/components/source-status-event";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { currencyWrapper } from "@/utils/currency";
import { useTranslation } from "@/mobile/i18n";
import { rangeLabel } from "@/mobile/components/fidelity-range";
import { requestRefreshSource } from "@/mobile/components/refresh-progress-event";
import { sourceDisplayNames } from "@/components/source-display-name";
import { useLatestWalletOrdinals } from "@/components/source-name-order";
import { matchSourceStatus } from "@/components/source-status-match";
import "@/mobile/components/mobile/fidelity.css";
import { directionTone } from "@/utils/color";
import AssetLabel from "@/components/common/asset-label";
import { sourceIconKind } from "@/components/source-allocation-list";

import { useChartHitArea } from "@/components/chart-tooltip";

const WalletAssetsPercentage = lazy(() => import("@/mobile/components/wallet-assets-percentage"));
const WalletAssetsChange = lazy(() => import("@/mobile/components/wallet-assets-change"));
const WalletSourceChanges = lazy(() => import("@/components/wallet-source-changes"));

type Snap = Awaited<ReturnType<typeof queryHistoricalPage>>["rows"][number];
type Row = { symbol: string; assetType: string; amount: number; value: number };
type Source = { id: string; label: string; kind: string; provider?: string; value: number; baseValue: number; rows: Row[]; baseRows: Row[]; status?: PortfolioSourceStatus };
type WalletView = { latest: Snap; base: Snap | null; sources: Source[]; total: number; baseTotal: number; allQuantityEqual: boolean };
// color-semantics: neutral the palette separates wallet sources by category.
const colors = ["#4a8ad6", "#86b4ea", "#d4d6da", "#8c8e95", "#55575d"];
const periods: Record<string, number> = { "1D": 1, "7D": 7, "30D": 30, "90D": 90, "1Y": 365, All: Infinity };
const money = (value: number, currency: CurrencyRateDetail, digits = 2, signed = false) => {
  const amount = currencyWrapper(currency)(value);
  return `${signed ? amount > 0 ? "+" : amount < 0 ? "−" : "" : amount < 0 ? "−" : ""}${currency.symbol}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const percent = (fraction: number, digits = 1, signed = false) => {
  const rounded = Number((fraction * 100).toFixed(digits));
  return `${signed && rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(digits)}%`;
};
const time = (date?: string) => date ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date)) : "—";
const qty = (amount: number, stable: boolean) => amount.toLocaleString("en-US", { minimumFractionDigits: stable ? 2 : 0, maximumFractionDigits: stable ? 2 : 4 });
const rowKey = (row: Pick<Row, "assetType" | "symbol">) => `${row.assetType}:${row.symbol}`;
const groupRows = (assets: AssetModel[], id: string): Row[] => {
  const rows = new Map<string, Row>();
  for (const asset of assets.filter((item) => item.wallet === id)) {
    const key = `${asset.assetType}:${asset.symbol}`;
    const row = rows.get(key) ?? { symbol: asset.symbol, assetType: asset.assetType, amount: 0, value: 0 };
    row.amount += asset.amount;
    row.value += asset.value;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.value - a.value);
};
const sum = (rows: Row[]) => rows.reduce((value, row) => value + row.value, 0);
const assetDiff = (row: Row, base: Row[]) => row.value - (base.find((item) => rowKey(item) === rowKey(row))?.value ?? 0);

export default function WalletFidelity({ currency, dateRange, quoteColor, onRefresh, onRangeChange }: {
  currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor;
  onRefresh?: () => void | Promise<void>;
  onRangeChange?: (selectedTimes: number, range: { from: Date; to: Date } | undefined) => void;
}) {
  const { t, locale } = useTranslation();
  const chart = useChartHitArea();
  const version = useDataChangedVersion();
  const walletOrdinals = useLatestWalletOrdinals();
  const retry = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const [range, setRange] = useState(() => rangeLabel(dateRange));
  const [selected, setSelected] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [view, setView] = useState<WalletView | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => setRange(rangeLabel(dateRange)), [dateRange.start.getTime(), dateRange.end.getTime()]);
  useEffect(() => {
    const changed = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, changed);
    return () => window.removeEventListener(sourceStatusesChangedEvent, changed);
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const load = async () => {
      const bounds = { start: new Date(0), end: dateRange.end };
      const latest = (await queryHistoricalPage(bounds, 1, 0)).rows[0];
      if (!latest) return null;
      const span = periods[range];
      const before = span === Infinity ? null : range === "Custom" ? dateRange.start :
        new Date(new Date(latest.createdAt).getTime() - span * 86400000);
      const base = span === Infinity
        ? (await queryHistoricalPage(bounds, 1, Math.max(0, (await queryHistoricalPage(bounds, 1, 0)).totalCount - 1))).rows[0]
        : (await queryHistoricalPage({ start: bounds.start, end: before! }, 1, 0)).rows[0];
      const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.id, ...(base ? [base.id] : [])]);
      const current = assets.filter((asset) => asset.uuid === latest.id);
      const prior = assets.filter((asset) => asset.uuid === base?.id);
      const totals = new Map<string, number>();
      current.forEach((asset) => { if (asset.wallet) totals.set(asset.wallet, (totals.get(asset.wallet) ?? 0) + asset.value); });
      const ids = [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b));
      const aliases: Record<string, { wallet: string; alias: string; type: string } | undefined> =
        await new WalletAnalyzer(async () => []).listWalletAliases(ids).catch(() => ({}));
      const labels = sourceDisplayNames(ids.map((id) => ({ id, ...aliases[id] })),
        (index) => t("wallets.fallbackName").replace("{number}", String(index)), walletOrdinals);
      const sourceLabels = ids.map((id, index) => ({ id, label: labels[index] }));
      const sources = ids.map((id, index) => {
        const rows = groupRows(current, id);
        const baseRows = groupRows(prior, id);
        const label = labels[index];
        const status = matchSourceStatus(sourceLabels[index], aliases, sourceLabels, statuses);
        const provider = status?.provider ?? aliases[id]?.type;
        const kind = status?.kind ?? (sourceIconKind(provider) === "exchange" ? "exchange" :
          rows.every((row) => row.assetType === "stock") ? "broker" : "wallet");
        return { id, label, kind, provider, rows, baseRows, value: sum(rows), baseValue: sum(baseRows), status };
      }).sort((a, b) => b.value - a.value);
      const priorIds = new Set(prior.map((asset) => asset.wallet).filter((wallet): wallet is string => !!wallet));
      const allQuantityEqual = !!base && ids.length === priorIds.size && sources.every((source) =>
        priorIds.has(source.id) && source.rows.length === source.baseRows.length &&
        source.rows.every((row) => Math.abs(row.amount -
          (source.baseRows.find((old) => rowKey(old) === rowKey(row))?.amount ?? Number.NaN)) < 1e-8));
      return { latest, base: base ?? null, sources, total: latest.total, baseTotal: base?.total ?? 0, allQuantityEqual };
    };
    void load().then((result) => { if (active) setView(result); })
      .catch(() => { if (active) setView(null); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [dateRange.start.getTime(), dateRange.end.getTime(), range, version, statuses, t, walletOrdinals]);

  const sources = view?.sources ?? [];
  const chosen = sources.find((source) => source.id === selected) ?? null;
  const diff = view?.base ? view.total - view.baseTotal : null;
  const sourceDiff = chosen && view?.base ? chosen.value - chosen.baseValue : null;
  const baseline = view?.base ? new Date(view.base.createdAt) : null;
  const date = baseline ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", ...(locale === "zh" ? { year: "numeric" } : {}) }).format(baseline) : "—";
  const share = (source: Source) => view?.total ? source.value / view.total : 0;
  const failed = statuses.find((source) => source.status === "failed" || source.status === "stale");
  const selectedFailed = chosen?.status?.status === "failed" || chosen?.status?.status === "stale";
  const lastGood = chosen?.status?.lastSuccessAt;
  const nextRetry = chosen?.status ? retry.nextBySource[chosen.status.sourceId] : undefined;
  const allAssets = useMemo(() => {
    const assets = new Map<string, { symbol: string; value: number; details: { source: string; change: number }[] }>();
    for (const source of sources) for (const row of source.rows) {
      const key = rowKey(row);
      const diff = assetDiff(row, source.baseRows);
      const item = assets.get(key) ?? { symbol: row.symbol, value: 0, details: [] };
      item.value += diff;
      item.details.push({ source: source.label, change: diff });
      assets.set(key, item);
    }
    const currentValue = (symbol: string) => sources.reduce((value, source) =>
      value + (source.rows.find((row) => row.symbol === symbol)?.value ?? 0), 0);
    return [...assets.values()].sort((a, b) => currentValue(b.symbol) - currentValue(a.symbol));
  }, [sources, currency]);
  const selectionRows = chosen?.rows.map((row) => ({ symbol: row.symbol, value: assetDiff(row, chosen.baseRows) })) ?? [];
  const movers = chosen ? selectionRows.sort((a, b) => b.value - a.value) : [...allAssets].sort((a, b) => b.value - a.value);
  const selectedShareItems = chosen?.rows.map((row) => ({ label: row.symbol, value: row.value, fraction: chosen.value ? row.value / chosen.value : 0 })) ?? [];
  const shareItems = chosen ? selectedShareItems : sources.map((source) => ({ label: source.label, value: source.value, fraction: share(source) }));
  const biggest = chosen?.rows[0];
  const quantityEqual = chosen?.rows.every((row) => Math.abs(row.amount - (chosen.baseRows.find((old) => rowKey(old) === rowKey(row))?.amount ?? 0)) < 1e-8) ?? false;
  const statusLine = chosen?.status ? selectedFailed
    ? <><span className="fd-wallet-status-error">{t("fidelity.wallets.refreshFailed")}</span> · {t("fidelity.wallets.lastGood").replace("{time}", time(lastGood))}</>
    : t("fidelity.wallets.refreshed").replace("{time}", time(lastGood)) : "—";
  const subtitle = chosen
    ? selectedFailed
      ? t("fidelity.wallets.failedSummary").replace("{source}", chosen.label).replace("{last}", time(lastGood)).replace("{attempt}", time(chosen.status?.finishedAt))
      : t("fidelity.wallets.sourceSummary").replace("{source}", chosen.label).replace("{asset}", biggest?.symbol ?? "—")
        .replace("{share}", biggest ? percent(biggest.value / chosen.value) : "—")
        .replace("{name}", chosen.label)
        .replace("{change}", sourceDiff === null ? "—" : money(sourceDiff, currency, 0, true))
    : t("fidelity.wallets.allSummary").replace("{source}", sources[0]?.label ?? "—")
      .replace("{share}", sources[0] ? percent(share(sources[0])) : "—")
      .replace("{change}", sources[0] && view?.base ? money(sources[0].value - sources[0].baseValue, currency, 0, true) : "—")
      .replace("{total}", diff === null ? "—" : money(diff, currency, 0, true));
  const topSourceStart = !chosen && sources[0] ? subtitle.indexOf(sources[0].label) : -1;
  const topShare = sources[0] ? percent(share(sources[0])) : "";
  const topShareStart = topSourceStart >= 0 ? subtitle.indexOf(topShare, topSourceStart) : -1;
  const topSourceEnd = topShareStart >= 0 ? topShareStart + topShare.length : -1;
  const selectRange = (option: string) => {
    setRange(option);
    if (!view?.latest || !onRangeChange) return;
    const span = periods[option];
    const end = new Date(view.latest.createdAt);
    onRangeChange(0, span === Infinity ? undefined : {
      from: new Date(end.getTime() - span * 86400000), to: end,
    });
  };
  return <section className="fd-page fd-wallets analyze-wallets" data-quote-color={quoteColor} aria-busy={busy}>
    <header className="fd-wallet-head"><h1>{t("nav.wallets")}</h1><p>{topSourceStart >= 0 && topSourceEnd >= topSourceStart
      ? <>{subtitle.slice(0, topSourceStart)}<b>{subtitle.slice(topSourceStart, topSourceEnd)}</b>{subtitle.slice(topSourceEnd)}</>
      : subtitle}</p>
      <div className="fd-wallet-range"><div className="fd-range" role="radiogroup" aria-label={t("overview.chartRange")}>
        {Object.keys(periods).map((option) => <button key={option} type="button" role="radio" aria-checked={range === option} onClick={() => selectRange(option)}>{option}</button>)}</div>
        <button type="button" className="fd-wallet-refresh" aria-label={t("common.refresh")} onClick={() => void onRefresh?.()}><ReloadIcon aria-hidden="true" /></button></div>
    </header>
    {busy ? <div className="fd-card fd-overview-loading"><span className="fd-skeleton" style={{ width: 130, height: 20 }} /><span className="fd-skeleton" style={{ width: 260, height: 36 }} /></div>
      : !view || !sources.length ? <div className="fd-card"><EmptyState icon={BackpackIcon}
        title={t("common.noData")} hint={t("wallets.empty.hint")} /></div> : <>
      <div className="fd-wallet-chips">{[{ id: null, label: t("fidelity.wallets.allSources") }, ...sources].map((source) =>
        <button key={source.id ?? "all"} type="button" className={selected === source.id ? "selected" : ""}
          onClick={() => setSelected(source.id)} title={source.id ?? undefined} aria-label={source.label}>{source.id !== null && source.status?.status === "failed" && <i />}
          {source.id === null ? <span>{source.label}</span> : <AssetLabel kind={source.kind === "exchange" || source.kind === "broker" ? source.kind : "wallet"}
            type={source.provider} name={source.label} size={16} />}</button>)}</div>
      {selectedFailed && chosen && <div className="fd-wallet-failure" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><div><b>{t("fidelity.wallets.failedTitle").replace("{source}", chosen.label)}</b>
        <p>{t(chosen.status?.category === "rateLimit" ? "fidelity.wallets.failedRateLimit" : "fidelity.wallets.failedDescription").replace("{attempt}", time(chosen.status?.finishedAt)).replace("{last}", time(lastGood))}
          {nextRetry && ` ${t("fidelity.wallets.nextRetry").replace("{time}", time(new Date(nextRetry).toISOString()))}`}</p></div>
        <button type="button" onClick={() => chosen.status && requestRefreshSource(chosen.status.sourceId)}><ReloadIcon aria-hidden="true" />{t("refresh.retryButton")}</button></div>}
      <main className="fd-wallet-grid">
        <section className={`fd-card fd-wallet-allocation${chosen ? " selected-source" : ""}${selectedFailed ? " failed-source" : ""}`}>
          <div className="fd-card-heading"><h3>{chosen?.label ?? t("fidelity.wallets.allocation")}</h3><span>{chosen ? <><i className={selectedFailed ? "error" : ""} />{statusLine}{!selectedFailed && chosen.kind === "exchange" ? ` · ${t("fidelity.wallets.exchange")}` : ""}</> : t("fidelity.wallets.shareTotal")}</span></div>
          <div className="fd-wallet-main-stat"><span className="fd-label">{chosen ? t("fidelity.wallets.sourceValue").replace("{source}", chosen.label) + (selectedFailed ? ` (${t("fidelity.wallets.asOf").replace("{time}", time(lastGood))})` : "") : t("overview.design.totalValue")}</span>
            <strong>{money(chosen?.value ?? view.total, currency)}</strong>
            <small data-tone={directionTone(chosen ? sourceDiff : diff)}>{chosen ? sourceDiff === null ? "—" : `${money(sourceDiff, currency, 2, true)} · ${percent(sourceDiff / chosen.baseValue, 2, true)}` : diff === null ? "—" : `${money(diff, currency, 2, true)} · ${percent(diff / view.baseTotal, 2, true)}`} <span>{t("fidelity.wallets.vsDate").replace("{date}", date)}</span></small></div>
          <div className="fd-wallet-kpis">
            {chosen ? <>
              <div><span>{t("fidelity.wallets.shareOfTotal")}</span><b>{percent(share(chosen))}</b><small>{t("fidelity.wallets.ofTotal").replace("{value}", money(view.total, currency, 0))}</small></div>
              <div><span>{t("fidelity.wallets.assets")}</span><b>{chosen.rows.length}</b><small>{t(`fidelity.wallets.kindLower.${chosen.kind}`)}</small></div>
              <div><span>{t("fidelity.wallets.largestAsset")}</span><b>{biggest?.symbol ?? "—"}</b><small>{biggest ? percent(biggest.value / chosen.value) : "—"} {t("fidelity.wallets.ofSource")}</small></div>
            </> : <>
              <div><span>{t("overview.design.sources")}</span><b>{sources.length}</b><small>{t("fidelity.wallets.kindCount").replace("{exchange}", String(sources.filter((item) => item.kind === "exchange").length)).replace("{wallet}", String(sources.filter((item) => item.kind === "wallet").length)).replace("{broker}", String(sources.filter((item) => item.kind === "broker").length))}</small></div>
              <div><span>{t("fidelity.wallets.largestSource")}</span><b>{sources[0] ? percent(share(sources[0])) : "—"}</b><small>{sources[0]?.label}</small></div>
              <div><span>{t("fidelity.wallets.lastRefresh")}</span><b>{time(statuses.reduce<string | undefined>((current, status) => !current || (status.finishedAt ?? status.lastSuccessAt ?? "") > current ? status.finishedAt ?? status.lastSuccessAt : current, undefined))}</b><small>{t("fidelity.wallets.currentSources").replace("{ok}", statuses.length ? String(sources.filter((source) => source.status?.status === "ok").length) : "—").replace("{all}", String(sources.length))}</small></div>
            </>}</div>
          <div className="fd-wallet-split" data-chart-group="">{shareItems.map((item, index) => {
            const detail = `${item.label}: ${money(item.value, currency)} · ${percent(item.fraction, 2)}`;
            return <i key={item.label} role="button" {...chart.markProps(index, detail, detail)}
              style={{ width: `${item.fraction * 100}%`, background: colors[index % colors.length] }} />;
          })}</div>
          {chart.tooltip}
          <div className="fd-wallet-legend">{shareItems.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }} />{item.label} <b>{percent(item.fraction)}</b></span>)}</div>
        </section>
        <section className="fd-card fd-wallet-balances"><div className="fd-card-heading"><h3>{chosen ? t("fidelity.wallets.balances") : t("fidelity.wallets.balancesBySource")}</h3><span>{chosen ? selectedFailed ? t("fidelity.wallets.asOf").replace("{time}", time(lastGood)) : t("fidelity.wallets.refreshedLower").replace("{time}", time(chosen.status?.lastSuccessAt)) : t("fidelity.wallets.changeVs").replace("{date}", date)}</span></div>
          {chosen ? chosen.rows.map((row, index) => { const change = assetDiff(row, chosen.baseRows); const old = chosen.baseRows.find((item) => rowKey(item) === rowKey(row));
            const price = row.amount ? row.value / row.amount : 0; const oldPrice = old?.amount ? old.value / old.amount : 0;
            return <div key={rowKey(row)} className="fd-wallet-balance"><b><AssetLabel asset={{ symbol: row.symbol, assetType: row.assetType === "stock" ? "stock" : "crypto" }}
              size={20} quiet /> <em>{qty(row.amount, row.symbol === "USDT" || row.symbol === "USDC")}</em></b><strong>{money(row.value, currency)}</strong>
              <small>{money(price, currency)} · {percent(row.value / chosen.value)}</small><small data-tone={directionTone(view.base ? change : null)}>{view.base ? `${money(change, currency, 0, true)} · ${percent(oldPrice ? price / oldPrice - 1 : 0, 2, true)}` : "—"}</small></div>; }) :
            sources.map((source, index) => { const change = source.value - source.baseValue; return <button type="button" key={source.id} className="fd-wallet-balance" onClick={() => setSelected(source.id)}>
              <b><AssetLabel kind={source.kind === "exchange" || source.kind === "broker" ? source.kind : "wallet"}
                type={source.provider} name={source.label} size={20} /></b><strong>{money(source.value, currency)}</strong>
              <small>{t(`fidelity.overview.kind.${source.kind}`)} · {percent(share(source))}</small><small data-tone={directionTone(view.base ? change : null)}>{view.base ? `${money(change, currency, 0, true)} · ${percent(source.baseValue ? change / source.baseValue : 0, 2, true)}` : "—"}</small></button>; })}
        </section>
        {!chosen && <section className="fd-card fd-wallet-status"><div className="fd-card-heading"><h3>{t("fidelity.wallets.sourceStatus")}</h3><span>{t("fidelity.wallets.today")}</span></div>
          {sources.map((source) => { const sourceFailed = source.status?.status === "failed" || source.status?.status === "stale"; const next = source.status && retry.nextBySource[source.status.sourceId];
            return <div className="fd-wallet-status-row" key={source.id}><i className={sourceFailed ? "error" : ""} /><div><b>
              <AssetLabel kind={source.kind === "exchange" || source.kind === "broker" ? source.kind : "wallet"}
                type={source.provider} name={source.label} size={20} /></b>
              {sourceFailed ? <><small>{t(source.status?.category === "rateLimit" ? "fidelity.wallets.rateLimitStatus" : "fidelity.wallets.genericFailedStatus").replace("{last}", time(source.status?.lastSuccessAt))}</small>
                <div className="fd-wallet-retry"><button type="button" onClick={() => source.status && requestRefreshSource(source.status.sourceId)}><ReloadIcon aria-hidden="true" />{t("refresh.retryButton")}</button>
                  {next && <span>{t("fidelity.wallets.nextRetry").replace("{time}", time(new Date(next).toISOString()))}</span>}</div></> :
                <small>{source.status?.detail || (source.kind === "exchange" ? t("fidelity.wallets.exchange") : source.kind === "broker" ? t("fidelity.wallets.broker") : t("fidelity.wallets.publicAddress"))}</small>}</div>
              <span className={sourceFailed ? "t3-tag" : undefined} data-tone={sourceFailed ? "negative" : undefined}>{sourceFailed ? t("fidelity.wallets.failed") : time(source.status?.lastSuccessAt)}</span></div>; })}
        </section>}
        {chosen ? <section className="fd-card fd-wallet-changes"><div className="fd-card-heading"><h3>{t("fidelity.wallets.assetChanges")}</h3><span>{range}, {currency.currency}</span></div>
          <MoverList items={movers} currency={currency} />
          <div className="fd-wallet-facts"><div><span>{t("fidelity.wallets.sourceChange")}</span><b data-tone={directionTone(sourceDiff)}>{sourceDiff === null ? "—" : money(sourceDiff, currency, 2, true)}</b></div>
            <div><span>{t("fidelity.wallets.portfolioChangeShare")}</span><b>{sourceDiff !== null && diff ? percent(sourceDiff / diff) : "—"}</b></div></div>
          {quantityEqual && <p className="fd-wallet-note">{t("fidelity.wallets.priceMovement")}</p>}
        </section> : <>
          <section className="fd-card fd-wallet-matrix"><div className="fd-card-heading wallet-source-change-heading"><h3 aria-label={t("fidelity.wallets.assetChangesPerSource")}>{t("fidelity.wallets.assetChangesPerSource")}</h3><span>{t("fidelity.wallets.matrixSubtitle").replace("{range}", range).replace("{date}", date).replace("{currency}", currency.currency)}</span></div>
            <div className="wallet-asset-change-mobile">{allAssets.map((item) => <div key={item.symbol} className="fd-wallet-matrix-row"><b><AssetLabel symbol={item.symbol} size={20} quiet /></b><strong data-tone={directionTone(item.value)}>{money(item.value, currency, 2, true)}</strong><small>{item.details.map((detail, index) => <span key={`${detail.source}-${index}`}>{index > 0 && " · "}{detail.source} <span data-tone={directionTone(detail.change)}>{money(detail.change, currency, 0, true)}</span></span>)}</small></div>)}</div>
          </section>
          <section className="fd-card fd-wallet-moved"><div className="fd-card-heading wallet-source-change-heading"><h3>{t("overview.design.whatMoved")}</h3><span>{range}, {t("fidelity.wallets.allSources").toLowerCase()}</span></div>
            <MoverList items={movers} currency={currency} />
          </section>
        </>}
      </main>
      <button type="button" className="fd-wallet-details-trigger" aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}>{t("fidelity.wallets.detailedAnalysis")}</button>
      {detailsOpen && <section className="d2-wallets fd-wallet-detailed" aria-label={t("fidelity.wallets.detailedAnalysis")} aria-busy={false}>
        <Suspense fallback={<div className="fd-card fd-empty">{t("common.loading")}</div>}>
          <WalletAssetsPercentage currency={currency} dateRange={dateRange} selectedSource={selected} onSelectSource={setSelected} />
          <WalletAssetsChange currency={currency} dateRange={dateRange} quoteColor={quoteColor} selectedSource={selected} />
          <WalletSourceChanges currency={currency} dateRange={dateRange} quoteColor={quoteColor} selectedSource={selected} />
        </Suspense>
      </section>}
    </>}
  </section>;
}

function MoverList({ items, currency }: { items: { symbol: string; value: number }[]; currency: CurrencyRateDetail }) {
  const chart = useChartHitArea();
  const positive = Math.max(0, ...items.map((item) => item.value));
  const negative = Math.max(0, ...items.map((item) => -item.value));
  const zero = negative / (positive + negative || 1) * 92 + 4;
  const unit = (100 - zero - 4) / (positive || 1);
  return <div className="fd-wallet-movers" data-chart-group="">{items.map((item, index) => <div className="fd-wallet-mover" key={item.symbol}><b><AssetLabel symbol={item.symbol} size={20} quiet /></b>
    <span role="button" {...chart.markProps(index, `${item.symbol}: ${money(item.value, currency, 2, true)}`,
      <><div>{item.symbol}</div><div data-tone={directionTone(item.value)}>{money(item.value, currency, 2, true)}</div></>)}
      style={{ "--fd-zero": `${zero}%` } as CSSProperties}>{item.value !== 0 && <i data-tone={directionTone(item.value)} style={item.value > 0
      ? { left: `${zero}%`, width: `${item.value * unit}%` }
      : { right: `${100 - zero}%`, width: `${-item.value * unit}%` }} />}</span>
    <strong data-tone={directionTone(item.value)}>{money(item.value, currency, 0, true)}</strong></div>)}{chart.tooltip}</div>;
}
