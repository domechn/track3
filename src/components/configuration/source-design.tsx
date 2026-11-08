import { useEffect, useMemo, useState } from "react";
import md5 from "md5";
import {
  BackpackIcon, CheckIcon, Cross2Icon, ExclamationTriangleIcon, Link2Icon, MagnifyingGlassIcon,
  PlusIcon, ReloadIcon, TrashIcon,
} from "@radix-ui/react-icons";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import type { OtherAttachment } from "@/middlelayers/datafetch/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { useTranslation } from "@/i18n";
import { sourceStatusesChangedEvent } from "@/components/source-status-event";
import { LicenseCenter, type ProUsage } from "@/middlelayers/license";
import type { ExchangeDraft, ExchangeRow, OtherRow, StockBrokerDraft, StockBrokerRow, WalletDraft, WalletRow } from "./types";
import { SourceEditorDesign } from "./source-editor-design";
import EmptyState from "@/components/empty-state";
import { AliasRename } from "./alias-rename";
import { sourceAliasFallback } from "@/components/source-display-name";
import { matchSourceStatus } from "@/components/source-status-match";
import { currentSourceStatusLabels, sourceStatusMatches } from "@/middlelayers/source-status-labels";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";

type Tab = "exchanges" | "wallets" | "brokers" | "custom";
type Holding = { wallet: string; symbol: string; amount: number; value: number; price: number };
type SourceEntry =
  | { kind: "exchange"; row: ExchangeRow; name: string; identity: string; active: boolean }
  | { kind: "wallet"; row: WalletRow; name: string; identity: string; active: boolean }
  | { kind: "broker"; row: StockBrokerRow; name: string; identity: string; active: boolean };
type Props = {
  loading: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  exchanges: ExchangeRow[];
  wallets: WalletRow[];
  brokers: StockBrokerRow[];
  others: OtherRow[];
  onExchangeToggle: (type: string, key: string) => void;
  onWalletToggle: (type: string, address: string) => void;
  onBrokerToggle: (type: string, queryId: string) => void;
  onExchangeRemove: (type: string, key: string) => void;
  onWalletRemove: (type: string, address: string) => void;
  onBrokerRemove: (type: string, queryId: string) => void;
  onOtherRemove: (index: number) => void;
  onOtherAttach: (index: number, attachment?: OtherAttachment) => void;
  onExchangeQuickLook: (row: ExchangeRow) => void;
  onWalletQuickLook: (row: WalletRow) => void;
  onBrokerQuickLook: (row: StockBrokerRow) => void;
  onSaveExchange: (draft: ExchangeDraft) => Promise<boolean>;
  onSaveWallet: (draft: WalletDraft) => Promise<boolean>;
  onSaveBroker: (draft: StockBrokerDraft) => Promise<boolean>;
  onSaveCustom: (row: OtherRow) => boolean;
  onExchangeRename?: (type: string, key: string, alias: string) => void;
  onWalletRename?: (type: string, address: string, alias: string) => void;
  onBrokerRename?: (type: string, queryId: string, alias: string) => void;
  onOtherRename?: (index: number, alias: string) => void;
};

const usd = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 8 });
const token = (text: string) => text.slice(-4);
const attachmentsEqual = (left?: OtherAttachment, right?: OtherAttachment) =>
  left?.kind === right?.kind && left?.type === right?.type && left?.identity === right?.identity;
const exchangeIdentity = (row: ExchangeRow) => md5(`${row.type}-${row.apiKey}`);
const walletIdentity = (row: WalletRow) => md5(row.address);
const brokerIdentity = (row: StockBrokerRow) => md5(`${row.type}:${row.queryId}`);

export function SourceDesign({
  loading,
  tab, setTab, exchanges, wallets, brokers, others,
  onExchangeToggle, onWalletToggle, onBrokerToggle,
  onExchangeRemove, onWalletRemove, onBrokerRemove, onOtherRemove, onOtherAttach,
  onExchangeQuickLook, onWalletQuickLook, onBrokerQuickLook,
  onSaveExchange, onSaveWallet, onSaveBroker, onSaveCustom,
  onExchangeRename, onWalletRename, onBrokerRename, onOtherRename,
}: Props) {
  const { t } = useTranslation();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const [sourceStatuses, setSourceStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const displayStatuses = useMemo(() => currentSourceStatusLabels(sourceStatuses, configurationFromForm({
    exchanges, wallets, stockBrokers: brokers, others, groupUSD: false, hideInactive: false,
  })), [sourceStatuses, exchanges, wallets, brokers, others]);
  const [usage, setUsage] = useState<ProUsage>();
  useEffect(() => { void LicenseCenter.getInstance().getUsage().then(setUsage).catch(() => {}); }, []);
  const [overlay, setOverlay] = useState<
    | { kind: "remove"; name: string; sourceKind?: "exchange" | "wallet" | "broker" | "custom"; apply: () => void }
    | { kind: "quicklook"; name: string; identity: string; refresh: () => void }
    | { kind: "attach"; index: number }
  >();
  const [selectedAttachment, setSelectedAttachment] = useState<OtherAttachment>();
  const [editor, setEditor] = useState<Tab>();

  useEffect(() => {
    let live = true;
    void queryHistoricalData(1, false, { includeTransactions: false }).then((rows) => {
      const snapshot = rows[0];
      const grouped = new Map<string, Holding>();
      for (const asset of snapshot?.assets ?? []) {
        const key = `${asset.wallet ?? ""}\0${asset.symbol}`;
        const item = grouped.get(key) ?? { wallet: asset.wallet ?? "", symbol: asset.symbol, amount: 0, value: 0, price: 0 };
        item.amount += asset.amount;
        item.value += asset.value;
        item.price = Math.max(item.price, asset.price);
        grouped.set(key, item);
      }
      if (live) { setHoldings([...grouped.values()]); setRefreshedAt(snapshot?.createdAt); setHoldingsLoading(false); }
    }).catch(() => { if (live) setHoldingsLoading(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const update = () => setSourceStatuses(readStoredStatuses());
    window.addEventListener(sourceStatusesChangedEvent, update);
    return () => window.removeEventListener(sourceStatusesChangedEvent, update);
  }, []);
  const sourceValue = (identity: string) => holdings.filter((item) => item.wallet === identity).reduce((sum, item) => sum + item.value, 0);
  const otherPrice = (row: OtherRow) => {
    const price = row.price;
    if (price?.kind === "manual") return price.usd;
    if (price?.kind === "follow") return (holdings.find((item) => item.symbol === price.symbol)?.price ?? Number.NaN) * price.ratio;
    return Number.NaN;
  };
  const dateText = refreshedAt && new Date(refreshedAt).toDateString() === new Date().toDateString()
    ? `${t("fidelity.source.today")} ${new Date(refreshedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`
    : refreshedAt ? new Date(refreshedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
  const counts = { exchanges: exchanges.length, wallets: wallets.length, brokers: brokers.length, custom: others.length };
  const rows = useMemo<SourceEntry[]>(() => tab === "exchanges"
    ? exchanges.map((row) => ({ kind: "exchange" as const, row, name: row.alias || row.type, identity: exchangeIdentity(row), active: row.active }))
    : tab === "wallets"
      ? wallets.map((row) => ({ kind: "wallet" as const, row, name: row.alias || `${row.address.slice(0, 4)}…${row.address.slice(-4)}`, identity: walletIdentity(row), active: row.active }))
      : tab === "brokers"
        ? brokers.map((row) => ({ kind: "broker" as const, row, name: row.alias || "Interactive Brokers", identity: brokerIdentity(row), active: row.active }))
        : [], [tab, exchanges, wallets, brokers]);
  const renameNames = [
    ...exchanges.map((row) => row.alias || sourceAliasFallback("exchange", row.type, row.apiKey)),
    ...wallets.map((row) => row.alias || sourceAliasFallback("wallet", row.type, row.address)),
    ...brokers.map((row) => row.alias || sourceAliasFallback("broker", row.type, row.queryId)),
    ...others.map((row) => row.alias || sourceAliasFallback("custom", row.symbol)),
  ];
  const renameOffset = tab === "wallets" ? exchanges.length
    : tab === "brokers" ? exchanges.length + wallets.length
      : tab === "custom" ? exchanges.length + wallets.length + brokers.length : 0;
  const aliasFallback = (entry: SourceEntry) => sourceAliasFallback(entry.kind, entry.row.type,
    entry.kind === "exchange" ? entry.row.apiKey : entry.kind === "wallet" ? entry.row.address : entry.row.queryId);
  const statusSource = (entry: SourceEntry) => ({ kind: entry.kind, type: entry.row.type,
    identifier: entry.kind === "exchange" ? entry.row.apiKey
      : entry.kind === "wallet" ? entry.row.address : entry.row.queryId });
  const statusSources = rows.map((entry, index) => ({
    ...statusSource(entry),
    ordinal: entry.kind === "broker" && entry.active
      ? rows.slice(0, index + 1).filter((item) =>
        item.kind === "broker" && item.active && item.row.type === entry.row.type).length
      : undefined,
  }));
  const statusIdentities = Object.fromEntries(rows.map((entry) => [
    entry.identity, { wallet: statusSource(entry).identifier, type: entry.row.type },
  ]));
  const statusPeers = rows.map((entry) => ({ id: entry.identity, label: entry.name }));
  const rowStatuses = statusSources.map((entry, index) => {
    const matches = displayStatuses.filter((status) =>
      sourceStatusMatches(status, entry) &&
      statusSources.filter((source) => sourceStatusMatches(status, source)).length === 1);
    return matches.length === 1 ? matches[0] : matches.length === 0
      ? matchSourceStatus(statusPeers[index], statusIdentities, statusPeers,
        displayStatuses.filter((status) => !status.hint)) : undefined;
  });
  const names: Record<Tab, string> = {
    exchanges: t("fidelity.source.exchanges"), wallets: t("fidelity.source.wallets"),
    brokers: t("fidelity.source.brokers"), custom: t("fidelity.source.custom"),
  };
  const addLabels: Record<Tab, string> = {
    exchanges: t("fidelity.source.addExchange"), wallets: t("fidelity.source.addWallet"),
    brokers: t("fidelity.source.addBroker"), custom: t("fidelity.source.addCustom"),
  };
  const activeCount = rows.filter((item) => item.active).length;
  const total = rows.reduce((sum, item) => sum + (item.active ? sourceValue(item.identity) : 0), 0);
  const note = tab === "exchanges" ? t("fidelity.source.readOnlyNote")
    : tab === "wallets" ? `${t("fidelity.source.walletNote")}${usage ? ` ${t("fidelity.source.walletUsage")
      .replace("{erc20}", `${usage.usage.erc20.used}/${usage.usage.erc20.limit}`)
      .replace("{tron}", `${usage.usage.tron.used}/${usage.usage.tron.limit}`)}` : ""}`
      : tab === "brokers" ? t("fidelity.source.brokerNote") : t("fidelity.source.customNote");
  const currentHoldings = overlay?.kind === "quicklook"
    ? holdings.filter((item) => item.wallet === overlay.identity).sort((a, b) => b.value - a.value) : [];
  const attachOptions: { name: string; detail: string; attachment?: OtherAttachment; unavailable?: boolean }[] = [
    { name: t("fidelity.source.standalone"), detail: t("fidelity.source.notAttached") },
    ...exchanges.map((row) => ({ name: row.alias || row.type, detail: t("fidelity.source.exchange"), attachment: { kind: "cex" as const, type: row.type, identity: row.apiKey } })),
    ...wallets.map((row) => ({ name: row.alias || row.address, detail: t("fidelity.source.wallet"), attachment: { kind: "wallet" as const, type: row.type, identity: row.address } })),
    ...brokers.map((row) => ({ name: row.alias || "Interactive Brokers", detail: t("fidelity.source.broker"), unavailable: true })),
  ];
  const close = () => setOverlay(undefined);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("t3-source-editor-state", { detail: !!editor }));
    return () => {
      window.dispatchEvent(new CustomEvent("t3-source-editor-state", { detail: false }));
    };
  }, [editor]);

  const emptySource = <div className="t3-fidelity-source-empty"><EmptyState icon={BackpackIcon}
    className="t3-fidelity-source-empty-inner"
    title={t("fidelity.source.empty").replace("{name}", names[tab].toLowerCase())}
    hint={t("fidelity.source.emptyBody")}
    action={<button onClick={() => setEditor(tab)}><PlusIcon />{addLabels[tab]}</button>} /></div>;

  return <section className="t3-fidelity-source-page" data-editor-open={!!editor}>
    <button className="t3-fidelity-source-add" type="button" onClick={() => setEditor(tab)}><PlusIcon />{addLabels[tab]}</button>
    <div className="t3-fidelity-source-tabs" role="group" aria-label={t("settings.phase6.sources")}>
      {(["exchanges", "wallets", "brokers", "custom"] as Tab[]).map((item) =>
        <button type="button" key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>
          {names[item]} <span>{counts[item]}</span>
        </button>)}
    </div>
    <div className="t3-fidelity-source-card" data-testid="source-table">
      {tab !== "custom" ? loading || holdingsLoading ? <>
        <div className="t3-fidelity-source-head"><span>{t("fidelity.source.source")}</span><span>{t("fidelity.source.status")}</span>
          <span>{t("fidelity.source.lastRefresh")}</span><span>{t("fidelity.source.value")}</span><span>{t("fidelity.source.active")}</span><span /></div>
        {[0, 1, 2].map((index) => <div className="t3-fidelity-source-row" key={index}>
          <div className="t3-fidelity-source-id"><span className="t3-fidelity-source-skeleton logo" /><div><span className="t3-fidelity-source-skeleton name" /><span className="t3-fidelity-source-skeleton metadata" /></div></div>
          <span className="t3-fidelity-source-skeleton status" /><span className="t3-fidelity-source-skeleton refresh" /><span className="t3-fidelity-source-skeleton value" /><span className="t3-fidelity-source-skeleton switch" />
        </div>)}
        <div className="t3-fidelity-source-foot"><span className="t3-fidelity-source-skeleton summary" /></div>
      </> : rows.length ? <>
        <div className="t3-fidelity-source-head"><span>{t("fidelity.source.source")}</span><span>{t("fidelity.source.status")}</span>
          <span>{t("fidelity.source.lastRefresh")}</span><span>{t("fidelity.source.value")}</span><span>{t("fidelity.source.active")}</span><span /></div>
        {rows.map((entry, rowIndex) => {
          const { kind, row, name, identity, active } = entry;
          const value = sourceValue(identity);
          const sourceStatus = rowStatuses[rowIndex];
          const stale = active && (sourceStatus?.status === "stale" || sourceStatus?.status === "failed");
          const latestGood = sourceStatus?.lastSuccessAt
            ? new Date(sourceStatus.lastSuccessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
            : undefined;
          const abbreviated = kind === "wallet" ? row.address.slice(0, 4) : kind === "broker" ? row.queryId.slice(0, 3) : token(row.apiKey);
          const end = kind === "wallet" ? row.address.slice(-4) : kind === "broker" ? row.queryId.slice(-3) : "";
          const metadata = kind === "wallet" ? row.type === "btc" ? `Bitcoin · ${abbreviated}…${end}`
            : row.type === "erc20" ? "Ethereum · ERC20 tokens" : `${row.type.toUpperCase()} · ${abbreviated}…${end}`
            : kind === "broker" ? `Flex Query · ID ${abbreviated}…${end}`
              : `${t("fidelity.source.exchange")} · ${t("fidelity.source.apiEnding")} ${abbreviated}`;
          const refresh = () => kind === "exchange" ? onExchangeQuickLook(row)
            : kind === "wallet" ? onWalletQuickLook(row) : onBrokerQuickLook(row);
          const remove = () => kind === "exchange" ? onExchangeRemove(row.type, row.apiKey)
            : kind === "wallet" ? onWalletRemove(row.type, row.address) : onBrokerRemove(row.type, row.queryId);
          const toggle = () => kind === "exchange" ? onExchangeToggle(row.type, row.apiKey)
            : kind === "wallet" ? onWalletToggle(row.type, row.address) : onBrokerToggle(row.type, row.queryId);
          return <div className={`t3-fidelity-source-row ${stale ? "error" : ""}`} key={`${kind}:${identity}`}>
            <div className="t3-fidelity-source-id"><span className="t3-fidelity-source-logo">{kind === "wallet" ? row.type === "erc20" ? "ETH" : row.type.slice(0, 3).toUpperCase() : kind === "broker" ? "IB" : ({ binance: "BN", okex: "OK", kraken: "KR" } as Record<string, string>)[row.type] ?? row.type.slice(0, 2).toUpperCase()}</span><div><button type="button" className="t3-fidelity-source-name" aria-label={`${t("fidelity.source.edit")} ${name}`} onClick={() => setEditor(tab)}><b title={name}>{name}</b></button><small>{metadata}{kind === "wallet" && row.type === "erc20" && <span className="t3-fidelity-source-pro">Pro</span>}</small></div></div>
            <div><span className={`t3-fidelity-source-pill ${stale ? "error" : active ? "on" : ""}`}><i />{stale ? t("fidelity.source.error") : active ? t("fidelity.source.active") : t("fidelity.source.paused")}</span></div>
            <div className={stale ? "t3-fidelity-source-warning" : active ? "" : "t3-fidelity-source-faint"}>{stale && latestGood ? `${t("fidelity.source.lastGood")} ${latestGood}` : active && latestGood ? `${t("fidelity.source.today")} ${latestGood}` : !active && sourceStatus?.lastSuccessAt
              ? new Date(sourceStatus.lastSuccessAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).replace(" at ", ", ")
              : active && value > 0 ? dateText : "—"}</div>
            <div className="t3-fidelity-source-value">{active && value > 0 ? usd(value) : "—"}{stale && value > 0 && <small>{t("fidelity.source.stale")}</small>}</div>
            <div className="t3-fidelity-source-switch"><button type="button" role="switch" aria-label={`${t("fidelity.source.active")} ${name}`} aria-checked={active} onClick={toggle}><i /></button></div>
            <div className="t3-fidelity-source-actions">
              <button type="button" className="t3-fidelity-source-quick" data-testid={`source-quicklook-${name}`} disabled={!active} onClick={() => setOverlay({ kind: "quicklook", name, identity, refresh })}><MagnifyingGlassIcon />{t("fidelity.source.quickLook")}</button>
              <AliasRename alias={row.alias} name={name}
                fallback={aliasFallback(entry)}
                names={renameNames} index={renameOffset + rowIndex}
                onRename={(alias) => {
                  if (kind === "exchange") onExchangeRename?.(row.type, row.apiKey, alias);
                  else if (kind === "wallet") onWalletRename?.(row.type, row.address, alias);
                  else onBrokerRename?.(row.type, row.queryId, alias);
                }} />
              <button type="button" aria-label={`${t("fidelity.source.remove")} ${name}`} data-testid={`source-remove-${name}`}
                onClick={() => setOverlay({ kind: "remove", name, sourceKind: kind, apply: remove })}><TrashIcon /></button>
            </div>
            {stale && <div className="t3-fidelity-source-error"><ExclamationTriangleIcon /><span>{sourceStatus?.category === "auth" ? t("fidelity.source.authError") : sourceStatus?.detail || t("fidelity.source.genericError")}</span><button type="button" onClick={refresh}><ReloadIcon />{t("fidelity.source.retry")}</button></div>}
          </div>;
        })}
        <div className="t3-fidelity-source-foot"><span>{activeCount} {t("fidelity.source.activeLower")}{rows.length - activeCount ? `, ${rows.length - activeCount} ${t("fidelity.source.pausedLower")}` : ""}{rowStatuses.flatMap((status, index) => status?.status === "stale" && rows[index].active ? [` · ${t("fidelity.source.staleNote").replace("{name}", rows[index].name).replace("{time}", status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "—")}`] : []).join("")}</span><b>{usd(total)}</b></div>
      </> : emptySource : !others.length ? emptySource : <>
        <div className="t3-fidelity-source-head custom"><span>{t("fidelity.source.asset")}</span><span>{t("fidelity.source.price")}</span><span>{t("fidelity.source.attachedTo")}</span><span>{t("fidelity.source.value")}</span><span>{t("fidelity.source.active")}</span><span /></div>
        {others.map((row, index) => <div className="t3-fidelity-source-row custom" key={`${row.symbol}:${index}`}>
          <div className="t3-fidelity-source-id"><span className="t3-fidelity-source-logo">{row.symbol === "GOLD" ? "AU" : row.symbol.slice(0, 2)}</span><div><button type="button" className="t3-fidelity-source-name" aria-label={`${t("fidelity.source.edit")} ${row.symbol}`} onClick={() => setEditor(tab)}><b>{row.symbol}</b></button><small title={row.alias || row.symbol}>{row.alias || row.symbol} · {amount(row.amount)}</small></div></div>
          <div className="t3-fidelity-source-custom-price">{row.price?.kind === "manual" ? `${t("fidelity.source.manual")} · ${usd(row.price.usd)}` : row.price?.kind === "follow" ? `${t("fidelity.source.follows")} ${row.price.symbol} · ${Number.isFinite(otherPrice(row)) ? usd(otherPrice(row)) : "—"}` : "—"}<small>{t("fidelity.source.attachedTo")} {row.attachTo ? row.attachTo.identity : t("fidelity.source.standalone")}</small></div>
          <div className="t3-fidelity-source-value">{Number.isFinite(otherPrice(row)) ? usd(otherPrice(row) * row.amount) : "—"}</div>
          <div className="t3-fidelity-source-switch"><span className="t3-fidelity-source-switch-static"><i /></span></div>
          <div className="t3-fidelity-source-actions">
            <button className="t3-fidelity-source-quick" type="button" data-testid={`source-attach-${row.symbol}`} onClick={() => { setSelectedAttachment(row.attachTo); setOverlay({ kind: "attach", index }); }}><Link2Icon />{t("fidelity.source.attach")}</button>
            <AliasRename alias={row.alias} name={row.alias || row.symbol} fallback={sourceAliasFallback("custom", row.symbol)}
              names={renameNames} index={renameOffset + index}
              onRename={(alias) => onOtherRename?.(index, alias)} />
            <button type="button" aria-label={`${t("fidelity.source.remove")} ${row.symbol}`} onClick={() => setOverlay({ kind: "remove", name: row.symbol, sourceKind: "custom", apply: () => onOtherRemove(index) })}><TrashIcon /></button>
          </div>
        </div>)}
        <div className="t3-fidelity-source-foot"><span>{others.length} {t("fidelity.source.customLower")}</span><b>{usd(others.reduce((sum, row) => sum + (Number.isFinite(otherPrice(row)) ? otherPrice(row) * row.amount : 0), 0))}</b></div>
      </>}
    </div>
    <div className="t3-fidelity-source-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg><div><b>{t(tab === "custom" ? "fidelity.source.customInfo" : "fidelity.source.readOnly")}</b><span>{note}</span></div></div>
    {overlay && <div className="t3-fidelity-source-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="t3-fidelity-source-dialog" role="dialog" aria-modal="true" aria-label={overlay.kind === "remove" ? `${t("fidelity.source.remove")} ${overlay.name}?` : overlay.kind === "quicklook" ? overlay.name : t("fidelity.source.attach")}>
        {overlay.kind === "remove" ? <>
          <h3>{t("fidelity.source.removeQuestion").replace("{name}", overlay.name)}</h3>
          <p>{t(overlay.sourceKind === "exchange" ? "fidelity.source.removeExactBody" : "fidelity.source.removeBody").replace("{name}", overlay.name)}</p>
          <footer><button onClick={close}>{t("common.cancel")}</button><button className="danger" onClick={() => { overlay.apply(); close(); }}><TrashIcon />{t("fidelity.source.remove")} {overlay.name}</button></footer>
        </> : overlay.kind === "quicklook" ? <>
          <div className="t3-fidelity-source-dialog-heading"><span className="t3-fidelity-source-logo">{overlay.name.slice(0, 2).toUpperCase()}</span><div><h3>{overlay.name}</h3><small>{t("fidelity.source.quickSubtitle").replace("{time}", dateText.toLowerCase())}</small></div><button aria-label={t("common.close")} onClick={close}><Cross2Icon /></button></div>
          <table><thead><tr><th>{t("fidelity.source.asset")}</th><th>{t("fidelity.source.amount")}</th><th>{t("fidelity.source.price")}</th><th>{t("fidelity.source.value")}</th></tr></thead><tbody>
            {currentHoldings.map((item) => <tr key={item.symbol}><td>{item.symbol}</td><td>{amount(item.amount)}</td><td>{usd(item.price)}</td><td>{usd(item.value)}</td></tr>)}
            <tr><td colSpan={3}>{t("fidelity.source.total")}</td><td>{usd(currentHoldings.reduce((sum, item) => sum + item.value, 0))}</td></tr>
          </tbody></table>
          <div className="t3-fidelity-source-quota"><span>✧</span><div><b>{t("fidelity.source.quota")}</b><small>{usage
            ? t("fidelity.source.quotaDetail").replace("{erc20}", `${usage.usage.erc20.used}/${usage.usage.erc20.limit}`).replace("{tron}", `${usage.usage.tron.used}/${usage.usage.tron.limit}`)
            : t("fidelity.source.quotaUnknown")}</small></div></div>
          <footer><button onClick={close}>{t("common.close")}</button><button className="primary" onClick={() => { overlay.refresh(); close(); }}><ReloadIcon />{t("fidelity.source.refresh")} {overlay.name}</button></footer>
        </> : <>
          <h3>{t("fidelity.source.attachQuestion").replace("{name}", others[overlay.index]?.symbol ?? "")}</h3>
          <p>{t("fidelity.source.attachBody")}</p>
          <div className="t3-fidelity-source-attach-list">{attachOptions.map((option) => <button type="button" key={`${option.detail}:${option.name}`}
            className={!option.unavailable && attachmentsEqual(option.attachment, selectedAttachment) ? "selected" : ""}
            disabled={option.unavailable}
            onClick={() => setSelectedAttachment(option.attachment)}><span className="radio"><CheckIcon /></span><b>{option.name}</b><small>{option.detail}{option.unavailable ? ` · ${t("fidelity.source.unavailable")}` : ""}</small></button>)}</div>
          <footer><button onClick={close}>{t("common.cancel")}</button><button className="primary" onClick={() => { onOtherAttach(overlay.index, selectedAttachment); close(); }}>{t("fidelity.source.attach")}</button></footer>
        </>}
      </div>
    </div>}
    {editor && <SourceEditorDesign tab={editor} onClose={() => setEditor(undefined)}
      exchanges={exchanges} wallets={wallets} brokers={brokers} usage={usage}
      onSaveExchange={onSaveExchange} onSaveWallet={onSaveWallet} onSaveBroker={onSaveBroker} onSaveCustom={onSaveCustom} />}
  </section>;
}
