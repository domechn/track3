import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import {
  deleteHistoricalDataByUUID,
  deleteHistoricalDataDetailById,
  queryHistoricalDetail,
  queryHistoricalPage,
  queryEditLog,
  queryRestoreHistoricalData,
  restoreHistoricalData,
} from "@/middlelayers/charts";
import type { HistoricalLatest, HistoricalPageRow, SnapshotEdit } from "@/middlelayers/charts-history";
import { displayEditValue } from "@/middlelayers/charts-history";
import { addToBlacklist, getConfiguration } from "@/middlelayers/configuration";
import {
  CurrencyRateDetail,
  HistoricalData,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import type { AssetType } from "@/middlelayers/datafetch/types";
import DeleteIcon from "@/assets/icons/delete-icon.png";

import { timeToDateStr } from "@/utils/date";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { downloadCoinLogos } from "@/middlelayers/data";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import ImageStack from "@/components/common/image-stack";
import AssetLabel from "@/components/common/asset-label";
import { getImageApiPath } from "@/utils/app";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/mobile/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveAssetLogoSrc } from "@/utils/assets";
import { positiveNegativeColor, positiveNegativeTone } from "@/utils/color";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { useOptimisticDelete } from "@/mobile/components/common/use-optimistic-delete";
import { StaggerContainer, FadeUp } from "@/components/motion";
import PageLoadingOverlay from "@/mobile/components/page-loading-overlay";
import { useTranslation } from "@/mobile/i18n";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomSheet, SplitView, SwipeableRow, useIsMobile, useSizeClass } from "@/mobile/components/mobile";
import { groupHistoryMonths } from "@/mobile/components/history-months";
import HistoryEditLog from "@/components/history-edit-log";
import { HistoryPartialDetails, HistoryPartialPill } from "@/components/history-partial";
import { hasActiveSource } from "@/mobile/components/common/active-source";

function DesktopDetailPassthrough({ children }: React.ComponentProps<typeof BottomSheet>) {
  return <>{children}</>;
}

type RankData = {
  id: number;
  assetId: number;
  rank: number;
  symbol: string;
  assetType?: AssetType;
  value: number;
  amount: number;
  price: number;
};

const DETAIL_PAGE_SIZE = 100;

function HistoryPhoneIcon({ kind }: { kind: "clock" | "filter" | "chevron" | "info" | "trash" | "edit" | "compare" | "refresh" }) {
  const paths = {
    clock: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5v4l2.5 1.5" /></>,
    filter: <path d="M2.5 4h13l-5 6v4.5l-3-1.5V10z" />,
    chevron: <path d="m4 7 5 5 5-5" />,
    info: <><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></>,
    trash: <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5" />,
    edit: <path d="m3 15 .8-3.5L12.5 3l2.5 2.5-8.7 8.7z" />,
    compare: <path d="M6 3v12M12 3v12M3 6l3-3 3 3M9 12l3 3 3-3" />,
    refresh: <><path d="M14.5 8a5.5 5.5 0 1 0 .2 2" /><path d="M14.5 3.5V8H10" /></>,
  };
  return <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

const App = ({
  afterDataChanged,
  dateRange,
  currency,
  quoteColor,
}: {
  afterDataChanged?: (
    action: "delete" | "undoDeletion",
    uuid?: string,
    id?: number,
  ) => unknown;
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { t, locale } = useTranslation();
  const snapshotDateFormatter = useMemo(() => new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  ), [locale]);
  const isMobile = useIsMobile();
  const widthClass = useSizeClass().width;
  const isWide = widthClass === "wide";
  const isPhone = isMobile && widthClass === "compact";

  const [data, setData] = useState<HistoricalPageRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [latestRow, setLatestRow] = useState<HistoricalLatest | null>(null);
  const [selectedData, setSelectedData] = useState<HistoricalData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);
  const [phoneOpenedRow, setPhoneOpenedRow] = useState<HistoricalPageRow | null>(null);
  const [editLog, setEditLog] = useState<SnapshotEdit[] | null>(null);
  const [editLogError, setEditLogError] = useState(false);
  const [phonePreviousDate, setPhonePreviousDate] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "edited" | "complete" | "partial">("all");
  const [phoneFilterOpen, setPhoneFilterOpen] = useState(false);
  const [phoneRange, setPhoneRange] = useState<"all" | "7" | "30" | "90">("all");
  const [pendingPhoneRange, setPendingPhoneRange] = useState<"all" | "7" | "30" | "90">("all");
  const [pendingPhoneStatus, setPendingPhoneStatus] = useState<"all" | "edited" | "complete" | "partial">("all");
  const [phoneFrom, setPhoneFrom] = useState("");
  const [phoneTo, setPhoneTo] = useState("");
  const [pendingPhoneFrom, setPendingPhoneFrom] = useState("");
  const [pendingPhoneTo, setPendingPhoneTo] = useState("");
  const [phoneCounts, setPhoneCounts] = useState<{ all: number; partial: number; edited: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLimit, setDetailLimit] = useState(DETAIL_PAGE_SIZE);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailScrollTop, setDetailScrollTop] = useState(0);
  const [measuredDetailHeights, setMeasuredDetailHeights] = useState<Map<number, number>>(() => new Map());
  const [pageLoading, setPageLoading] = useState(true);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [deleteAssetCandidate, setDeleteAssetCandidate] = useState<{ id: number; symbol: string } | null>(null);
  const phoneBackRef = useRef<HTMLButtonElement>(null);
  const phoneOpenerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isPhone) return;
    if (isModalOpen) phoneBackRef.current?.focus();
    else if (phoneOpenerRef.current?.isConnected) phoneOpenerRef.current.focus();
  }, [isPhone, isModalOpen]);

  const { run: runDelete, isDeleting: deleting } = useOptimisticDelete(setData);
  const { run: runDetailDelete, isDeleting: deletingDetail } = useOptimisticDelete(setSelectedData);

  const [dataPage, setDataPage] = useState(0);
  const dataPageRef = useRef(dataPage);
  dataPageRef.current = dataPage;
  const [pageInput, setPageInput] = useState("1");
  const [pageSize, setPageSize] = useState(isPhone ? 50 : 20);
  useEffect(() => {
    setPageSize(isPhone ? 50 : 20);
    setDataPage(0);
  }, [isPhone]);

  const loadGenRef = useRef(0);
  const detailRegionRef = useRef<HTMLDivElement>(null);
  // Set right before calling `afterDataChanged` from a local mutation
  // (delete/undo) so the next dataChangedVersion bump skips the loading
  // overlay. Keep the current list visible while `loadPage` refreshes it.
  const skipNextLoadingRef = useRef(false);
  const localMutationRef = useRef(false);
  const queryRange = useMemo(() => {
    if (!isPhone) return dateRange;
    if (phoneRange === "all" && !phoneFrom && !phoneTo) return dateRange;
    const end = new Date(Math.min(dateRange.end.getTime(),
      phoneTo ? new Date(`${phoneTo}T23:59:59.999`).getTime() : dateRange.end.getTime()));
    const days = phoneRange === "all" ? null : Number(phoneRange);
    const daysStart = new Date(end);
    if (days) daysStart.setDate(daysStart.getDate() - days);
    const start = new Date(Math.max(dateRange.start.getTime(), phoneFrom
      ? new Date(`${phoneFrom}T00:00:00.000`).getTime() : days ? daysStart.getTime() : dateRange.start.getTime()));
    return { start, end };
  }, [isPhone, dateRange.start, dateRange.end, phoneRange, phoneFrom, phoneTo]);
  const rangeKey = `${queryRange.start.getTime()}-${queryRange.end.getTime()}`;
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    if (!isPhone || !phoneFilterOpen) return;
    let active = true;
    setPhoneCounts(null);
    const end = new Date(Math.min(dateRange.end.getTime(), pendingPhoneTo
      ? new Date(`${pendingPhoneTo}T23:59:59.999`).getTime() : dateRange.end.getTime()));
    const days = pendingPhoneRange === "all" ? null : Number(pendingPhoneRange);
    const daysStart = new Date(end);
    if (days) daysStart.setDate(daysStart.getDate() - days);
    const start = new Date(Math.max(dateRange.start.getTime(), pendingPhoneFrom
      ? new Date(`${pendingPhoneFrom}T00:00:00.000`).getTime() : days ? daysStart.getTime() : dateRange.start.getTime()));
    Promise.all((["all", "partial", "edited"] as const)
      .map((filter) => queryHistoricalPage({ start, end }, 1, 0, filter)))
      .then(([all, partial, edited]) => {
        if (active) setPhoneCounts({ all: all.totalCount, partial: partial.totalCount, edited: edited.totalCount });
      })
      .catch(() => { if (active) setPhoneCounts(null); });
    return () => { active = false; };
  }, [isPhone, phoneFilterOpen, pendingPhoneRange, pendingPhoneFrom, pendingPhoneTo,
    dateRange.start, dateRange.end, dataChangedVersion]);

  useEffect(() => {
    if (skipNextLoadingRef.current) {
      skipNextLoadingRef.current = false;
      return;
    }
    setPageLoading(true);
  }, [rangeKey, dataChangedVersion, dataPage, pageSize, historyFilter]);

  const symbolPricePairs = useMemo(() => {
    const latestBySymbol = new Map<string, number>();
    for (const item of data) {
      for (const asset of item.topAssets) {
        if (!latestBySymbol.has(asset.symbol)) {
          latestBySymbol.set(asset.symbol, asset.price);
        }
      }
    }
    for (const asset of selectedData?.assets ?? []) {
      if (!latestBySymbol.has(asset.symbol)) latestBySymbol.set(asset.symbol, asset.price);
    }

    return Array.from(latestBySymbol.entries()).map(([symbol, price]) => ({
      symbol,
      price,
    }));
  }, [data, selectedData]);

  const uniqueSymbols = useMemo(() => {
    return symbolPricePairs.map((item) => item.symbol);
  }, [symbolPricePairs]);

  useEffect(() => {
    if (!symbolPricePairs.length) {
      return;
    }

    downloadCoinLogos(symbolPricePairs);
  }, [symbolPricePairs]);

  useEffect(() => {
    async function loadMissingLogos() {
      if (!uniqueSymbols.length) {
        return;
      }

      const missing = uniqueSymbols.filter((symbol) => !logoMap[symbol]);
      if (!missing.length) {
        return;
      }

      const acd = await getAppCacheDir();
      const kvs = await Promise.all(
        missing.map(async (symbol) => ({
          symbol,
          path: await getImageApiPath(acd, symbol),
        })),
      );

      setLogoMap((prev) => {
        const next = { ...prev };
        kvs.forEach(({ symbol, path }) => {
          next[symbol] = path;
        });
        return next;
      });
    }

    loadMissingLogos();
  }, [uniqueSymbols, logoMap]);

  const loadPage = useCallback(async () => {
    const currentGen = ++loadGenRef.current;

    try {
      const result = await queryHistoricalPage(queryRange, pageSize, dataPage, historyFilter);
      if (currentGen !== loadGenRef.current) {
        return;
      }
      if (localMutationRef.current) {
        if (dataPage > Math.max(Math.ceil(result.totalCount / pageSize) - 1, 0)) {
          skipNextLoadingRef.current = true;
        }
      }
      setData(result.rows);
      setTotalCount(result.totalCount);
      setLatestRow(result.latest);
    } finally {
      if (currentGen === loadGenRef.current) {
        localMutationRef.current = false;
        setPageLoading(false);
      }
    }
  }, [rangeKey, queryRange, dataChangedVersion, dataPage, pageSize, historyFilter, isPhone]);

  useEffect(() => {
    if (isPhone) setDataPage(0);
  }, [dataChangedVersion, isPhone]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!isModalOpen || !selectedDataId) return;
    let active = true;
    setDetailLoading(selectedData?.id !== selectedDataId);
    setDetailError(false);
    void queryHistoricalDetail(selectedDataId).then((detail) => {
      if (active) {
        if (detail.assets.length === 0) {
          setIsModalOpen(false);
          setSelectedDataId(null);
        }
        setSelectedData(detail);
        setDetailLoading(false);
      }
    }).catch(() => {
      if (active) {
        setSelectedData(null);
        setDetailError(true);
        setDetailLoading(false);
      }
    });
    return () => { active = false; };
  }, [isModalOpen, selectedDataId, dataChangedVersion]);

  useEffect(() => {
    if (!isModalOpen || !selectedDataId) return;
    let active = true;
    setEditLog(null);
    setEditLogError(false);
    void queryEditLog(selectedDataId).then((rows) => {
      if (active) setEditLog(rows);
    }).catch(() => {
      if (active) setEditLogError(true);
    });
    return () => { active = false; };
  }, [isModalOpen, selectedDataId, dataChangedVersion]);

  useEffect(() => {
    setDataPage(0);
    setSelectedDataId(null);
    setSelectedData(null);
    setIsModalOpen(false);
  }, [dateRange.start.getTime(), dateRange.end.getTime(), phoneRange, phoneFrom, phoneTo]);

  const maxDataPage = useMemo(() => {
    const pageCount = Math.ceil(totalCount / pageSize);
    return Math.max(pageCount - 1, 0);
  }, [totalCount, pageSize]);

  useEffect(() => {
    if (dataPage > maxDataPage) {
      if (localMutationRef.current) {
        skipNextLoadingRef.current = true;
      }
      setDataPage(maxDataPage);
    }
  }, [dataPage, maxDataPage]);
  useEffect(() => setPageInput(String(dataPage + 1)), [dataPage]);

  const applyPageInput = () => {
    const value = Number(pageInput);
    if (Number.isInteger(value) && value >= 1 && value <= totalPages) {
      setDataPage(value - 1);
    } else {
      setPageInput(String(dataPage + 1));
    }
  };

  const rankData = useMemo<RankData[]>(() => {
    if (!selectedData) {
      return [];
    }

    return selectedData.assets
      .filter((asset) => asset.value > 1)
      .sort((a, b) => b.value - a.value)
      .map((asset, idx) => ({
        id: idx,
        assetId: asset.id,
        rank: idx + 1,
        amount: asset.amount,
        symbol: asset.symbol,
        assetType: asset.assetType,
        value: asset.value,
        price: asset.price,
      }));
  }, [selectedData]);

  const visibleRankData = useMemo(() => {
    const keyword = detailSearch.trim().toUpperCase();
    const filtered = keyword
      ? rankData.filter((item) => item.symbol.toUpperCase().includes(keyword))
      : rankData;
    return filtered.slice(0, detailLimit);
  }, [rankData, detailLimit, detailSearch]);
  const detailOffsets = useMemo(() => {
    const offsets = [0];
    for (const item of visibleRankData) {
      offsets.push(offsets[offsets.length - 1] + (measuredDetailHeights.get(item.assetId) ?? 42));
    }
    return offsets;
  }, [visibleRankData, measuredDetailHeights]);
  const detailWindowSize = Math.max(16, Math.ceil((typeof window === "undefined" ? 700 : window.innerHeight * 0.7) / 42) + 8);
  const firstVisibleDetail = detailOffsets.findIndex((offset, index) =>
    index > 0 && offset > detailScrollTop,
  );
  const detailStart = Math.min(
    Math.max(0, (firstVisibleDetail < 0 ? visibleRankData.length : firstVisibleDetail - 1) - 4),
    Math.max(0, visibleRankData.length - detailWindowSize),
  );
  const virtualRankData = visibleRankData.slice(detailStart, detailStart + detailWindowSize);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const sizes = entries.map((entry) => ({
        id: Number((entry.target as HTMLElement).dataset.assetId),
        height: entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height,
      }));
      setMeasuredDetailHeights((previous) => {
        const next = new Map(previous);
        let changed = false;
        for (const { id, height } of sizes) {
          if (!Number.isFinite(id) || !height || next.get(id) === height) continue;
          next.set(id, height);
          changed = true;
        }
        return changed ? next : previous;
      });
    });
    detailRegionRef.current?.querySelectorAll("[data-asset-id]").forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [detailStart, virtualRankData.length, selectedDataId]);

  const filteredRankDataCount = useMemo(() => {
    const keyword = detailSearch.trim().toUpperCase();
    if (!keyword) {
      return rankData.length;
    }
    return rankData.filter((item) =>
      item.symbol.toUpperCase().includes(keyword),
    ).length;
  }, [rankData, detailSearch]);

  const onHistoricalDataDeleteClick = useCallback(
    (uuid: string) => {
      const deletedPage = dataPage;
      const index = data.findIndex((record) => record.id === uuid);
      const removed = data[index];
      if (!removed) return;
      const wasLatest = latestRow?.id === uuid;
      if (wasLatest) setLatestRow(data[index + 1] ?? null);
      void runDelete({
        update: (prev) => prev.filter((record) => record.id !== uuid),
        rollback: (prev) => {
          if (dataPageRef.current !== deletedPage) return prev;
          if (prev.some((record) => record.id === uuid)) return prev;
          const next = [...prev];
          next.splice(index, 0, removed);
          return next;
        },
        commit: async () => {
          try {
            const rhd = await queryRestoreHistoricalData(uuid);
            await deleteHistoricalDataByUUID(uuid);
            return rhd;
          } catch (error) {
            if (wasLatest) setLatestRow(removed);
            throw error;
          }
        },
        undo: restoreHistoricalData,
        onDeleted: () => {
          setTotalCount((count) => Math.max(0, count - 1));
          if (afterDataChanged) {
            skipNextLoadingRef.current = true;
            localMutationRef.current = true;
            afterDataChanged("delete", uuid, undefined);
          }
          setSelectedDataId(null);
          setIsModalOpen(false);
        },
        onUndone: () => {
          setLatestRow((prev) => !prev || removed.createdAt >= prev.createdAt ? removed : prev);
          setTotalCount((count) => count + 1);
          setIsModalOpen(false);
          if (afterDataChanged) {
            skipNextLoadingRef.current = true;
            localMutationRef.current = true;
            afterDataChanged("undoDeletion", uuid, undefined);
          }
        },
        successTitle: isPhone ? t("fidelity.history.deletedTitle") : undefined,
        toastClassName: isPhone ? "fidelity-history-delete-toast" : undefined,
        successMessage: isPhone
          ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
            day: "numeric", month: "short", year: "numeric",
          }).format(new Date(removed.createdAt)).replace("Sept", "Sep") + `, ${new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit", minute: "2-digit", hourCycle: "h23",
          }).format(new Date(removed.createdAt))}`
          : t("history.deleted"),
        undoLabel: t("common.undo"),
        undoAltText: t("history.undoDelete"),
        undoWindowMs: 5000,
        syncSnapshotUuid: uuid,
      });
    },
    [afterDataChanged, data, dataPage, latestRow, runDelete, t, isPhone, locale],
  );

  const onHistoricalDataDetailDeleteClick = useCallback(
    (id: number) => {
      const owner = selectedData;
      const index = owner?.assets.findIndex((asset) => asset.id === id) ?? -1;
      const removed = owner?.assets[index];
      if (!owner || !removed) return;
      const previousRowIndex = data.findIndex((row) => row.id === owner.id);
      const previousRow = data[previousRowIndex];
      const deletedPage = dataPage;
      let remainingAssets = owner.assets.filter((asset) => asset.id !== id);
      void runDetailDelete({
        update: (prev) => prev ? ({
          ...prev,
          assets: prev.assets.filter((asset) => asset.id !== id),
        }) : prev,
        rollback: (prev) => {
          if (!prev || prev.id !== owner.id || prev.assets.some((asset) => asset.id === id)) return prev;
          const assets = [...prev.assets];
          assets.splice(index, 0, removed);
          return { ...prev, assets };
        },
        commit: async () => {
          const backup = await queryRestoreHistoricalData(id);
          await deleteHistoricalDataDetailById(id);
          const detail = backup?.assets.length
            ? await queryHistoricalDetail(owner.id).catch(() => null)
            : null;
          return { backup, detail };
        },
        undo: ({ backup }) => restoreHistoricalData(backup),
        onDeleted: ({ detail }) => {
          if (detail) {
            remainingAssets = detail.assets;
            setSelectedData(detail);
          }
          const updatedTotal = remainingAssets.reduce((sum, asset) => sum + asset.value, 0);
          setData((previous) => {
            const position = previous.findIndex((row) => row.id === owner.id);
            if (position < 0) return previous;
            const next = remainingAssets.length
              ? previous.map((row, rowIndex) => rowIndex === position ? {
                  ...row,
                  total: updatedTotal,
                  assetCount: new Set(remainingAssets.map((asset) => `${asset.assetType}:${asset.symbol}`)).size,
                  topAssets: remainingAssets.filter((asset) => asset.value > 0)
                    .sort((left, right) => right.value - left.value).slice(0, 7),
                  change: previous[position + 1] ? updatedTotal - previous[position + 1].total : null,
                } : row)
              : previous.filter((row) => row.id !== owner.id);
            if (position > 0) {
              next[position - 1] = {
                ...next[position - 1],
                change: next[position] ? next[position - 1].total - next[position].total : null,
              };
            }
            return next;
          });
          if (latestRow?.id === owner.id) {
            setLatestRow(remainingAssets.length
              ? { ...latestRow, total: updatedTotal }
              : data[1] ?? null);
          }
          if (!remainingAssets.length) {
            setTotalCount((count) => Math.max(0, count - 1));
            setIsModalOpen(false);
            setSelectedDataId(null);
          }
          if (afterDataChanged) {
            skipNextLoadingRef.current = true;
            localMutationRef.current = true;
            afterDataChanged("delete", undefined, id);
          }
        },
        onUndone: () => {
          if (previousRow) {
            setData((previous) => {
              if (previous.some((row) => row.id === owner.id)) {
                return previous.map((row) => row.id === owner.id ? previousRow : row);
              }
              if (remainingAssets.length || dataPageRef.current !== deletedPage) return previous;
              const next = [...previous];
              next.splice(previousRowIndex, 0, previousRow);
              return next;
            });
            if (latestRow?.id === owner.id) setLatestRow(latestRow);
          }
          if (!remainingAssets.length) setTotalCount((count) => count + 1);
          setIsModalOpen(false);
          if (afterDataChanged) {
            skipNextLoadingRef.current = true;
            localMutationRef.current = true;
            afterDataChanged("undoDeletion", undefined, id);
          }
        },
        successMessage: t("history.deleted"),
        undoLabel: t("common.undo"),
        undoAltText: t("history.undoDeleteRecord"),
        undoWindowMs: 5000,
      });
    },
    [afterDataChanged, data, dataPage, latestRow, selectedData, runDetailDelete, t],
  );

  const onHistoricalDataDetailDeleteAndBlacklistClick = useCallback(
    (id: number, symbol: string) => {
      addToBlacklist(symbol).then(() => {
        onHistoricalDataDetailDeleteClick(id);
      });
    },
    [onHistoricalDataDetailDeleteClick],
  );

  const onRowClick = useCallback((id: string, opener?: HTMLElement) => {
    if (opener) phoneOpenerRef.current = opener;
    setPhoneOpenedRow(data.find((row) => row.id === id) ?? null);
    setSelectedData(null);
    setDetailLoading(true);
    setDetailError(false);
    setSelectedDataId(id);
    setPhonePreviousDate(null);
    setDetailLimit(DETAIL_PAGE_SIZE);
    setDetailSearch("");
    setDetailScrollTop(0);
    setMeasuredDetailHeights(new Map());
    setIsModalOpen(true);
  }, [data]);

  useEffect(() => {
    if (!isPhone || !selectedData?.createdAt) return;
    let active = true;
    const end = new Date(Date.parse(selectedData.createdAt) - 1);
    void queryHistoricalPage({ start: new Date(0), end }, 1, 0).then((page) => {
      if (active) setPhonePreviousDate(page.rows[0]?.createdAt ?? null);
    }).catch(() => { if (active) setPhonePreviousDate(null); });
    return () => { active = false; };
  }, [isPhone, selectedData?.createdAt]);

  const emptyState = !pageLoading && totalCount === 0;
  const loadedRangeStart = totalCount ? dataPage * pageSize + 1 : 0;
  const loadedRangeEnd = Math.min((dataPage + 1) * pageSize, totalCount);
  const totalPages = maxDataPage + 1;
  const DetailSurface = isMobile ? "div" : DialogContent;
  const DetailHeader = isMobile ? "div" : DialogHeader;
  const DetailWrapper = isMobile ? BottomSheet : DesktopDetailPassthrough;
  const closeDetail = (open: boolean) => {
    setIsModalOpen(open);
  };
  const refreshEmptyHistory = async () => {
    const config = await getConfiguration().catch(() => null);
    if (hasActiveSource(config)) window.dispatchEvent(new Event("track3:full-refresh"));
    else window.location.hash = "#/settings/configuration";
  };

  const phoneDate = (value: string, year = false) => new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en-GB",
    { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) },
  ).format(new Date(value)).replace("Sept", "Sep");
  const phoneTime = (value: string) => new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
  const phoneMoney = (value: number) => `${currency.symbol}${currencyWrapper(currency)(value)
    .toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const phoneChange = (value: number | null, total: number) => {
    if (value === null) return "–";
    const previous = total - value;
    const percent = previous === 0 ? 0 : value / previous * 100;
    return <><span>{`${value > 0 ? "+" : value < 0 ? "−" : ""}${phoneMoney(Math.abs(value))}`}</span>
      <span>{`${percent > 0 ? "+" : percent < 0 ? "−" : ""}${Math.abs(percent).toFixed(2)}%`}</span></>;
  };
  const phoneQuantity = (value: number, assetType?: AssetType, symbol?: string) => new Intl.NumberFormat(
    locale === "zh" ? "zh-CN" : "en-US",
    { minimumFractionDigits: assetType === "stock" ? 0 : ["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDD",
      "PYUSD", "USDP", "FRAX", "LUSD", "GUSD", "BUSD"].includes(symbol ?? "") ? 2 : Number.isInteger(value) || value < 1 ? 4 : 2,
      maximumFractionDigits: 8 },
  ).format(value);
  const phonePrice = (value: number) => {
    const converted = currencyWrapper(currency)(value);
    return `${currency.symbol}${Math.abs(converted) < 0.001
      ? new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 20,
      }).format(converted)
      : Math.abs(converted - Math.round(converted * 100) / 100) > 1e-8
        ? new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
          minimumFractionDigits: 4, maximumFractionDigits: 8,
        }).format(converted)
      : prettyPriceNumberToLocaleString(converted)}`;
  };
  const phoneSelectedRow = data.find((row) => row.id === selectedDataId) ??
    (phoneOpenedRow?.id === selectedDataId ? phoneOpenedRow : null);
  const phonePreviousTotal = selectedData && phoneSelectedRow?.change != null
    ? selectedData.total - phoneSelectedRow.change : 0;
  const phoneChangePercent = phoneSelectedRow?.change == null || phonePreviousTotal === 0
    ? 0 : phoneSelectedRow.change / phonePreviousTotal * 100;
  const phoneEditCount = editLog?.length ?? 0;
  const phoneDetailContent = (
    <section role="dialog" aria-label={t("history.snapshotDetails")} className="fidelity-history-detail"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          closeDetail(false);
        }
      }}>
      <div className="fidelity-history-detail-head">
        <button ref={phoneBackRef} type="button" className="fidelity-history-back" aria-label={t("common.back")}
          onClick={() => closeDetail(false)}><ChevronLeftIcon aria-hidden="true" /></button>
        <h2>{selectedData ? `${phoneDate(selectedData.createdAt, true)}, ${phoneTime(selectedData.createdAt)}` : t("history.snapshotDetails")}</h2>
        {phoneSelectedRow?.edited && <span className="fidelity-history-edited">{t("history.editLog.edited")}</span>}
      </div>
      {detailLoading && <p role="status">{t("common.loading")}</p>}
      {detailError && <p role="alert">{t("history.detailLoadFailed")}</p>}
      {selectedData && <>
        <div className="fidelity-history-detail-kpis">
          <div className="fidelity-history-detail-total">
            <span>{t("fidelity.history.detail.totalValue")}</span>
            <strong className="ios-money">{phoneMoney(selectedData.total)}</strong>
            <small>{phoneEditCount
              ? t("fidelity.history.detail.includesEdits").replace("{count}", String(phoneEditCount))
              : t("fidelity.history.detail.asOf")}</small>
          </div>
          <div className="fidelity-history-detail-subkpis">
            <div>
              <span>{t("history.change")}</span>
              <strong className="ios-money" data-tone={phoneSelectedRow?.change == null ? "neutral" :
                positiveNegativeTone(phoneSelectedRow.change, quoteColor) === "green" ? "gain" : "loss"}>
                {phoneSelectedRow?.change == null ? "–" : `${phoneSelectedRow.change < 0 ? "−" : "+"}${phoneMoney(Math.abs(phoneSelectedRow.change))}`}
              </strong>
              <small>{phoneSelectedRow?.change == null ? t("fidelity.history.detail.noPrevious") : <>
                <span data-tone={positiveNegativeTone(phoneSelectedRow.change, quoteColor) === "green" ? "gain" : "loss"}>{`${phoneChangePercent > 0 ? "+" : phoneChangePercent < 0 ? "−" : ""}${Math.abs(phoneChangePercent).toFixed(2)}%`}</span>
                {` ${t("fidelity.history.detail.vsDate").replace("{date}", phonePreviousDate ? phoneDate(phonePreviousDate) : "–")}`}
              </>}</small>
            </div>
            <div>
              <span>{t("history.assets")}</span>
              <strong>{rankData.length}</strong>
              <small>{selectedData.partial
                ? t("fidelity.history.sources").replace("{ready}", String(selectedData.partial.sourcesTotal - selectedData.partial.missing.length))
                  .replace("{total}", String(selectedData.partial.sourcesTotal))
                : ""}</small>
            </div>
          </div>
        </div>
        <div className="fidelity-history-detail-actions">
          <a href={`#/comparison?head=${encodeURIComponent(selectedData.id)}`}><HistoryPhoneIcon kind="compare" />{t("fidelity.history.detail.compare")}</a>
          <button type="button" onClick={() => document.getElementById("fidelity-history-detail-assets")?.scrollIntoView({ behavior: "smooth" })}>
            <HistoryPhoneIcon kind="chevron" />{t("fidelity.history.detail.viewAssets")}</button>
          <button type="button" className="danger" onClick={() => { setIsModalOpen(false); setDeleteCandidate(selectedData.id); }}>
            <HistoryPhoneIcon kind="trash" />{t("fidelity.history.detail.delete")}</button>
        </div>
        <div id="fidelity-history-detail-assets" className="fidelity-history-detail-section">
          <div className="fidelity-history-section-head"><h3>{t("fidelity.history.detail.assetsAt")}</h3>
            <span>{t("history.assetCount").replace("{n}", String(rankData.length))}</span></div>
          {visibleRankData.map((item) => <SwipeableRow key={item.assetId} className="fidelity-history-detail-asset" allowImmediateAction
            actions={[{ label: t("common.delete"), destructive: true, disabled: deletingDetail,
              onClick: () => setDeleteAssetCandidate({ id: item.assetId, symbol: item.symbol }) }]}>
            <div className="fidelity-history-detail-asset-body">
              <div><strong>{item.symbol}</strong><b className="ios-money">{phoneMoney(item.value)}</b></div>
              <small className="ios-money">
                <span>{phoneQuantity(item.amount, item.assetType, item.symbol)}</span>
                {" × "}
                <span>{phonePrice(item.price)}</span>
                {" · "}{(item.value / selectedData.total * 100).toFixed(1)}%
              </small>
            </div>
          </SwipeableRow>)}
          {rankData.length > visibleRankData.length && <button type="button" onClick={() => setDetailLimit((count) => count + DETAIL_PAGE_SIZE)}>
            {t("fidelity.history.detail.loadMore")}</button>}
          <div className="fidelity-history-detail-sum"><strong>{t("history.total")}</strong><b className="ios-money">{phoneMoney(selectedData.total)}</b></div>
        </div>
        {phoneEditCount > 0 && <div role="region" aria-label={t("history.editLog.title")}
          className="fidelity-history-detail-section fidelity-history-detail-edits">
          <div className="fidelity-history-section-head"><h3>{t("fidelity.history.detail.editsTitle")}</h3><span>
            {t("fidelity.history.detail.editsCount").replace("{count}", String(phoneEditCount))}</span></div>
          <ol className="fidelity-history-phone-edits">{editLog?.slice().sort((a, b) =>
            a.edited_at.localeCompare(b.edited_at)).map((edit) => {
            const labels = { assets: t("history.editLog.assets"), amount: t("common.amountLabel"), value: t("common.valueLabel") };
            const formatValue = (value: string | null) => {
              if (value === null) return "";
              if (edit.target === "transaction" && edit.action === "price" && Number.isFinite(Number(value)))
                return phoneMoney(Number(value));
              const formatted = displayEditValue(value, locale === "zh" ? "zh-CN" : "en-US", labels);
              if (edit.target === "snapshot" && edit.action === "replace") {
                const marker = `${labels.value} `;
                const position = formatted.lastIndexOf(marker);
                if (position >= 0) {
                  const total = Number(formatted.slice(position + marker.length).replaceAll(",", ""));
                  if (Number.isFinite(total))
                    return `${formatted.slice(0, position + marker.length)}${phoneMoney(total)}`;
                }
              }
              return formatted;
            };
            const before = formatValue(edit.old_value);
            const after = formatValue(edit.new_value);
            const priceEdit = edit.target === "transaction" && edit.action === "price" && edit.symbol;
            return <li key={edit.id} className="fidelity-history-edit-row">
              <span><strong>{priceEdit ? t("fidelity.history.detail.priceEdit").replace("{symbol}", edit.symbol ?? "")
                : `${t(`history.editLog.${edit.target}.${edit.action}`)}${edit.symbol ? ` ${edit.symbol}` : ""}`}</strong>
                <small>{priceEdit ? t("fidelity.history.detail.editedAt")
                  .replace("{date}", phoneDate(edit.edited_at, true)).replace("{time}", phoneTime(edit.edited_at))
                  : `${t(`history.editLog.origin.${edit.origin}`)} · ${phoneDate(edit.edited_at, true)}, ${phoneTime(edit.edited_at)}`}</small></span>
              <span>{before && after ? `${before} → ${after}` : before || after}</span>
            </li>;
          })}</ol>
        </div>}
        {selectedData.partial && <div className="fidelity-history-detail-section">
          <div className="fidelity-history-section-head"><h3>{t("fidelity.history.detail.sources")}</h3>
            <span>{selectedData.partial.missing.length ? t("fidelity.history.issues") :
              t("fidelity.history.detail.allRefreshed").replace("{count}", String(selectedData.partial.sourcesTotal))}</span></div>
          <HistoryPartialDetails partial={selectedData.partial} t={t} locale={locale} />
        </div>}
      </>}
      <ConfirmDeleteDialog
        open={deleteAssetCandidate !== null}
        onOpenChange={(open) => { if (!open) setDeleteAssetCandidate(null); }}
        title={t("history.deleteDialogTitle")}
        description={t("history.deleteDialogDesc")}
        cancelLabel={t("common.cancel")}
        actions={[
          { label: t("history.deleteBlacklist"), onClick: () => {
            if (deleteAssetCandidate) onHistoricalDataDetailDeleteAndBlacklistClick(deleteAssetCandidate.id, deleteAssetCandidate.symbol);
            setDeleteAssetCandidate(null);
          } },
          { label: t("common.delete"), onClick: () => {
            if (deleteAssetCandidate) onHistoricalDataDetailDeleteClick(deleteAssetCandidate.id);
            setDeleteAssetCandidate(null);
          } },
        ]}
      />
    </section>
  );

  const detailContent = (
        <Dialog
          open={!isMobile && isModalOpen}
          onOpenChange={closeDetail}
        >
          <DetailWrapper open={isModalOpen} onOpenChange={closeDetail}
            title={t("history.snapshotDetails")} className="history-detail-sheet" detents={["large"]} initialDetent="large" inline={isWide}>
          <DetailSurface className="t3-history-detail history-detail-dialog min-w-[80%] touch:min-w-0 touch:w-[calc(100vw-1rem)] touch:max-w-[1200px] touch:max-h-[calc(100dvh-1rem)]">
            <DetailHeader className="history-detail-meta">
              {!isMobile && <DialogTitle>{t("history.detailTitle")}</DialogTitle>}
              {!isMobile && <DialogDescription className="sr-only">
                {t("history.detailDescription")}
              </DialogDescription>}
              {selectedData ? (
                <p className="text-xs text-muted-foreground">
                  {isMobile ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US",
                    { year: "numeric", month: "short", day: "numeric" }).format(new Date(selectedData.createdAt)) : snapshotDateFormatter.format(new Date(selectedData.createdAt))}
                  {" · "}
                  {currency.symbol}
                  {prettyNumberToLocaleString(
                    currencyWrapper(currency)(selectedData.total),
                  )}
                </p>
              ) : null}
              </DetailHeader>
            {detailLoading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
            {detailError ? <p role="alert" className="text-sm text-destructive">{t("history.detailLoadFailed")}</p> : null}
            <div className="history-detail-tools grid gap-2 md:grid-cols-3">
              <div className="history-detail-assets rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("history.assets")}
                </p>
                <p className="text-xl font-semibold">{rankData.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("history.assetsNote")}
                </p>
              </div>
              {!isMobile && <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("history.visibleRows")}
                </p>
                <p className="text-xl font-semibold">
                  {Math.min(detailLimit, filteredRankDataCount)} /{" "}
                  {filteredRankDataCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("history.incrementBy").replace("{n}", String(DETAIL_PAGE_SIZE))}
                </p>
              </div>}
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("history.filter")}
                </p>
                <Input
                  value={detailSearch}
                  onChange={(e) => {
                    setDetailSearch(e.target.value);
                    setDetailLimit(DETAIL_PAGE_SIZE);
                  }}
                  placeholder={t("common.searchSymbolPlaceholder")}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
            <HistoryPartialDetails partial={selectedData?.partial} t={t} locale={locale} />
            <HistoryEditLog edits={editLog} error={editLogError} />
            {isMobile && <div className="history-mobile-detail-list">
              {visibleRankData.map((item) => <SwipeableRow key={item.assetId} className="history-mobile-asset" allowImmediateAction
                actions={[{ label: t("common.delete"), destructive: true, disabled: deletingDetail,
                  onClick: () => setDeleteAssetCandidate({ id: item.assetId, symbol: item.symbol }) }]}>
                <div className="history-mobile-asset-content">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="history-mobile-rank">{item.rank}</span>
                    <img className="h-7 w-7 shrink-0 rounded-full" src={resolveAssetLogoSrc(item, logoMap[item.symbol])} alt="" />
                    <span className="min-w-0 break-words">{item.symbol}</span>
                  </span>
                  <span className="history-asset-value font-mono text-sm">{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(item.value))}</span>
                </div>
                <div className="history-mobile-asset-meta mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t("common.amountLabel")} {prettyNumberKeepNDigitsAfterDecimalPoint(item.amount, 4)}</span>
                  <span>{t("common.priceLabel")} {currency.symbol}{prettyPriceNumberToLocaleString(currencyWrapper(currency)(item.price))}</span>
                </div>
                </div>
              </SwipeableRow>)}
            </div>}
            {isMobile && selectedDataId && latestRow?.id === selectedDataId && (
              <button type="button" className="history-mobile-delete"
                disabled={deleting}
                onClick={() => {
                  setIsModalOpen(false);
                  setDeleteCandidate(selectedDataId);
                }}>
                {t("history.deleteSnapshot")}
              </button>
            )}
            {isMobile && <ConfirmDeleteDialog
              open={deleteAssetCandidate !== null}
              onOpenChange={(open) => { if (!open) setDeleteAssetCandidate(null); }}
              title={t("history.deleteDialogTitle")}
              description={t("history.deleteDialogDesc")}
              cancelLabel={t("common.cancel")}
              contentClassName="history-asset-confirm"
              overlayClassName="history-asset-confirm-overlay"
              actions={[
                { label: t("history.deleteBlacklist"), onClick: () => {
                  if (deleteAssetCandidate) onHistoricalDataDetailDeleteAndBlacklistClick(deleteAssetCandidate.id, deleteAssetCandidate.symbol);
                  setDeleteAssetCandidate(null);
                } },
                { label: t("common.delete"), onClick: () => {
                  if (deleteAssetCandidate) onHistoricalDataDetailDeleteClick(deleteAssetCandidate.id);
                  setDeleteAssetCandidate(null);
                } },
              ]}
            />}
            {!isMobile && <div
              ref={detailRegionRef}
              className="history-desktop-detail-table w-full max-h-[70vh] overflow-auto"
              role="region"
              aria-label={t("history.assets")}
              tabIndex={0}
              onScroll={(event) => setDetailScrollTop(event.currentTarget.scrollTop)}
            >
              <Table aria-rowcount={filteredRankDataCount + 1}>
                <TableHeader>
                  <TableRow aria-rowindex={1}>
                    <TableHead className="h-[42px]">{t("history.rank")}</TableHead>
                    <TableHead className="h-[42px]">{t("history.asset")}</TableHead>
                    <TableHead className="h-[42px] text-right">{t("common.priceLabel")}</TableHead>
                    <TableHead className="h-[42px] text-right">
                      {t("common.amountLabel")}
                    </TableHead>
                    <TableHead className="h-[42px] text-right">{t("common.valueLabel")}</TableHead>
                    <TableHead className="h-[42px]">{t("history.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!detailLoading && !detailError && visibleRankData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="py-6 text-center text-sm text-muted-foreground"
                        colSpan={6}
                      >
                        {t("history.noMatch")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {detailStart > 0 ? (
                    <TableRow aria-hidden="true"><TableCell colSpan={6} style={{ height: detailOffsets[detailStart], padding: 0 }} /></TableRow>
                  ) : null}
                  {virtualRankData.map((item, virtualIndex) => {
                    const apiPath = resolveAssetLogoSrc(
                      item,
                      logoMap[item.symbol],
                    );
                    return (
                      <TableRow
                        key={"historical-data-detail-row-" + item.assetId}
                        data-testid="history-detail-row"
                        data-asset-id={item.assetId}
                        aria-rowindex={detailStart + virtualIndex + 2}
                        className="h-[42px] hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="py-1.5 text-sm">
                          # {item.rank}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-1 text-sm">
                            <img
                              className="inline-block w-[18px] h-[18px] rounded-full"
                              src={apiPath}
                              alt={item.symbol}
                            />
                            <AssetLabel asset={item} />
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm">
                          {currency.symbol}
                          {prettyPriceNumberToLocaleString(
                            currencyWrapper(currency)(item.price),
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm">
                          {prettyNumberKeepNDigitsAfterDecimalPoint(
                            item.amount,
                            4,
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-sm">
                          {currency.symbol}
                          {prettyNumberToLocaleString(
                            currencyWrapper(currency)(item.value),
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <ConfirmDeleteDialog
                            trigger={
                              <button
                                className="opacity-80 hover:opacity-100 transition-opacity"
                                disabled={deletingDetail}
                                aria-label={t("common.delete")}
                              >
                                <img
                                  src={DeleteIcon}
                                  alt=""
                                  style={{ border: 0, height: 18, width: 18 }}
                                />
                              </button>
                            }
                            title={t("history.deleteDialogTitle")}
                            description={t("history.deleteDialogDesc")}
                            cancelLabel={t("common.cancel")}
                            actions={[
                              {
                                label: t("history.deleteBlacklist"),
                                onClick: () => onHistoricalDataDetailDeleteAndBlacklistClick(item.assetId, item.symbol),
                              },
                              {
                                label: t("common.delete"),
                                onClick: () => onHistoricalDataDetailDeleteClick(item.assetId),
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {detailStart + virtualRankData.length < visibleRankData.length ? (
                    <TableRow aria-hidden="true"><TableCell colSpan={6} style={{
                      height: detailOffsets[visibleRankData.length] - detailOffsets[detailStart + virtualRankData.length],
                      padding: 0,
                    }} /></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>}
            {filteredRankDataCount > DETAIL_PAGE_SIZE ? (
              <Button
                variant="ghost"
                className="border-t border-border/40 rounded-none hover:bg-muted/50"
                onClick={() => {
                  if (detailLimit >= filteredRankDataCount) {
                    setDetailLimit(DETAIL_PAGE_SIZE);
                    return;
                  }
                  setDetailLimit((prev) => prev + DETAIL_PAGE_SIZE);
                }}
              >
                {detailLimit >= filteredRankDataCount
                  ? t("common.showLess")
                  : t("history.showMoreCount")
                      .replace("{n}", String(Math.min(
                        DETAIL_PAGE_SIZE,
                        filteredRankDataCount - detailLimit,
                      )))}
              </Button>
            ) : null}
          </DetailSurface>
          </DetailWrapper>
        </Dialog>
  );

  const phoneListContent = <div className="fidelity-history">
    <h1 className="ios-large-title">{t("fidelity.history.title")}</h1>
    <p className="fidelity-history-subtitle">{pageLoading && totalCount === 0 ? t("common.loading") :
      emptyState ? t("fidelity.history.emptySubtitle") :
      t("fidelity.history.subtitle").replace("{date}", latestRow
        ? `${phoneDate(latestRow.createdAt)}, ${phoneTime(latestRow.createdAt)}` : "–")
        .split("{count}").map((part, index) => <Fragment key={index}>
          {index > 0 && <strong>{totalCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</strong>}{part}
        </Fragment>)}</p>
    <div className="fidelity-history-chips">
      <button type="button" className="selected" disabled={emptyState} onClick={() => {
        setPendingPhoneRange(phoneRange); setPendingPhoneStatus(historyFilter);
        setPendingPhoneFrom(phoneFrom); setPendingPhoneTo(phoneTo); setPhoneFilterOpen(true);
      }}><HistoryPhoneIcon kind="clock" />{phoneRange === "all" ? t("fidelity.history.allTime") :
        t(`fidelity.history.days${phoneRange}`)}<HistoryPhoneIcon kind="chevron" /></button>
      <button type="button" disabled={emptyState} onClick={() => {
        setPendingPhoneRange(phoneRange); setPendingPhoneStatus(historyFilter);
        setPendingPhoneFrom(phoneFrom); setPendingPhoneTo(phoneTo); setPhoneFilterOpen(true);
      }}><HistoryPhoneIcon kind="filter" />{historyFilter === "all" ? t("fidelity.history.statusAll") :
        historyFilter === "edited" ? t("history.editLog.edited") : historyFilter === "partial" ?
          t("fidelity.history.issues") : t("history.partial.complete")}<HistoryPhoneIcon kind="chevron" /></button>
      <button type="button" disabled={emptyState} aria-pressed={historyFilter === "edited"}
        onClick={() => { setHistoryFilter(historyFilter === "edited" ? "all" : "edited"); setDataPage(0); }}>
        {t("history.editLog.edited")}</button>
    </div>
    <section className="fidelity-history-card t3-history-records history-records-card">
      <div className="fidelity-history-card-head"><h2>{t("fidelity.history.snapshots")}</h2>
        {!emptyState && <span>{pageLoading ? t("common.loading") : t("fidelity.history.newest")}</span>}</div>
      {pageLoading && data.length === 0 ? <div className="fidelity-history-skeletons">{Array.from({ length: 8 }, (_, index) =>
        <div className="fidelity-history-skeleton" key={index}><i /><i /><i /><i /></div>)}</div> :
        emptyState ? <div className="fidelity-history-empty">
          <div><strong>{t("fidelity.history.noSnapshots")}</strong>
            <p>{t("fidelity.history.emptyBody")}</p>
            <button type="button" onClick={() => { void refreshEmptyHistory(); }}>
              <HistoryPhoneIcon kind="refresh" />{t("fidelity.history.refresh")}</button>
          </div>
        </div> :
        <div className="history-mobile-list fidelity-history-list">
          {data.map((row) => <SwipeableRow key={row.id} className="history-mobile-snapshot"
            actions={[{ label: t("common.delete"), icon: <HistoryPhoneIcon kind="trash" />, destructive: true, disabled: deleting,
              onClick: () => setDeleteCandidate(row.id) }]}>
            <button type="button" data-testid="history-mobile-row" className="history-mobile-snapshot-button"
              aria-current={isWide && isModalOpen && selectedDataId === row.id ? "true" : undefined}
              onClick={(event) => onRowClick(row.id, event.currentTarget)}>
              <span className="sr-only">{t("history.viewSnapshot").replace("{date}", phoneDate(row.createdAt, true))}</span>
              <span className="history-mobile-snapshot-date"><strong>{phoneDate(row.createdAt)}</strong>
                <span>{phoneTime(row.createdAt)}</span>
                {row.edited && <span className="fidelity-history-edited">{t("history.editLog.edited")}</span>}
              </span>
              <span className="history-mobile-snapshot-total ios-money">{phoneMoney(row.total)}</span>
              <span className="fidelity-history-sources">
                {t("history.assetCount").replace("{n}", String(row.assetCount))}
                {row.sourcesTotal !== undefined && <> · <span className="fidelity-history-source-count">{t("fidelity.history.sources")
                  .replace("{ready}", String(row.sourcesTotal - (row.missingCount ?? 0)))
                  .replace("{total}", String(row.sourcesTotal))}</span></>}
                <span className="fidelity-history-hidden-logos"><ImageStack imageSrcs={row.topAssets.slice(0, 3).map((asset) =>
                  resolveAssetLogoSrc(asset, logoMap[asset.symbol]))} imageWidth={18} imageHeight={18} /></span>
              </span>
              <span className="history-mobile-snapshot-delta ios-money" data-tone={row.change === null ? "neutral" :
                positiveNegativeTone(row.change, quoteColor) === "green" ? "gain" : "loss"}>
                {phoneChange(row.change, row.total)}
              </span>
            </button>
          </SwipeableRow>)}
        </div>}
      {pageLoading && <div className="fidelity-history-skeleton-pager"><i /></div>}
      {!emptyState && !pageLoading && <div className="fidelity-history-pager">
        <span>{t("fidelity.history.rangeCount").replace("{start}", String(dataPage * pageSize + 1))
          .replace("{end}", String(dataPage * pageSize + data.length))
          .replace("{count}", totalCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))}</span>
        {dataPage > 0 && <button type="button" onClick={() => setDataPage(dataPage - 1)}>
          {t("fidelity.history.previous50")}</button>}
        <button type="button" disabled={dataPage >= maxDataPage}
          onClick={() => setDataPage(Math.min(dataPage + 1, maxDataPage))}>{t("fidelity.history.next50")}</button>
      </div>}
      {!pageLoading && <div className="fidelity-history-hint"><HistoryPhoneIcon kind="info" />
        <span>{t(emptyState ? "fidelity.history.localNoteActual" : "fidelity.history.hintActual")}</span></div>}
    </section>
  </div>;

  const listContent = (
        <FadeUp>
          <Card className={isMobile ? "t3-history-records history-records-card" : "t3-history-records"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("history.recordsCardTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("history.recordsCardSubtitle")}
              </p>
              <Select value={historyFilter} onValueChange={(value: "all" | "edited" | "complete" | "partial") => {
                setHistoryFilter(value);
                setDataPage(0);
              }}>
                <SelectTrigger aria-label={t("history.editLog.filter")} className="mt-2 h-9 w-[150px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("history.editLog.all")}</SelectItem>
                  <SelectItem value="edited">{t("history.editLog.edited")}</SelectItem>
                  <SelectItem value="complete">{t("history.partial.complete")}</SelectItem>
                  <SelectItem value="partial">{t("history.partial.label")}</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3 touch:min-w-0">
              <div className="history-page-controls flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <div>
                  {pageLoading
                    ? t("common.loading")
                    : t("history.totalRecordsLabel").replace("{n}", String(totalCount))}
                  {totalCount
                    ? ` · ${t("history.showing").replace("{start}", String(loadedRangeStart)).replace("{end}", String(loadedRangeEnd))}`
                    : ""}
                </div>
                <div className="flex items-center gap-2 touch:min-w-0 touch:flex-wrap">
                  <span className="text-xs text-muted-foreground">{t("history.rowsLabel")}</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setDataPage(0);
                    }}
                  >
                    <SelectTrigger aria-label={`${t("history.rowsLabel")} ${pageSize}`} className="history-rows-trigger h-8 w-[84px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[10, 20, 50].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t("history.prevPage")}
                    className="touch:h-11 touch:w-11 px-0 h-8 w-8"
                    onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
                    disabled={dataPage <= 0}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  {totalPages > 100 ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        aria-label={t("history.selectPage")}
                        className="h-8 w-[72px] text-sm"
                        value={pageInput}
                        onChange={(event) => setPageInput(event.target.value)}
                        onBlur={applyPageInput}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") applyPageInput();
                        }}
                      />
                      <span>/ {totalPages}</span>
                    </div>
                  ) : (
                    <Select
                      value={String(dataPage)}
                      onValueChange={(v) => setDataPage(Number(v))}
                    >
                      <SelectTrigger aria-label={`${t("history.selectPage")} ${dataPage + 1} / ${maxDataPage + 1}`} className="history-page-trigger h-8 w-[120px] text-sm">
                        <SelectValue placeholder={t("history.selectPage")} />
                      </SelectTrigger>
                      <SelectContent className="overflow-y-auto max-h-[20rem]">
                        <SelectGroup>
                          {Array.from({length: maxDataPage + 1}, (_, i) => i).map((pageIdx) => (
                            <SelectItem
                              key={"historical-idx-" + pageIdx}
                              value={String(pageIdx)}
                            >
                              {pageIdx + 1} / {maxDataPage + 1}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t("history.nextPage")}
                    className="touch:h-11 touch:w-11 px-0 h-8 w-8"
                    onClick={() =>
                      setDataPage(Math.min(dataPage + 1, maxDataPage))
                    }
                    disabled={dataPage >= maxDataPage}
                  >
                    <ChevronRightIcon />
                  </Button>
                  </div>
                </div>
              </div>

              <div className="history-record-region relative">
                {isMobile && <div className="history-mobile-list">
                  {groupHistoryMonths(data).map((group) => <section key={group.key} className="history-month-section">
                    <h2 className="history-month-heading">
                      <span>{new Intl.DateTimeFormat(
                        locale === "zh" ? "zh-CN" : "en-US",
                        { month: "long", year: "numeric" },
                      ).format(new Date(`${group.key}-01T12:00:00`))}</span>
                      <strong className="ios-money">{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(group.rows[0].total))}</strong>
                    </h2>
                    <div className="history-month-rows">
                  {group.rows.map((row) => {
                    const isLatest = latestRow?.id === row.id;
                    return <SwipeableRow key={row.id} className="history-mobile-snapshot"
                      actions={isLatest ? [{ label: t("common.delete"), destructive: true, disabled: deleting,
                        onClick: () => setDeleteCandidate(row.id) }] : []}>
                      <button type="button" data-testid="history-mobile-row"
                        className="history-mobile-snapshot-button" aria-current={isWide && isModalOpen && selectedDataId === row.id ? "true" : undefined}
                        onClick={(event) => onRowClick(row.id, event.currentTarget)}>
                        <span className="sr-only">{t("history.viewSnapshot").replace("{date}", timeToDateStr(new Date(row.createdAt).getTime(), true))}</span>
                        <span className="history-mobile-snapshot-primary">
                          <span className="history-mobile-snapshot-date">{new Intl.DateTimeFormat(
                            locale === "zh" ? "zh-CN" : "en-US",
                            { month: "short", day: "numeric" },
                          ).format(new Date(row.createdAt))}</span>
                          {row.edited ? <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {t("history.editLog.edited")}
                          </span> : null}
                          <HistoryPartialPill row={row} t={t} />
                          <span className="history-mobile-snapshot-total ios-money">{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(row.total))}</span>
                        </span>
                        <span className="history-mobile-snapshot-secondary">
                          <span className="flex items-center gap-2">
                            <ImageStack imageSrcs={row.topAssets.slice(0, 3).map((asset) =>
                              resolveAssetLogoSrc(asset, logoMap[asset.symbol]))}
                              imageWidth={18} imageHeight={18} />
                            {t("history.assetCount").replace("{n}", String(row.assetCount))}
                          </span>
                          <span className="history-mobile-snapshot-delta ios-money" data-tone={row.change === null ? "neutral" : positiveNegativeTone(row.change, quoteColor) === "green" ? "gain" : "loss"}>
                            {row.change === null ? "—" : `${row.change > 0 ? "+" : row.change < 0 ? "-" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(row.change)))}`}
                          </span>
                        </span>
                      </button>
                    </SwipeableRow>;
                  })}
                    </div>
                  </section>)}
                </div>}
                {!isMobile && <ScrollArea className="t3-history-table history-desktop-table w-full touch:min-w-0 touch:max-w-full rounded-lg border border-border/40 bg-background/20">
                  <Table className="touch:min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-[42px] touch:sticky touch:left-0 touch:z-10 touch:bg-card">{t("profitMetrics.date")}</TableHead>
                        <TableHead className="h-[42px] text-right">
                          {t("history.total")}
                        </TableHead>
                        <TableHead className="h-[42px] text-right">
                          {t("history.change")}
                        </TableHead>
                        <TableHead className="h-[42px]">{t("history.assetsCol")}</TableHead>
                        <TableHead className="h-[42px]">{t("history.opt")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row) => {
                        const isLatest = latestRow?.id === row.id;
                        const topAssets = row.topAssets;
                        const displayDate = snapshotDateFormatter.format(new Date(row.createdAt));

                        return (
                          <TableRow
                            key={"historical-row-" + row.id}
                            data-testid="history-snapshot-row"
                            className="group cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => onRowClick(row.id)}
                          >
                            <TableCell className="py-1.5 text-sm touch:sticky touch:left-0 touch:z-10 touch:bg-card touch:group-hover:bg-muted">
                              <button type="button"
                                aria-label={t("history.viewSnapshot").replace("{date}", `${timeToDateStr(new Date(row.createdAt).getTime(), true)} · ${displayDate}`)}
                                className="flex touch:min-h-11 flex-col rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <span>{displayDate}</span>
                                {row.edited ? <span className="mt-1 w-fit rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                  {t("history.editLog.edited")}
                                </span> : null}
                                <HistoryPartialPill row={row} t={t} />
                              </button>
                              <span className="block text-xs text-muted-foreground">{row.id.slice(0, 8)}</span>
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-sm font-semibold">
                              {currency.symbol}
                              {prettyNumberToLocaleString(
                                currencyWrapper(currency)(row.total),
                              )}
                            </TableCell>
                            <TableCell
                              className="py-1.5 text-right text-sm"
                              style={{
                                color: positiveNegativeColor(
                                  row.change ?? 0,
                                  quoteColor,
                                ),
                              }}
                            >
                              {row.change === null
                                ? "-"
                                : `${row.change > 0 ? "+" : row.change < 0 ? "-" : ""}${currency.symbol}${prettyNumberToLocaleString(
                                    currencyWrapper(currency)(
                                      Math.abs(row.change),
                                    ),
                                  )}`}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <ImageStack
                                  imageSrcs={topAssets.map((asset) =>
                                    resolveAssetLogoSrc(
                                      asset,
                                      logoMap[asset.symbol],
                                    ),
                                  )}
                                  imageWidth={18}
                                  imageHeight={18}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {t("history.assetCount").replace("{n}", String(row.assetCount))}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell
                              className="py-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isLatest ? (
                                <ConfirmDeleteDialog
                                  trigger={
                                    <button
                                      className="hidden group-hover:inline-block opacity-80 hover:opacity-100 transition-opacity"
                                      disabled={deleting}
                                      aria-label={t("common.delete")}
                                      data-testid="history-delete-latest"
                                    >
                                      <img
                                        src={DeleteIcon}
                                        alt=""
                                        style={{ border: 0, height: 18, width: 18 }}
                                      />
                                    </button>
                                  }
                                  title={t("history.deleteLatestTitle")}
                                  description={t("history.deleteLatestDesc")}
                                  cancelLabel={t("common.cancel")}
                                  actions={[{
                                    label: t("common.confirm"),
                                    onClick: () => onHistoricalDataDeleteClick(row.id),
                                  }]}
                                />
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>}

                {pageLoading && (
                  <PageLoadingOverlay
                    title={t("loading.history")}
                    description={t("loading.historyDesc")}
                  />
                )}

                {emptyState ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-lg text-muted-foreground">
                      {t("history.noRecords")}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </FadeUp>
  );

  return (
    <div className="t3-manage-history d2-history" aria-busy={pageLoading} data-testid="history-content">
      {!isMobile && <h1 className="sr-only">{t("history.h1")}</h1>}
      <StaggerContainer className="space-y-4">
        {isMobile && <ConfirmDeleteDialog
          open={deleteCandidate !== null}
          onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}
          title={isPhone ? t("fidelity.history.deleteTitle") : t("history.deleteLatestTitle")}
          description={isPhone ? <>{deleteCandidate && data.find((row) => row.id === deleteCandidate) && <span className="fidelity-history-delete-meta">
            {phoneDate(data.find((row) => row.id === deleteCandidate)!.createdAt, true)},{" "}
            {phoneTime(data.find((row) => row.id === deleteCandidate)!.createdAt)} ·{" "}
            {phoneMoney(data.find((row) => row.id === deleteCandidate)!.total)} ·{" "}
            {t("history.assetCount").replace("{n}", String(data.find((row) => row.id === deleteCandidate)!.assetCount))}
          </span>}{t("fidelity.history.deleteDesc")}</> : t("history.deleteLatestDesc")}
          cancelLabel={t("common.cancel")}
          actions={[{ label: isPhone ? t("history.deleteSnapshot") : t("common.confirm"),
            icon: isPhone ? <HistoryPhoneIcon kind="trash" /> : undefined, onClick: () => {
            if (deleteCandidate) onHistoricalDataDeleteClick(deleteCandidate);
            setDeleteCandidate(null);
          } }]}
          contentClassName={isPhone ? "fidelity-history-delete-dialog" : undefined}
        />}
        {isPhone && <BottomSheet open={phoneFilterOpen} onOpenChange={setPhoneFilterOpen}
          title={t("fidelity.history.filterTitle")} className="fidelity-history-filter-sheet" detents={["medium"]}>
          <div className="fidelity-history-filter">
            <p>{(phoneCounts?.all ?? totalCount).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} {t("fidelity.history.snapshots").toLowerCase()}</p>
            <label>{t("fidelity.history.range")}</label>
            <div className="fidelity-history-segments" role="group" aria-label={t("fidelity.history.range")}>
              {(["7", "30", "90", "all"] as const).map((value) => <button type="button" key={value}
                className={pendingPhoneRange === value ? "selected" : ""} aria-pressed={pendingPhoneRange === value}
                onClick={() => setPendingPhoneRange(value)}>{value === "all" ? t("fidelity.history.all") :
                  t(`fidelity.history.days${value}`)}</button>)}
            </div>
            <label>{t("cost.from")}<span className="fidelity-history-date-input" data-empty={!pendingPhoneFrom}>
              <input type="date" aria-label={t("cost.from")} value={pendingPhoneFrom}
                onChange={(event) => setPendingPhoneFrom(event.target.value)} />
              {!pendingPhoneFrom && <span aria-hidden="true">{t("fidelity.history.anyDate")}</span>}
            </span></label>
            <label className="fidelity-history-to">{t("cost.to")}<span className="fidelity-history-date-input" data-empty={!pendingPhoneTo}>
              <input type="date" aria-label={t("cost.to")} value={pendingPhoneTo}
                onChange={(event) => setPendingPhoneTo(event.target.value)} />
              {!pendingPhoneTo && <span aria-hidden="true">{t("fidelity.history.anyDate")}</span>}
            </span></label>
            <label>{t("fidelity.history.show")}</label>
            <div className="fidelity-history-segments" role="group" aria-label={t("fidelity.history.show")}>
              {(["all", "partial", "edited"] as const).map((value) => <button type="button" key={value}
                className={pendingPhoneStatus === value ? "selected" : ""} aria-pressed={pendingPhoneStatus === value}
                onClick={() => setPendingPhoneStatus(value)}>{value === "all" ? t("fidelity.history.all") :
                  `${value === "edited" ? t("history.editLog.edited") : t("fidelity.history.issues")}${phoneCounts ? ` ${phoneCounts[value]}` : ""}`}</button>)}
            </div>
            <button type="button" className="fidelity-history-apply" onClick={() => {
              setPhoneRange(pendingPhoneRange); setPhoneFrom(pendingPhoneFrom); setPhoneTo(pendingPhoneTo);
              setHistoryFilter(pendingPhoneStatus); setDataPage(0); setPhoneFilterOpen(false);
            }}>{t("fidelity.history.showCount").replace("{count}",
              (phoneCounts?.[pendingPhoneStatus as keyof typeof phoneCounts] ?? totalCount)
                .toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))}</button>
            <button type="button" className="fidelity-history-reset" onClick={() => {
              setPendingPhoneRange("all"); setPendingPhoneStatus("all"); setPendingPhoneFrom(""); setPendingPhoneTo("");
              setPhoneRange("all"); setHistoryFilter("all"); setPhoneFrom(""); setPhoneTo("");
              setDataPage(0); setPhoneFilterOpen(false);
            }}>{t("fidelity.history.reset")}</button>
          </div>
        </BottomSheet>}
        {!isMobile && detailContent}

        {!isMobile && <FadeUp>
          <div className="t3-history-kpis grid gap-3 md:grid-cols-3" data-testid="history-kpi-strip">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("history.totalRecords")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{totalCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("history.snapshotsStored")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("history.pageStatus")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {totalPages === 0
                    ? "0 / 0"
                    : `${dataPage + 1} / ${totalPages}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("history.showing").replace("{start}", String(loadedRangeStart)).replace("{end}", String(loadedRangeEnd))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("history.latestSnapshot")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold tracking-tight">
                  {latestRow
                    ? `${currency.symbol}${prettyNumberToLocaleString(
                        currencyWrapper(currency)(latestRow.total),
                      )}`
                    : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {latestRow ? snapshotDateFormatter.format(new Date(latestRow.createdAt)) : t("history.noDataLabel")}
                </p>
              </CardContent>
            </Card>
          </div>
        </FadeUp>}

        {isMobile ? <SplitView selected={isPhone && isModalOpen} master={isPhone ? phoneListContent : listContent}
          detail={isWide && !isModalOpen
            ? <p className="analytics-empty">{t("history.selectDetail")}</p>
            : isPhone ? phoneDetailContent : detailContent}
          className="history-split" masterLabel={t("history.recordsCardTitle")}
          detailLabel={t("history.detailTitle")} /> : listContent}
      </StaggerContainer>
    </div>
  );
};

export default App;
