import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { InfoCircledIcon, Pencil1Icon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { currencyWrapper } from "@/utils/currency";
import { directionPhysicalTone, positiveNegativeColor } from "@/utils/color";
import {
  deleteHistoricalDataByUUID as removeHistoricalSnapshot, deleteHistoricalDataDetailById as removeHistoricalAsset, queryEditLog,
  queryHistoricalDetail, queryHistoricalPage,
  queryRestoreHistoricalData, restoreHistoricalData,
} from "@/middlelayers/charts";
import { setCurrentComparisonDates } from "@/middlelayers/ui-state/page-prefs";
import type { HistoricalPageRow, SnapshotEdit } from "@/middlelayers/charts-history";
import type { CurrencyRateDetail, HistoricalData, QuoteColor } from "@/middlelayers/types";
import type { AssetModel } from "@/middlelayers/types";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { addToBlacklist } from "@/middlelayers/configuration";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
import { useOptimisticDelete } from "./common/use-optimistic-delete";
import AssetLabel from "./common/asset-label";
import { HistoryPartialDetails } from "./history-partial";
import SyncStatusIndicator from "./sync-status-indicator";
import { FidelityDateInput } from "./fidelity-date-input";
import { sourceDisplayNames } from "./source-display-name";
import { useLatestWalletOrdinals } from "./source-name-order";
import { toast } from "./ui/use-toast";
import { ClockIcon } from "@radix-ui/react-icons";
import EmptyState from "./empty-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";

const PAGE_SIZE = 50;
const allDates = { start: new Date("1970-01-01T00:00:00.000Z"), end: new Date("9999-12-31T23:59:59.999Z") };

export default function HistoricalDataDesktop({ currency, quoteColor, afterDataChanged }: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  afterDataChanged?: (action: "delete" | "undoDeletion", uuid?: string, id?: number) => unknown;
}) {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const version = useDataChangedVersion();
  const walletOrdinals = useLatestWalletOrdinals();
  const [rows, setRows] = useState<HistoricalPageRow[]>([]);
  const [count, setCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ partial: 0, edited: 0 });
  const [listError, setListError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoricalData | null>(null);
  const [edits, setEdits] = useState<SnapshotEdit[] | null>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const [editLogError, setEditLogError] = useState(false);
  const [sourceAssets, setSourceAssets] = useState<AssetModel[]>([]);
  const [sourceIdentities, setSourceIdentities] = useState<Awaited<ReturnType<WalletAnalyzer["listWalletAliases"]>>>({});
  const [stablecoins, setStablecoins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [detailPage, setDetailPage] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState<"all" | "edited" | "partial">("all");
  const [reload, setReload] = useState(0);
  const skipReloadVersion = useRef<number | null>(null);
  const lastListQuery = useRef<{ dates: typeof dates; page: number; filter: typeof filter; reload: number } | null>(null);
  const hasLoadedList = useRef(false);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const latestVersion = useRef(version);
  latestVersion.current = version;
  const { run: runDelete, isDeleting } = useOptimisticDelete(setRows);
  const { run: runAssetDelete, isDeleting: isDeletingAsset } = useOptimisticDelete(setDetail);

  useEffect(() => {
    let active = true;
    void new StableCoinsQuery().listAllStableCoins().then((symbols) => {
      if (active) setStablecoins(new Set(symbols.map((symbol) => symbol.toUpperCase())));
    });
    return () => { active = false; };
  }, []);

  const dates = useMemo(() => {
    if (from || to) return {
      start: from ? new Date(`${from}T00:00:00`) : allDates.start,
      end: to ? new Date(`${to}T23:59:59.999`) : allDates.end,
    };
    if (range === "all") return allDates;
    return { start: new Date(Date.now() - Number(range) * 86_400_000), end: allDates.end };
  }, [range, from, to]);

  useEffect(() => {
    const sameQuery = lastListQuery.current?.dates === dates && lastListQuery.current.page === page &&
      lastListQuery.current.filter === filter && lastListQuery.current.reload === reload;
    const silent = skipReloadVersion.current === version || (sameQuery && hasLoadedList.current);
    if (skipReloadVersion.current === version) skipReloadVersion.current = null;
    lastListQuery.current = { dates, page, filter, reload };
    let active = true;
    if (!silent) setLoading(true);
    Promise.all([queryHistoricalPage(dates, PAGE_SIZE, page, filter),
      queryHistoricalPage(dates, 1, 0, "edited"), queryHistoricalPage(dates, 1, 0, "partial")])
      .then(([result, edited, partial]) => {
      if (!active) return;
      setRows(result.rows);
      setCount(result.totalCount);
      setStatusCounts({ edited: edited.totalCount, partial: partial.totalCount });
      setListError(false);
      hasLoadedList.current = true;
      setSelectedId((id) => id && result.rows.some((row) => row.id === id)
        ? id : result.rows[0]?.id ?? null);
      if (!silent) setLoading(false);
    }).catch(() => {
      if (active && !silent) { setListError(true); setLoading(false); }
    });
    return () => { active = false; };
  }, [dates, page, filter, version, reload]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setEdits(null); setSourceAssets([]); setSourceIdentities({}); return; }
    setDetailPage(0);
    let active = true;
    if (detailRef.current?.id !== selectedId) {
      setDetail(null);
      setEdits(null);
      setDetailLoading(true);
    }
    setDetailError(false);
    setEditLogError(false);
    void Promise.all([queryHistoricalDetail(selectedId), ASSET_HANDLER.listAssetsByUUIDs([selectedId])]).then(async ([record, raw]) => {
      const ids = [...new Set(raw.map((asset) => asset.wallet).filter((id): id is string => !!id))];
      const identities = ids.length ? await new WalletAnalyzer(async () => []).listWalletAliases(ids).catch(() => ({})) : {};
      if (active) { setDetail(record); setSourceAssets(raw); setSourceIdentities(identities); setDetailLoading(false); }
    }).catch(() => {
      if (active) { setDetailError(true); setDetailLoading(false); }
    });
    void queryEditLog(selectedId).then((log) => {
      if (active) setEdits(log);
    }).catch(() => {
      if (active) { setEdits([]); setEditLogError(true); }
    });
    return () => { active = false; };
  }, [selectedId, version]);

  const money = (value: number) => `${currency.symbol}${currencyWrapper(currency)(Math.abs(value)).toLocaleString(
    locale === "zh" ? "zh-CN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(value)}`;
  const color = (value: number) => positiveNegativeColor(value, quoteColor);
  const dateFormat = (value: string, pattern: string) =>
    format(new Date(value), pattern, locale === "zh" ? { locale: zhCN } : undefined);
  const dateDay = (value: string) => dateFormat(value, "d MMM");
  const dateTime = (value: string) => dateFormat(value, "HH:mm");
  const dateShort = (value: string) => `${dateDay(value)} ${dateTime(value)}`;
  const dateLatest = (value: string) => dateFormat(value, "d MMM, HH:mm");
  const dateLong = (value: string) => dateFormat(value, "d MMM yyyy, HH:mm");
  const quantity = (assetType: string, value: number) => value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: assetType === "stock" ? 0 : assetType === "stablecoin" ? 2 : 4,
    maximumFractionDigits: 8,
  });
  const price = (asset: AssetModel | { symbol: string; assetType?: string }, value: number) =>
    asset.assetType === "crypto" && stablecoins.has(asset.symbol.toUpperCase())
      ? `${currency.symbol}${currencyWrapper(currency)(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
        minimumFractionDigits: 4, maximumFractionDigits: 4,
      })}` : money(value);
  const editValue = (edit: SnapshotEdit, before: boolean): number | null => {
    const raw = before ? edit.old_value : edit.new_value;
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const assetEditValue = (edit: SnapshotEdit, before: boolean, field: "value" | "price"): number | null => {
    const raw = before ? edit.old_value : edit.new_value;
    if (raw === null) return null;
    const match = raw.match(field === "value"
      ? /"value"\s*:\s*(-?[\d.eE+-]+)(?=[,}\s])/ : /"price"\s*:\s*(-?[\d.eE+-]+)(?=[,}\s])/);
    const parsed = Number(match?.[1]);
    return match && Number.isFinite(parsed) ? parsed : null;
  };
  const latest = rows[0];
  const selected = rows.find((row) => row.id === selectedId);
  const rowIndex = rows.findIndex((row) => row.id === selectedId);
  const previous = rowIndex >= 0 ? rows[rowIndex + 1] : undefined;
  const previousForChange = filter === "all" ? previous : undefined;
  const previousTotal = previousForChange?.total ?? (selected?.change === null || !selected ? 0 : selected.total - selected.change);
  const assets = detail?.assets.slice().sort((a, b) => b.value - a.value) ?? [];
  const visibleAssets = assets.slice(detailPage * PAGE_SIZE, (detailPage + 1) * PAGE_SIZE);
  const editDelta = (edits ?? []).reduce((sum, edit) => {
    if (edit.target !== "asset" || (edit.action !== "delete" && edit.action !== "restore")) return sum;
    const value = assetEditValue(edit, edit.action === "delete", "value");
    return value === null ? sum : sum + (edit.action === "delete" ? -value : value);
  }, 0);
  const editDeltaTone = directionPhysicalTone(editDelta, quoteColor);
  const [editSummaryBeforeAmount, editSummaryAfterAmount = ""] = t("history.fidelity.editDelta")
    .replace("{count}", String(edits?.length ?? 0)).split("{amount}");
  const sources = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const asset of sourceAssets) {
      const name = asset.wallet ?? t("history.fidelity.unknownSource");
      grouped.set(name, (grouped.get(name) ?? 0) + asset.value);
    }
    return [...grouped].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [sourceAssets, t]);
  const sourceLabels = useMemo(() => sourceDisplayNames(sources.map(([id]) => ({ id, ...sourceIdentities[id] })),
    (index) => t("wallets.fallbackName").replace("{number}", String(index)), walletOrdinals), [sources, sourceIdentities, t, walletOrdinals]);
  const valueTotal = detail?.total ?? selected?.total ?? 0;
  useLayoutEffect(() => {
    const strip = kpiRef.current;
    if (!strip) return;
    let active = true;
    let frame = 0;
    const check = () => {
      if (!active || !strip.clientWidth) return;
      for (const fit of ["roomy", "tight", "compact"] as const) {
        strip.dataset.fit = fit;
        const widths = [...strip.children].map((cell) => {
          const style = getComputedStyle(cell);
          const textWidth = Math.max(...[...cell.children].map((text) => {
            const range = document.createRange();
            range.selectNodeContents(text);
            return range.getBoundingClientRect().width;
          }));
          return textWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) +
            parseFloat(style.borderLeftWidth);
        });
        if (widths.reduce((sum, width) => sum + width, 0) <= strip.clientWidth + 1) {
          if (fit === "roomy" && Math.max(...widths) * 3 <= strip.clientWidth + 1)
            strip.dataset.fit = "spread";
          return;
        }
      }
      strip.dataset.fit = "stacked";
    };
    check();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    if (strip.parentElement) observer?.observe(strip.parentElement);
    document.fonts?.ready.then(check);
    return () => { active = false; cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [detail, selected, edits, currency, locale, sources.length]);
  const pages = Math.ceil(count / PAGE_SIZE);
  const issueCount = statusCounts.partial;
  const editedCount = statusCounts.edited;
  const noSnapshots = !loading && count === 0 && range === "all" && !from && !to && filter === "all";
  const rangeOptions = ["7", "30", "90", "all"] as const;
  const switchRange = (next: typeof range) => { setRange(next); setFrom(""); setTo(""); setPage(0); };

  function compare() {
    if (!selected || !previous) return;
    setCurrentComparisonDates(previous.createdAt, selected.createdAt);
    navigate("/comparison");
  }
  function removeSelectedSnapshot() {
    if (!selected || isDeleting) return;
    const removed = selected;
    const index = rows.findIndex((row) => row.id === removed.id);
    const next = rows[index - 1] ?? rows[index + 1];
    setDeleteOpen(false);
    setSelectedId(next?.id ?? null);
    void runDelete({
      update: (items) => items.filter((row) => row.id !== removed.id),
      rollback: (items) => items.some((row) => row.id === removed.id) ? items
        : [...items.slice(0, index), removed, ...items.slice(index)],
      commit: async () => {
        const restore = await queryRestoreHistoricalData(removed.id);
        await removeHistoricalSnapshot(removed.id);
        return restore;
      },
      undo: restoreHistoricalData,
      onDeleted: () => {
        setCount((value) => value - 1);
        skipReloadVersion.current = latestVersion.current + 1;
        afterDataChanged?.("delete", removed.id);
      },
      onUndone: () => {
        setCount((value) => value + 1);
        setSelectedId(removed.id);
        skipReloadVersion.current = latestVersion.current + 1;
        afterDataChanged?.("undoDeletion", removed.id);
      },
      successMessage: t("history.fidelity.deleted"),
      successDetail: dateLong(removed.createdAt),
      undoLabel: t("common.undo"),
      undoAltText: t("history.undoDelete"),
      undoWindowMs: 5000,
      syncSnapshotUuid: removed.id,
    });
  }
  async function removeSelectedAsset(blacklist = false) {
    const owner = detail;
    const removed = owner?.assets.find((asset) => asset.id === deleteAssetId);
    if (!owner || !removed || isDeletingAsset) return;
    if (blacklist) {
      try {
        await addToBlacklist(removed.symbol);
      } catch {
        toast({ description: t("history.fidelity.blacklistFailed"), variant: "destructive" });
        return;
      }
    }
    setDeleteAssetId(null);
    void runAssetDelete({
      update: (current) => current?.id === owner.id
        ? { ...current, assets: current.assets.filter((asset) => asset.id !== removed.id),
          total: current.total - removed.value } : current,
      rollback: (current) => current?.id === owner.id ? owner : current,
      commit: async () => {
        const backup = await queryRestoreHistoricalData(removed.id);
        await removeHistoricalAsset(removed.id);
        return { backup, next: await queryHistoricalDetail(owner.id) };
      },
      undo: ({ backup }) => restoreHistoricalData(backup),
      onDeleted: ({ next }) => {
        setDetail(next);
        setRows((current) => current.map((row) => row.id === owner.id
          ? { ...row, total: next.total, assetCount: next.assets.length, edited: true } : row));
        afterDataChanged?.("delete", undefined, removed.id);
      },
      onUndone: () => {
        setSelectedId(owner.id);
        setDetail(owner);
        setRows((current) => current.map((row) => row.id === owner.id
          ? { ...row, total: owner.total, assetCount: owner.assets.length, edited: true } : row));
        afterDataChanged?.("undoDeletion", undefined, removed.id);
      },
      successMessage: t("history.fidelity.assetDeleted"),
      undoLabel: t("common.undo"),
      undoAltText: t("history.undoDelete"),
      undoWindowMs: 5000,
    });
  }
  const [subtitleBeforeCount, subtitleAfterCount = ""] = t("history.fidelity.subtitle").split("{count}");
  const richHint = (key: string) => {
    const [before, after] = t(key).split("{setting}");
    return <>{before}<strong>{t("history.fidelity.historyCount")}</strong>{after}</>;
  };

  return <div className="fidelity-history" aria-busy={loading} data-testid="history-content">
    <header className="fidelity-page-head"><div><h1>{t("history.fidelity.title")}</h1>
      <p>{listError ? t("history.fidelity.listLoadFailed") : count ? <>{subtitleBeforeCount}<strong>{count.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</strong>{
        subtitleAfterCount.replace("{latest}", latest ? dateLatest(latest.createdAt) : "–")}</>
        : loading ? t("common.loading") : t(noSnapshots ? "history.fidelity.emptySubtitle" : "history.fidelity.noResults")}</p></div>
      <div className="fidelity-head-actions"><SyncStatusIndicator recordsStamp /></div>
    </header>
    <section className={`fidelity-card fidelity-history-filters${noSnapshots ? " fidelity-history-filters-empty" : ""}`}>
      <div className="fidelity-filter-group"><span>{t("history.fidelity.range")}</span>
        <div className="fidelity-segment" role="group" aria-label={t("history.fidelity.range")}>{rangeOptions.map((option) =>
          <button type="button" key={option} aria-pressed={range === option && !from && !to}
            onClick={() => switchRange(option)} disabled={noSnapshots}>{t(`history.fidelity.range.${option}`)}</button>)}</div></div>
      <div className="fidelity-filter-group">
        <FidelityDateInput label={t("history.fidelity.from")} placeholder={t("history.fidelity.from")}
          value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} disabled={noSnapshots} />
        <span>{t("cost.fidelity.to")}</span>
        <FidelityDateInput label={t("history.fidelity.to")} placeholder={t("history.fidelity.to")}
          value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} disabled={noSnapshots} />
      </div>
      <div className="fidelity-filter-group fidelity-history-show"><span>{t("history.fidelity.show")}</span>
        <div className="fidelity-segment" role="group" aria-label={t("history.fidelity.show")}>
          {(["all", "partial", "edited"] as const).map((value) => <button type="button" key={value}
            aria-pressed={filter === value} disabled={noSnapshots}
            onClick={() => { setFilter(value); setPage(0); }}>
            {t(noSnapshots && value !== "all"
              ? `history.fidelity.filter.${value}Empty`
              : `history.fidelity.filter.${value}`).replace("{count}", String(value === "partial" ? issueCount : editedCount))}</button>)}
        </div>
      </div>
    </section>
    {listError ? <section className="fidelity-card fidelity-history-empty"><h2>{t("history.fidelity.snapshots")}</h2>
      <p role="alert">{t("history.fidelity.listLoadFailed")}</p>
      <button type="button" onClick={() => setReload((value) => value + 1)}>{t("history.fidelity.retry")}</button>
    </section> : !loading && count === 0 ? <section className="fidelity-card fidelity-history-empty">
      <h2>{t("history.fidelity.snapshots")}</h2>
      <EmptyState icon={ClockIcon} className="fidelity-empty"
        title={t(noSnapshots ? "history.fidelity.noSnapshots" : "history.fidelity.noResults")}
        hint={t(noSnapshots ? "history.fidelity.noSnapshotsHint" : "history.empty.filter.hint")}
        action={noSnapshots && <button type="button" onClick={() => {
            window.dispatchEvent(new Event("records-controls-open"));
            document.querySelector<HTMLButtonElement>(".t3-refresh-button")?.click();
          }}>
            <ReloadIcon aria-hidden="true" />{t("history.fidelity.refreshNow")}</button>} />
      {noSnapshots && <p><InfoCircledIcon aria-hidden="true" /><span>{richHint("history.fidelity.localHintRich")}</span></p>}
    </section> : <div className="fidelity-history-grid">
      <section className="fidelity-card fidelity-history-list">
        <div className="fidelity-card-head"><h2>{t("history.fidelity.snapshots")}</h2>
          <span>{loading ? t("history.fidelity.loading") : t("history.fidelity.newestFirst")}</span></div>
        <div className="fidelity-history-list-scroll"><table><thead><tr>
          {["dateTime", "totalValue", "changePrevious", "assets", "sources"].map((key) =>
            <th key={key}>{t(`history.fidelity.${key}`)}</th>)}
        </tr></thead><tbody>{loading ? Array.from({ length: 14 }, (_, index) => <tr key={index}>
          {[120, 90, 130, 20, 60].map((width, cell) => <td key={cell}><span className="fidelity-skeleton" style={{ width }} /></td>)}
        </tr>) : rows.map((row) => {
          const percent = row.change === null ? null : row.total - row.change === 0 ? null : row.change / (row.total - row.change) * 100;
          const sourceText = row.sourcesTotal === undefined ? t("history.fidelity.allRefreshed")
            : `${row.sourcesTotal - (row.missingCount ?? 0)} ${t("history.fidelity.of")} ${row.sourcesTotal}`;
          return <tr key={row.id} data-testid="history-snapshot-row" className={row.id === selectedId ? "selected" : ""}
            onClick={() => setSelectedId(row.id)}>
            <td><button type="button" onClick={() => setSelectedId(row.id)}
              aria-label={`${dateShort(row.createdAt)} · ${t("history.viewSnapshot").replace("{date}", dateLong(row.createdAt))}`}>
              {dateDay(row.createdAt)} <span className="fidelity-history-row-time">{dateTime(row.createdAt)}</span>
              {row.edited && <span className="t3-tag" data-tone="accent">{t("history.editLog.edited")}</span>}
            </button></td>
            <td>{money(row.total)}</td>
            <td style={{ color: row.change === null ? undefined : color(row.change) }}>
              {row.change === null ? "–" : <><span className="fidelity-change-abs">{signed(row.change)}</span>
                <span className="fidelity-change-percent">{percent === null ? "–" : `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`}</span></>}
            </td>
            <td>{row.assetCount}</td>
            <td><i className={row.sourcesTotal !== undefined ? "warn" : ""} />
              {sourceText}</td>
          </tr>;
        })}</tbody></table></div>
        {loading ? <div className="fidelity-history-pager fidelity-history-pager-loading">
          <span className="fidelity-skeleton" style={{ width: 90, height: 12 }} />
        </div> : <>
        <div className="fidelity-history-pager">
          <span>{t("history.fidelity.pagerCount").replace("{start}", String(page * PAGE_SIZE + (count ? 1 : 0)))
            .replace("{end}", String(Math.min((page + 1) * PAGE_SIZE, count)))
            .replace("{count}", count.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))}</span>
          <div><span>{t("history.fidelity.pageOf").replace("{page}", String(page + 1)).replace("{pages}", String(pages))}</span>
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("cost.fidelity.previous")}</button>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t("common.next")}</button></div>
        </div>
        <p className="fidelity-history-hint"><InfoCircledIcon aria-hidden="true" /><span>{richHint("history.fidelity.pageHintRich")}</span></p></>}
      </section>
      {loading || detailLoading ? <section className="fidelity-card fidelity-history-detail" data-testid="history-desktop-loading">
        <span className="fidelity-skeleton" style={{ width: 210, height: 22 }} />
        <div className="fidelity-history-detail-skeleton-kpis">{[0, 1, 2].map((index) => <div key={index}>
          <span className="fidelity-skeleton" style={{ width: 60, height: 12 }} />
          <span className="fidelity-skeleton" style={{ width: 110, height: 22 }} />
          <span className="fidelity-skeleton" style={{ width: 80, height: 12 }} /></div>)}</div>
        <div className="fidelity-history-skeleton-buttons"><span className="fidelity-skeleton" /><span className="fidelity-skeleton" /></div>
        {Array.from({ length: 9 }, (_, index) => <div className="fidelity-history-skeleton-row" key={index}>
          {[55, 85, 90, 55].map((width, cell) => <span key={cell} className="fidelity-skeleton" style={{ width }} />)}
        </div>)}
      </section> : <section className="fidelity-card fidelity-history-detail" data-testid="history-desktop-detail">
        {selected && detail && <>
          <h2>{dateLong(selected.createdAt)} {selected.edited && <span className="t3-tag" data-tone="accent">{t("history.editLog.edited")}</span>}</h2>
          <div ref={kpiRef} className="fidelity-history-detail-kpis">
            <div><span>{t("history.fidelity.totalValue")}</span><strong>{money(valueTotal)}</strong>
              <small>{edits?.length ? t("history.fidelity.includesEdits").replace("{count}", String(edits.length)) : t("history.fidelity.asOfRefresh")}</small></div>
            <div><span>{t("history.fidelity.change")}</span><strong style={{ color: selected.change === null ? undefined : color(selected.change) }}>
              {selected.change === null ? "–" : signed(selected.change)}</strong><small>
              {selected.change === null ? t("history.fidelity.noEarlier") :
                previousTotal === 0 ? "–" :
                <><span style={{ color: color(selected.change) }}>{`${selected.change > 0 ? "+" : selected.change < 0 ? "−" : ""}${
                  Math.abs(selected.change / previousTotal * 100).toFixed(2)}%`}</span> {
                  previousForChange ? <>{t("history.fidelity.vs")} {dateFormat(previousForChange.createdAt, "d MMM")}</>
                    : t("history.fidelity.vsEarlier")}</>}
            </small></div>
            <div><span>{t("history.fidelity.assets")}</span><strong>{assets.length}</strong>
              <small>{selected.sourcesTotal === undefined ? t("history.fidelity.sourceCountDetail").replaceAll("{count}", String(sources.length)) :
                `${selected.sourcesTotal - (selected.missingCount ?? 0)} ${t("history.fidelity.of")} ${selected.sourcesTotal} ${t("history.fidelity.sourcesLower")}`}</small></div>
          </div>
          <div className="fidelity-history-actions">
            <button type="button" onClick={compare} disabled={!previous}><span aria-hidden="true">⇅</span>{t("history.fidelity.compare")}</button>
            <button type="button" onClick={() => setEditOpen(true)}><Pencil1Icon aria-hidden="true" />{t("history.fidelity.edit")}</button>
            <button type="button" onClick={() => setDeleteOpen(true)} disabled={isDeleting}><TrashIcon aria-hidden="true" />{t("common.delete")}</button>
          </div>
          <div className="fidelity-card-head"><h3>{t("history.fidelity.assetsAtTime")}</h3><span>{t("history.assetCount").replace("{n}", String(assets.length))}</span></div>
          <table><thead><tr>{["asset", "quantity", "price", "value", "share"].map((key) =>
            <th key={key}>{t(`history.fidelity.${key}`)}</th>)}</tr></thead><tbody>
            {visibleAssets.map((asset) => {
              const editedPrice = (edits ?? []).find((edit) => edit.symbol === asset.symbol &&
                edit.asset_type === asset.assetType && edit.target === "asset" && edit.action === "price");
              const restoredAsset = (edits ?? []).find((edit) => edit.symbol === asset.symbol &&
                edit.asset_type === asset.assetType && edit.target === "asset" && edit.action === "restore");
              return <tr key={`${asset.assetType}:${asset.symbol}`}><td><AssetLabel asset={asset} size={20} quiet tag="" />
                <button type="button" className="t3-icon-button" aria-label={t("history.fidelity.deleteAsset").replace("{asset}", asset.symbol)}
                  disabled={isDeletingAsset} onClick={() => setDeleteAssetId(asset.id)}><TrashIcon aria-hidden="true" /></button></td>
              <td>{restoredAsset ? <><span className="fidelity-edited-value">{quantity(asset.assetType === "crypto" &&
                stablecoins.has(asset.symbol.toUpperCase()) ? "stablecoin" : asset.assetType, asset.amount)}</span>
                <small>{t("history.fidelity.was")} –</small></> :
                quantity(asset.assetType === "crypto" && stablecoins.has(asset.symbol.toUpperCase()) ? "stablecoin" : asset.assetType, asset.amount)}</td>
              <td>{editedPrice ? <><span className="fidelity-edited-value">{price(asset, asset.price)}</span>
                <small>{t("history.fidelity.was")} {assetEditValue(editedPrice, true, "price") === null ? "–" : price(asset, assetEditValue(editedPrice, true, "price")!)}</small></>
                : price(asset, asset.price)}</td><td>{money(asset.value)}</td>
              <td>{valueTotal ? `${(asset.value / valueTotal * 100).toFixed(1)}%` : "–"}</td></tr>;
            })}
            <tr className="fidelity-history-total"><td>{t("cost.fidelity.total")}</td><td /><td />
              <td>{money(valueTotal)}</td><td>{valueTotal ? "100.0%" : "–"}</td></tr>
          </tbody></table>
          {assets.length > PAGE_SIZE && <div className="fidelity-history-pager fidelity-detail-pager">
            <span>{t("history.fidelity.showingAssets")
              .replace("{start}", String(detailPage * PAGE_SIZE + 1))
              .replace("{end}", String(Math.min((detailPage + 1) * PAGE_SIZE, assets.length)))
              .replace("{total}", String(assets.length))}</span>
            <div><button type="button" disabled={detailPage === 0}
              onClick={() => setDetailPage(detailPage - 1)}>{t("cost.fidelity.previous")}</button>
              <button type="button" disabled={(detailPage + 1) * PAGE_SIZE >= assets.length}
                onClick={() => setDetailPage(detailPage + 1)}>{t("common.next")}</button></div>
          </div>}
          {detail.partial && <div className="fidelity-history-section">
            <HistoryPartialDetails partial={detail.partial} t={t} locale={locale} /></div>}
          {(editLogError || edits === null || edits.length > 0) && <section className="fidelity-history-section fidelity-history-edit-log" aria-label={t("history.fidelity.edits")}>
            <div className="fidelity-card-head"><h3>{t("history.fidelity.edits")}</h3>
              {!!edits?.length && <span>{editSummaryBeforeAmount}<span className={
                editDeltaTone === "gain" ? "pos" : editDeltaTone === "loss" ? "neg" : "zero"}>
                {signed(Math.round(editDelta * 100) / 100)}</span>{editSummaryAfterAmount}</span>}</div>
            {editLogError ? <p role="alert">{t("history.editLog.loadFailed")}</p>
              : edits === null ? <p role="status">{t("common.loading")}</p>
                : edits.length === 0 ? <p>{t("history.editLog.empty")}</p>
                  : <ol>{edits.map((edit) => {
                    const before = editValue(edit, true);
                    const after = editValue(edit, false);
                    return <li key={edit.id} className="fidelity-history-section-row">
                      <div><span>{edit.target === "transaction" && edit.action === "price"
                        ? t("history.fidelity.transactionPriceEdit").replace("{asset}", edit.symbol ?? "")
                        : `${t(`history.editLog.${edit.target}.${edit.action}`)} ${edit.symbol ?? ""}`}</span>
                        <small>{t("history.fidelity.editedAt").replace("{date}", dateLong(edit.edited_at))}</small></div>
                      {edit.action === "price" && before !== null && after !== null &&
                        <span>{money(before)} → {money(after)}</span>}
                      {edit.target === "asset" && (edit.action === "delete" || edit.action === "restore") &&
                        <span>{edit.action === "delete" && assetEditValue(edit, true, "value") !== null
                          ? money(assetEditValue(edit, true, "value")!) : "–"} → {
                            edit.action === "restore" && assetEditValue(edit, false, "value") !== null
                              ? money(assetEditValue(edit, false, "value")!) : "–"}</span>}
                    </li>;
                  })}</ol>}
          </section>}
          <div className="fidelity-history-section"><div className="fidelity-card-head"><h3>{t("history.fidelity.sources")}</h3>
            <span>{t("history.fidelity.sourceDetail").replace("{count}", String(sources.length))}</span></div>
            {sources.map(([wallet, value], index) => <div className="fidelity-history-section-row fidelity-history-source-row" key={wallet}>
              <span title={wallet}><i />{sourceLabels[index]}</span>
              <span>{money(value)}</span>
            </div>)}</div>
        </>}
        {detailError && <p role="alert">{t("history.detailLoadFailed")}</p>}
      </section>}
    </div>}
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent className="fidelity-history-delete-dialog">
      <AlertDialogHeader><AlertDialogTitle>{t("history.fidelity.deleteTitle")}</AlertDialogTitle>
        <AlertDialogDescription className="fidelity-history-delete-summary">{selected && `${dateLong(selected.createdAt)} · ${money(selected.total)} · ${selected.assetCount} ${t("history.fidelity.assetsLower")}`}</AlertDialogDescription>
      </AlertDialogHeader>
      <p>{t("history.fidelity.deleteDescription")}</p>
      <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={removeSelectedSnapshot}><TrashIcon aria-hidden="true" />{t("history.fidelity.deleteSnapshot")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <AlertDialog open={deleteAssetId !== null} onOpenChange={(open) => { if (!open) setDeleteAssetId(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("history.fidelity.deleteAssetTitle")}</AlertDialogTitle>
        <AlertDialogDescription>{t("history.fidelity.deleteAssetDescription")}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
        <AlertDialogAction onClick={() => void removeSelectedAsset(true)}>{t("history.deleteBlacklist")}</AlertDialogAction>
        <AlertDialogAction onClick={() => void removeSelectedAsset()}>{t("history.fidelity.deleteAssetAction")}</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={editOpen} onOpenChange={setEditOpen}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("history.fidelity.edit")}</AlertDialogTitle>
        <AlertDialogDescription>{t("history.fidelity.editHint")}</AlertDialogDescription></AlertDialogHeader>
      <div className="fidelity-history-edit-links">{assets.map((asset) => <button type="button" key={asset.symbol}
        onClick={() => navigate(`/coins/${asset.symbol}?assetType=${asset.assetType}`)}>{asset.symbol}</button>)}</div>
      <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
