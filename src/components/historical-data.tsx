import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import {
  deleteHistoricalDataByUUID,
  deleteHistoricalDataDetailById,
  queryHistoricalDetail,
  queryHistoricalPage,
  queryRestoreHistoricalData,
  restoreHistoricalData,
} from "@/middlelayers/charts";
import type { HistoricalLatest, HistoricalPageRow } from "@/middlelayers/charts-history";
import { addToBlacklist } from "@/middlelayers/configuration";
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
import ImageStack from "./common/image-stack";
import AssetLabel from "./common/asset-label";
import { getImageApiPath } from "@/utils/app";
import { Button } from "./ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { resolveAssetLogoSrc } from "@/utils/assets";
import { positiveNegativeColor } from "@/utils/color";
import ConfirmDeleteDialog from "./common/confirm-delete-dialog";
import { useOptimisticDelete } from "./common/use-optimistic-delete";
import { StaggerContainer, FadeUp } from "./motion";
import PageLoadingOverlay from "./page-loading-overlay";
import { useTranslation } from "@/i18n";
import { ScrollArea } from "./ui/scroll-area";

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
  const { t } = useTranslation();

  const [data, setData] = useState<HistoricalPageRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [latestRow, setLatestRow] = useState<HistoricalLatest | null>(null);
  const [selectedData, setSelectedData] = useState<HistoricalData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLimit, setDetailLimit] = useState(DETAIL_PAGE_SIZE);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailScrollTop, setDetailScrollTop] = useState(0);
  const [measuredDetailHeights, setMeasuredDetailHeights] = useState<Map<number, number>>(() => new Map());
  const [pageLoading, setPageLoading] = useState(true);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});

  const { run: runDelete, isDeleting: deleting } = useOptimisticDelete(setData);
  const { run: runDetailDelete, isDeleting: deletingDetail } = useOptimisticDelete(setSelectedData);

  const [dataPage, setDataPage] = useState(0);
  const dataPageRef = useRef(dataPage);
  dataPageRef.current = dataPage;
  const [pageInput, setPageInput] = useState("1");
  const [pageSize, setPageSize] = useState(20);

  const loadGenRef = useRef(0);
  const detailRegionRef = useRef<HTMLDivElement>(null);
  // Set right before calling `afterDataChanged` from a local mutation
  // (delete/undo) so the next dataChangedVersion bump skips the loading
  // overlay. Keep the current list visible while `loadPage` refreshes it.
  const skipNextLoadingRef = useRef(false);
  const localMutationRef = useRef(false);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    if (skipNextLoadingRef.current) {
      skipNextLoadingRef.current = false;
      return;
    }
    setPageLoading(true);
  }, [rangeKey, dataChangedVersion, dataPage, pageSize]);

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
      const result = await queryHistoricalPage(dateRange, pageSize, dataPage);
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
  }, [rangeKey, dateRange, dataChangedVersion, dataPage, pageSize]);

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
    setDataPage(0);
    setSelectedDataId(null);
    setSelectedData(null);
    setIsModalOpen(false);
  }, [rangeKey]);

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
        successMessage: t("history.deleted"),
        undoLabel: t("common.undo"),
        undoAltText: t("history.undoDelete"),
        undoWindowMs: 5000,
        syncSnapshotUuid: uuid,
      });
    },
    [afterDataChanged, data, dataPage, latestRow, runDelete, t],
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

  const onRowClick = useCallback((id: string) => {
    setSelectedData(null);
    setDetailLoading(true);
    setDetailError(false);
    setSelectedDataId(id);
    setDetailLimit(DETAIL_PAGE_SIZE);
    setDetailSearch("");
    setDetailScrollTop(0);
    setMeasuredDetailHeights(new Map());
    setIsModalOpen(true);
  }, []);

  const emptyState = !pageLoading && totalCount === 0;
  const loadedRangeStart = totalCount ? dataPage * pageSize + 1 : 0;
  const loadedRangeEnd = Math.min((dataPage + 1) * pageSize, totalCount);
  const totalPages = maxDataPage + 1;

  return (
    <div aria-busy={pageLoading} data-testid="history-content">
      <h1 className="sr-only">{t("history.h1")}</h1>
      <StaggerContainer className="space-y-4">
        <Dialog
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setSelectedDataId(null);
              setSelectedData(null);
            }
          }}
        >
          <DialogContent className="min-w-[80%] touch:min-w-0 touch:w-[calc(100vw-1rem)] touch:max-w-[1200px] touch:max-h-[calc(100dvh-1rem)]">
            <DialogHeader>
              <DialogTitle>{t("history.detailTitle")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("history.detailDescription")}
              </DialogDescription>
              {selectedData ? (
                <p className="text-xs text-muted-foreground">
                  {timeToDateStr(
                    new Date(selectedData.createdAt).getTime(),
                    true,
                  )}
                  {" · "}
                  {currency.symbol}
                  {prettyNumberToLocaleString(
                    currencyWrapper(currency)(selectedData.total),
                  )}
                </p>
              ) : null}
            </DialogHeader>
            {detailLoading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : null}
            {detailError ? <p role="alert" className="text-sm text-destructive">{t("history.detailLoadFailed")}</p> : null}
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("history.assets")}
                </p>
                <p className="text-xl font-semibold">{rankData.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("history.assetsNote")}
                </p>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
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
              </div>
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
            <div
              ref={detailRegionRef}
              className="w-full max-h-[70vh] overflow-auto"
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
            </div>
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
          </DialogContent>
        </Dialog>

        <FadeUp>
          <div className="grid gap-3 md:grid-cols-3">
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
                  {latestRow
                    ? timeToDateStr(
                        new Date(latestRow.createdAt).getTime(),
                        true,
                      )
                    : t("history.noDataLabel")}
                </p>
              </CardContent>
            </Card>
          </div>
        </FadeUp>

        <FadeUp>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("history.recordsCardTitle")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("history.recordsCardSubtitle")}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 touch:min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
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
                    <SelectTrigger aria-label={`${t("history.rowsLabel")} ${pageSize}`} className="h-8 w-[84px] text-sm">
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
                      <SelectTrigger aria-label={`${t("history.selectPage")} ${dataPage + 1} / ${maxDataPage + 1}`} className="h-8 w-[120px] text-sm">
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

              <div className="relative">
                <ScrollArea className="w-full touch:min-w-0 touch:max-w-full rounded-lg border border-border/40 bg-background/20">
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
                      {data.map((row, idx) => {
                        const isLatest = dataPage === 0 && idx === 0;
                        const topAssets = row.topAssets;

                        return (
                          <TableRow
                            key={"historical-row-" + row.id}
                            data-testid="history-snapshot-row"
                            className="group cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => onRowClick(row.id)}
                          >
                            <TableCell className="py-1.5 text-sm touch:sticky touch:left-0 touch:z-10 touch:bg-card touch:group-hover:bg-muted">
                              <button type="button"
                                aria-label={t("history.viewSnapshot").replace("{date}", timeToDateStr(new Date(row.createdAt).getTime(), true))}
                                className="flex touch:min-h-11 flex-col rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <span>
                                  {timeToDateStr(
                                    new Date(row.createdAt).getTime(),
                                    true,
                                  )}
                                </span>
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
                </ScrollArea>

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
      </StaggerContainer>
    </div>
  );
};

export default App;
