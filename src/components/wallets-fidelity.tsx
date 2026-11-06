import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BackpackIcon, ExclamationTriangleIcon, UpdateIcon } from "@radix-ui/react-icons";
import EmptyState from "./empty-state";
import type { AssetModel, CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import { positiveNegativeTone } from "@/utils/color";
import { deriveSourceChanges } from "./wallet-snapshot-matrix";
import { matchSourceStatus } from "./source-status-match";
import { useLatestWalletOrdinals } from "./source-name-order";
import { overviewRefreshRequestedEvent } from "./source-status-event";
import SyncStatusIndicator from "./sync-status-indicator";

type Source = ReturnType<typeof deriveSourceChanges>["sources"][number];
type Matrix = ReturnType<typeof deriveSourceChanges>;
type SnapshotData = { latest: AssetModel[]; baseline: AssetModel[]; at: string; baselineAt: string; matrix: Matrix;
  identities: Record<string, { wallet: string; alias: string; type: string } | undefined> };
const sourceColors = ["#4a8ad6", "#86b4ea", "#d4d6da", "#8c8e95", "#55575d"];
const knownAssetNames: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", USDT: "Tether",
  USDC: "USD Coin", AAPL: "Apple", NVDA: "NVIDIA",
};
const days = [1, 7, 30, 90, 365, -1] as const;
const labels = ["1D", "7D", "30D", "90D", "1Y", "All"];

function formatTime(at?: string) {
  if (!at) return "—";
  return new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function sourceKind(status?: PortfolioSourceStatus, source?: Source, rows?: AssetModel[]) {
  if (status?.kind === "broker" || rows?.some((asset) => asset.wallet === source?.id && asset.assetType === "stock")) return "broker";
  if (status?.kind === "exchange" || ["Binance", "OKX"].includes(source?.label ?? "")) return "exchange";
  return "wallet";
}

export default function WalletsFidelity({ currency, dateRange, quoteColor, selectedSource, onSelectSource,
  statuses, nextBySource, availableDates, onDatePickerValueChange, onLoaded }: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  selectedSource: string | null;
  onSelectSource: (source: string | null) => void;
  statuses: PortfolioSourceStatus[];
  nextBySource?: Record<string, number>;
  availableDates?: Date[];
  onDatePickerValueChange?: (selectedTimes: number, nextDateRange: { from: Date; to: Date }) => void;
  onLoaded?: () => void;
}) {
  const { t } = useTranslation();
  const version = useDataChangedVersion();
  const walletOrdinals = useLatestWalletOrdinals();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1400px)").matches) return;
    let active = true;
    setLoading(true);
    setError(false);
    const load = async () => {
      const beginning = new Date(0);
      const latest = (await queryHistoricalPage({ start: beginning, end: dateRange.end }, 1, 0)).rows[0];
      if (!latest) return null;
      const span = Math.max(1, Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000));
      const baselineEnd = new Date(new Date(latest.createdAt).getTime() - span * 86400000);
      const baseline = (await queryHistoricalPage({ start: beginning, end: baselineEnd }, 1, 0)).rows[0];
      const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.id, ...(baseline ? [baseline.id] : [])]);
      const current = assets.filter((asset) => asset.uuid === latest.id);
      const previous = assets.filter((asset) => asset.uuid === baseline?.id);
      const wallets = [...new Set(assets.map((asset) => asset.wallet).filter((wallet): wallet is string => !!wallet))];
      const aliases: Record<string, { wallet: string; alias: string; type: string } | undefined> =
        await new WalletAnalyzer(async () => []).listWalletAliases(wallets).catch(() => ({}));
      const labels = Object.fromEntries(wallets.map((wallet) => [wallet, aliases[wallet] ?? { id: wallet }]));
      const matrix = deriveSourceChanges(previous, current, labels,
        (index) => t("wallets.fallbackName").replace("{number}", String(index)), walletOrdinals);
      return { latest: current, baseline: previous, at: latest.createdAt,
        baselineAt: baseline?.createdAt ?? "", matrix, identities: aliases };
    };
    void load().then((result) => { if (active) setData(result); })
      .catch(() => { if (active) { setData(null); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateRange.start, dateRange.end, version, t, walletOrdinals]);
  useEffect(() => {
    if (!loading) onLoaded?.();
  }, [loading, onLoaded]);

  const sources = data?.matrix.sources ?? [];
  const total = sources.reduce((sum, source) => sum + source.value, 0);
  const change = data?.matrix.totalChange ?? 0;
  const previousTotal = total - change;
  const chosen = sources.find((source) => source.id === selectedSource);
  const statusFor = (source: Source) => matchSourceStatus(source, data?.identities ?? {}, sources, statuses);
  const selectedStatus = chosen ? statusFor(chosen) : undefined;
  const selectedFailed = selectedStatus?.status === "failed" || selectedStatus?.status === "stale";
  const converted = currencyWrapper(currency);
  const money = (value: number, digits = 2) => `${currency.symbol}${converted(value).toLocaleString("en-US", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })}`;
  const signedMoney = (value: number, digits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value), digits)}`;
  const percent = (value: number, digits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;
  const share = (value: number) => `${(total > 0 ? value / total * 100 : 0).toFixed(1)}%`;
  const tone = (value: number) => value === 0 ? "zero" : positiveNegativeTone(value, quoteColor) === "green" ? "pos" : "neg";
  const activeAssets = useMemo(() => (data?.latest ?? []).filter((asset) => asset.wallet === selectedSource)
    .sort((a, b) => b.value - a.value), [data, selectedSource]);
  const previousAssets = useMemo(() => new Map((data?.baseline ?? []).filter((asset) => asset.wallet === selectedSource)
    .map((asset) => [`${asset.assetType}:${asset.symbol}`, asset])), [data, selectedSource]);
  const sourceAssets = activeAssets.map((asset) => {
    const previous = previousAssets.get(`${asset.assetType}:${asset.symbol}`);
    const delta = asset.value - (previous?.value ?? 0);
    return { ...asset, delta, pct: previous?.value ? delta / previous.value * 100 : 0 };
  });
  const matrixAssets = [...(data?.matrix.assets ?? [])].sort((a, b) => {
    const currentValue = (symbol: string) => (data?.latest ?? []).filter((asset) => asset.symbol === symbol)
      .reduce((sum, asset) => sum + asset.value, 0);
    return currentValue(b.symbol) - currentValue(a.symbol);
  });
  const relevantAssets = chosen ? sourceAssets.map((asset) => ({ symbol: asset.symbol, delta: asset.delta }))
    : matrixAssets.map((asset) => ({ symbol: asset.symbol, delta: asset.total }));
  const movers = [...relevantAssets].sort((a, b) => b.delta - a.delta);
  const moverPositive = Math.max(0, ...movers.map((asset) => asset.delta));
  const moverNegative = Math.max(0, ...movers.map((asset) => -asset.delta));
  const moverZero = moverNegative / (moverPositive + moverNegative || 1) * 92 + 4;
  const moverUnit = (100 - moverZero - 4) / (moverPositive || 1);
  const currentStatuses = sources.filter((source) => statusFor(source)?.status === "ok").length;
  const currentCount = statuses.length || !sources.length ? String(currentStatuses) : "—";
  const refreshedTime = formatTime(statuses.map((status) => status.finishedAt).filter(Boolean).sort().at(-1) ?? data?.at);
  const periodStart = data?.baselineAt ? new Date(data.baselineAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
  const largestAsset = sourceAssets[0];
  const allocation = chosen ? sourceAssets.map((asset) => ({ name: asset.symbol, value: asset.value }))
    : sources.map((source) => ({ name: source.label, value: source.value }));
  const allocationTotal = chosen?.value ?? total;
  const requestedRange = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000);
  const activeRange = days.findIndex((value) => value === requestedRange);
  const onRefresh = (sourceId?: string) => window.dispatchEvent(new CustomEvent(overviewRefreshRequestedEvent, { detail: { sourceId } }));
  const subtitle = chosen
    ? selectedFailed
      ? t("wallets.fidelity.failedSubtitleAt").replace("{source}", chosen.label)
        .replace("{time}", formatTime(selectedStatus?.lastSuccessAt))
        .replace("{refresh}", formatTime(selectedStatus?.finishedAt))
      : t("wallets.fidelity.selectedSubtitle").replaceAll("{source}", chosen.label)
        .replace("{asset}", largestAsset?.symbol ?? "—")
        .replace("{share}", allocationTotal && largestAsset ? `${(largestAsset.value / allocationTotal * 100).toFixed(1)}%` : "—")
        .replace("{change}", signedMoney(chosen.change, 0))
    : t("wallets.fidelity.subtitle").replace("{source}", sources[0]?.label ?? "—")
      .replace("{share}", sources[0] ? share(sources[0].value) : "—")
      .replace("{sourceChange}", signedMoney(sources[0]?.change ?? 0, 0))
      .replace("{change}", signedMoney(change, 0));
  const emphasisStart = chosen ? selectedFailed ? t("wallets.fidelity.showingBalances") : largestAsset?.symbol ?? ""
    : sources[0]?.label ?? "";
  const emphasisEnd = chosen ? selectedFailed ? formatTime(selectedStatus?.lastSuccessAt)
    : allocationTotal && largestAsset ? `${(largestAsset.value / allocationTotal * 100).toFixed(1)}%` : ""
    : sources[0] ? share(sources[0].value) : "";
  const begin = emphasisStart ? subtitle.indexOf(emphasisStart) : -1;
  const endAt = begin >= 0 && emphasisEnd ? subtitle.indexOf(emphasisEnd, begin) : -1;
  const end = endAt < 0 ? -1 : endAt + emphasisEnd.length;
  const subtitleContent = begin >= 0 && end > begin ? <>
    {subtitle.slice(0, begin)}<b>{subtitle.slice(begin, end)}</b>{subtitle.slice(end)}
  </> : subtitle;
  const providerText = (source: Source) => {
    const status = statusFor(source);
    const kind = sourceKind(status, source, data?.latest);
    return kind === "exchange" ? t("wallets.fidelity.apiReadOnly")
      : kind === "broker" ? t("wallets.fidelity.flexQuery") : t("wallets.fidelity.publicAddress");
  };
  const renderMovers = (items: typeof movers) => <div className="t3-wallet-movers">
    {items.map((asset) => <div key={asset.symbol}>
      <strong>{asset.symbol}</strong><span className="t3-wallet-mover-track" style={{ "--zero": `${moverZero}%` } as CSSProperties}><i className={tone(asset.delta)}
        style={{ width: `${Math.max(.5, Math.abs(asset.delta) * moverUnit)}%`,
          left: asset.delta >= 0 ? `${moverZero}%` : undefined,
          right: asset.delta < 0 ? `${100 - moverZero}%` : undefined }} /></span>
      <span className={tone(asset.delta)}>{signedMoney(asset.delta, 0)}</span>
    </div>)}
  </div>;

  return <div className="t3-wallet-fidelity" aria-busy={loading}>
    <header className="t3-wallet-heading">
      <div><h1>{t("wallets.h1")}</h1><p>{subtitleContent}</p></div>
      <div className="t3-wallet-actions">
        <div className="t3-wallet-ranges" role="group" aria-label={t("overview.fidelity.period")}>
          {days.map((day, index) => <button key={day} type="button" aria-pressed={activeRange === index || activeRange < 0 && day === 30}
            onClick={() => {
              const latest = availableDates?.at(-1);
              if (!latest || !availableDates || !onDatePickerValueChange) return;
              const filtered = day < 0 ? availableDates : availableDates.filter((date) => date.getTime() >= latest.getTime() - day * 86400000);
              if (filtered.length) onDatePickerValueChange(filtered.length, { from: filtered[0], to: filtered.at(-1)! });
            }}>{labels[index]}</button>)}
        </div>
        <SyncStatusIndicator overviewFidelity />
        <button className="t3-wallet-status-stamp" type="button" onClick={() =>
          document.querySelector<HTMLButtonElement>(".t3-route-wallets .t3-refresh-source-trigger")?.click()}>
          <i className={statuses.length && currentStatuses < sources.length ? "warn" : ""} />
          {t("wallets.fidelity.refreshedCount").replace("{current}", currentCount)
            .replace("{total}", String(sources.length)).replace("{time}", refreshedTime)}
        </button>
        <button className="t3-wallet-refresh" type="button" onClick={() => onRefresh()}>
          <UpdateIcon aria-hidden="true" />{t("common.refresh")}</button>
      </div>
    </header>
    <nav className="analyze-source-picker t3-wallet-chips" aria-label={t("wallets.h1")}>
      <button type="button" aria-pressed={selectedSource === null} onClick={() => onSelectSource(null)}>{t("wallets.allSources")}</button>
      {sources.map((source) => <button key={source.id} type="button" title={source.id} aria-pressed={selectedSource === source.id}
        onClick={() => onSelectSource(source.id)}>{statusFor(source)?.status === "failed" && <i />}{source.label}</button>)}
    </nav>
    {chosen && selectedFailed && selectedStatus && <div className="t3-wallet-failure-banner" role="alert">
      <ExclamationTriangleIcon aria-hidden="true" /><div><strong>{t("wallets.refreshFailed").replace("{source}", chosen.label)}</strong>
        <span>{selectedStatus.detail || t(`wallets.failure.${selectedStatus.category ?? "other"}`)}
          {selectedStatus.lastSuccessAt && ` ${t("wallets.fidelity.lastGoodBanner").replace("{time}", formatTime(selectedStatus.lastSuccessAt))}`}
          {nextBySource?.[selectedStatus.sourceId] && ` ${t("wallets.fidelity.nextTry").replace("{time}", formatTime(new Date(nextBySource[selectedStatus.sourceId]).toISOString()))}`}</span></div>
      <button type="button" onClick={() => onRefresh(selectedStatus.sourceId)}><UpdateIcon />{t("wallets.fidelity.retry")}</button>
    </div>}
    {error ? <div className="t3-wallet-empty" role="alert">{t("wallets.changeUnavailable")}</div>
      : !loading && (!data || !sources.length) ? <EmptyState icon={BackpackIcon}
        title={t("common.noData")} hint={t("wallets.empty.hint")} className="t3-wallet-empty" />
      : <div className="t3-wallet-grid">
        <section className="t3-wallet-card t3-wallet-allocation">
          <div className="t3-wallet-card-head"><h2>{chosen ? chosen.label : t("wallets.fidelity.allocation")}</h2>
            <span>{chosen ? <><span className={selectedFailed ? "neg" : ""}>
              {selectedFailed ? t("wallets.fidelity.refreshFailed") : t("wallets.fidelity.refreshed")}</span>
              {selectedFailed ? " · " : " "}{selectedFailed ? t("wallets.fidelity.lastGood").replace("{time}", formatTime(selectedStatus?.lastSuccessAt))
                : formatTime(selectedStatus?.finishedAt)} · {providerText(chosen)}
              {!selectedFailed && <button type="button" onClick={() => onRefresh(selectedStatus?.sourceId)}>{t("common.refresh")}</button>}</>
              : t("wallets.fidelity.shareOfTotal")}</span></div>
          <div className="t3-wallet-kpis">
            <div><span>{chosen ? selectedFailed
              ? t("wallets.fidelity.sourceValueAsOf").replace("{source}", chosen.label)
                .replace("{time}", formatTime(selectedStatus.lastSuccessAt))
              : t("wallets.fidelity.sourceValue").replace("{source}", chosen.label)
              : t("wallets.fidelity.totalValue")}</span>
              <strong className="big">{money(allocationTotal)}</strong>
              <small><b>{signedMoney(chosen?.change ?? change)} · {percent(chosen?.percentage ?? (previousTotal ? change / previousTotal * 100 : 0))}</b> · {t("wallets.fidelity.vs").replace("{date}", periodStart)}</small></div>
            <div><span>{chosen ? t("wallets.fidelity.shareOfPortfolio") : t("wallets.fidelity.sources")}</span>
              <strong>{chosen ? share(chosen.value) : sources.length}</strong>
              <small>{chosen ? t("wallets.fidelity.ofTotal").replace("{total}", money(total, 0))
                : t("wallets.fidelity.sourceKinds").replace("{exchange}", String(sources.filter((source) => sourceKind(statusFor(source), source, data?.latest) === "exchange").length))
                  .replace("{wallet}", String(sources.filter((source) => sourceKind(statusFor(source), source, data?.latest) === "wallet").length))
                  .replace("{broker}", String(sources.filter((source) => sourceKind(statusFor(source), source, data?.latest) === "broker").length))}</small></div>
            <div><span>{chosen ? t("wallets.fidelity.assets") : t("wallets.fidelity.largestSource")}</span>
              <strong>{chosen ? sourceAssets.length : sources[0] ? share(sources[0].value) : "—"}</strong>
              <small>{chosen ? sourceKind(selectedStatus, chosen, data?.latest) : sources[0]?.label ?? "—"}</small></div>
            <div><span>{chosen ? t("wallets.fidelity.largestAsset") : t("wallets.fidelity.lastRefresh")}</span>
              <strong>{chosen ? largestAsset?.symbol ?? "—" : refreshedTime}</strong>
              <small>{chosen && largestAsset
                ? t("wallets.fidelity.ofSource").replace("{share}", `${(largestAsset.value / allocationTotal * 100).toFixed(1)}%`)
                : t("wallets.fidelity.currentCount").replace("{current}", currentCount).replace("{total}", String(sources.length))}</small></div>
          </div>
          <div className="t3-wallet-split">{allocation.map((item, index) => <i key={item.name}
            style={{ width: `${allocationTotal ? item.value / allocationTotal * 100 : 0}%`, background: sourceColors[index % sourceColors.length] }} />)}</div>
          <div className="t3-wallet-legend">{allocation.map((item, index) => <span key={item.name}><i style={{ background: sourceColors[index % sourceColors.length] }} />
            {item.name} <b>{allocationTotal ? `${(item.value / allocationTotal * 100).toFixed(1)}%` : "—"}</b></span>)}</div>
        </section>
        <section className="t3-wallet-card t3-wallet-balances"><div className="t3-wallet-card-head">
          <h2>{chosen ? t("wallets.fidelity.balances") : t("wallets.fidelity.balancesBySource")}</h2>
          <span>{chosen ? selectedFailed
            ? t("wallets.fidelity.asOf").replace("{time}", formatTime(selectedStatus?.lastSuccessAt))
            : t("wallets.fidelity.refreshedAt").replace("{time}", formatTime(selectedStatus?.finishedAt))
            : t("wallets.fidelity.changeVs").replace("{date}", periodStart)}</span></div>
          <div className="t3-wallet-table-scroll"><table><thead><tr>{(chosen
            ? ["asset", "amount", "price", "value", "share", "change30", "changePct"]
            : ["source", "value", "share", "change30", "changePct"]).map((field) => <th key={field}>{t(`wallets.fidelity.col.${field}`)}</th>)}</tr></thead>
          <tbody>{chosen ? sourceAssets.map((asset, index) => <tr key={`${asset.assetType}:${asset.symbol}`}><th><i style={{ background: sourceColors[index % sourceColors.length] }} />{asset.symbol}{knownAssetNames[asset.symbol] && <small>{knownAssetNames[asset.symbol]}</small>}</th>
            <td>{asset.amount.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: ["USDT", "USDC"].includes(asset.symbol) ? 2 : 0 })}</td>
            <td>{money(asset.price)}</td><td>{money(asset.value)}</td><td>{`${(asset.value / allocationTotal * 100).toFixed(1)}%`}</td>
            <td className={tone(asset.delta)}>{signedMoney(asset.delta)}</td><td className={tone(asset.pct)}>{percent(asset.pct)}</td></tr>)
            : sources.map((source, index) => <tr key={source.id}><th><i style={{ background: sourceColors[index % sourceColors.length] }} />{source.label}<small>{sourceKind(statusFor(source), source, data?.latest)}</small></th>
              <td>{money(source.value)}</td><td>{share(source.value)}</td><td className={tone(source.change)}>{signedMoney(source.change)}</td>
              <td className={tone(source.percentage ?? 0)}>{source.percentage === null ? "—" : percent(source.percentage)}</td></tr>)}</tbody>
          <tfoot><tr><th>{t("wallets.fidelity.total")}</th>{chosen && <><td /><td /></>}
            <td>{money(allocationTotal)}</td><td>100.0%</td><td className={tone(chosen?.change ?? change)}>{signedMoney(chosen?.change ?? change)}</td>
            <td className={tone(chosen?.percentage ?? (previousTotal ? change / previousTotal * 100 : 0))}>{percent(chosen?.percentage ?? (previousTotal ? change / previousTotal * 100 : 0))}</td></tr></tfoot>
          </table></div></section>
        <section className="t3-wallet-card t3-wallet-side"><div className="t3-wallet-card-head"><h2>{chosen ? t("wallets.fidelity.assetChanges") : t("wallets.fidelity.sourceStatus")}</h2>
          <span>{chosen ? t("wallets.fidelity.thirtyUsd") : t("wallets.fidelity.today")}</span></div>
          {chosen ? <>{renderMovers(movers)}<div className="t3-wallet-facts"><div><span>{t("wallets.fidelity.sourceChange")}</span><b className={tone(chosen.change)}>{signedMoney(chosen.change)}</b></div>
            <div><span>{t("wallets.fidelity.portfolioShareChange")}</span><b>{change ? `${(chosen.change / change * 100).toFixed(1)}%` : "—"}</b></div></div>
            <p>{t("wallets.fidelity.priceFootSelected")}</p></>
            : <div className="t3-wallet-status-list">{sources.map((source) => {
              const status = statusFor(source);
              const bad = status?.status === "failed" || status?.status === "stale";
              return <div key={source.id} className={bad ? "failed" : ""}><div><i className={bad ? "err" : ""} /><strong>{source.label}</strong>
                {bad ? <b>{t("wallets.fidelity.failed")}</b> : <time>{formatTime(status?.finishedAt)}</time>}</div>
                {bad ? <><p>{!status?.detail && status?.category === "rateLimit" && status.lastSuccessAt
                  ? t("wallets.fidelity.rateLimitWithLastGood").replace("{time}", formatTime(status.lastSuccessAt))
                  : <>{status?.detail || t(`wallets.failure.${status?.category ?? "other"}`)}
                    {status?.lastSuccessAt && ` ${t("wallets.fidelity.lastGoodBalances").replace("{time}", formatTime(status.lastSuccessAt))}`}</>}</p>
                  <div className="t3-wallet-status-retry"><button type="button" onClick={() => onRefresh(status?.sourceId)}>
                    <UpdateIcon />{t("wallets.fidelity.retry")}</button>
                    {status && nextBySource?.[status.sourceId] && <span>{t("wallets.fidelity.nextTry")
                      .replace("{time}", formatTime(new Date(nextBySource[status.sourceId]).toISOString()))}</span>}</div></>
                  : <small>{providerText(source)}</small>}</div>;
            })}</div>}
        </section>
        {!chosen && <><section className="t3-wallet-card t3-wallet-matrix"><div className="t3-wallet-card-head"><h2>{t("wallets.fidelity.assetChangesBySource")}</h2>
          <span>{t("wallets.fidelity.thirtyVsUsd").replace("{date}", periodStart)}</span></div>
          <div className="t3-wallet-table-scroll" tabIndex={0} aria-label={t("wallets.fidelity.assetChangesBySource")}><table><thead><tr><th>{t("wallets.fidelity.col.asset")}</th>
            {sources.map((source) => <th key={source.id} title={source.id} aria-label={source.label}><span>{source.label}</span></th>)}<th>{t("wallets.fidelity.total")}</th></tr></thead>
          <tbody>{matrixAssets.map((asset) => <tr key={asset.key}><th>{asset.symbol}</th>
            {sources.map((source) => { const value = asset.values[source.id]; return <td key={source.id} className={value === undefined ? "" : tone(value)}>
              {value === undefined ? "–" : signedMoney(value)}</td>; })}
            <td className={tone(asset.total)}>{signedMoney(asset.total)}</td></tr>)}</tbody>
          <tfoot><tr><th>{t("wallets.fidelity.total")}</th>{sources.map((source) => <td key={source.id} className={tone(source.change)}>{signedMoney(source.change)}</td>)}
            <td className={tone(change)}>{signedMoney(change)}</td></tr></tfoot></table></div></section>
          <section className="t3-wallet-card t3-wallet-moved"><div className="t3-wallet-card-head"><h2>{t("wallets.fidelity.whatMoved")}</h2>
            <span>{t("wallets.fidelity.allSourcesThirty")}</span></div>{renderMovers(movers)}<p>{t("wallets.fidelity.priceFoot")}</p></section></>}
      </div>}
  </div>;
}
