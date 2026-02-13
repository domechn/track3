import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteHistoricalDataByUUID,
  deleteHistoricalDataDetailById,
  queryHistoricalData,
  queryRestoreHistoricalData,
  restoreHistoricalData,
} from "@/middlelayers/charts";
import {
  CurrencyRateDetail,
  HistoricalData,
  QuoteColor,
  RestoreHistoricalData,
  TDateRange,
} from "@/middlelayers/types";
import DeleteIcon from "@/assets/icons/delete-icon.png";
import _ from "lodash";

import { useToast } from "@/components/ui/use-toast";
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
import { getImageApiPath } from "@/utils/app";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { ToastAction } from "./ui/toast";
import { positiveNegativeColor } from "@/utils/color";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { StaggerContainer, FadeUp } from "./motion";

type HistoricalListRow = {
  id: string;
  createdAt: string;
  total: number;
  change: number | null;
  assets: HistoricalData["assets"];
};

type RankData = {
  id: number;
  assetId: number;
  rank: number;
  symbol: string;
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
    id?: number
  ) => unknown;
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { toast } = useToast();

  const [data, setData] = useState([] as HistoricalData[]);
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLimit, setDetailLimit] = useState(DETAIL_PAGE_SIZE);
  const [detailSearch, setDetailSearch] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [prevRangeKey, setPrevRangeKey] = useState("");
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});

  const [deleting, setDeleting] = useState(false);

  const [dataPage, setDataPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const loadGenRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  if (prevRangeKey !== rangeKey) {
    setPrevRangeKey(rangeKey);
    setPageLoading(true);
  }

  const dataRows = useMemo<HistoricalListRow[]>(() => {
    return data.map((item, idx) => ({
      id: item.id,
      createdAt: item.createdAt,
      total: item.total,
      change:
        idx < data.length - 1 ? item.total - (data[idx + 1]?.total ?? 0) : null,
      assets: item.assets,
    }));
  }, [data]);

  const symbolPricePairs = useMemo(() => {
    const latestBySymbol = new Map<string, number>();
    for (const item of dataRows) {
      for (const asset of item.assets) {
        if (!latestBySymbol.has(asset.symbol)) {
          latestBySymbol.set(asset.symbol, asset.price);
        }
      }
    }

    return Array.from(latestBySymbol.entries()).map(([symbol, price]) => ({
      symbol,
      price,
    }));
  }, [dataRows]);

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
        }))
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

  const loadAllData = useCallback(async () => {
    const currentGen = ++loadGenRef.current;

    try {
      const records = await queryHistoricalData(-1);
      if (currentGen !== loadGenRef.current) {
        return;
      }
      setData(records);
      setDataPage(0);
      setSelectedDataId(null);
      setIsModalOpen(false);
    } finally {
      if (currentGen === loadGenRef.current) {
        setPageLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, rangeKey]);

  // Fallback timeout to ensure loading always resolves
  useEffect(() => {
    if (!pageLoading) {
      return;
    }
    const timer = setTimeout(() => setPageLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [pageLoading, rangeKey]);

  const maxDataPage = useMemo(() => {
    const pageCount = Math.ceil(dataRows.length / pageSize);
    return Math.max(pageCount - 1, 0);
  }, [dataRows.length, pageSize]);

  useEffect(() => {
    setDataPage((prev) => Math.min(prev, maxDataPage));
  }, [maxDataPage]);

  const pagedRows = useMemo(() => {
    const start = dataPage * pageSize;
    const end = start + pageSize;
    return dataRows.slice(start, end);
  }, [dataRows, dataPage, pageSize]);

  const selectedData = useMemo(() => {
    return data.find((item) => item.id === selectedDataId) ?? null;
  }, [data, selectedDataId]);

  const rankData = useMemo<RankData[]>(() => {
    if (!selectedData) {
      return [];
    }

    return _(selectedData.assets)
      .filter((asset) => asset.value > 1)
      .sortBy("value")
      .reverse()
      .map((asset, idx) => ({
        id: idx,
        assetId: asset.id,
        rank: idx + 1,
        amount: asset.amount,
        symbol: asset.symbol,
        value: asset.value,
        price: asset.price,
      }))
      .value();
  }, [selectedData]);

  const visibleRankData = useMemo(() => {
    const keyword = detailSearch.trim().toUpperCase();
    const filtered = keyword
      ? rankData.filter((item) => item.symbol.toUpperCase().includes(keyword))
      : rankData;
    return filtered.slice(0, detailLimit);
  }, [rankData, detailLimit, detailSearch]);

  const filteredRankDataCount = useMemo(() => {
    const keyword = detailSearch.trim().toUpperCase();
    if (!keyword) {
      return rankData.length;
    }
    return rankData.filter((item) =>
      item.symbol.toUpperCase().includes(keyword)
    ).length;
  }, [rankData, detailSearch]);

  const onDeletionUndoClick = useCallback(
    (rhd: {
      uuid?: string;
      id?: number;
      rhd: RestoreHistoricalData;
    }) => {
      restoreHistoricalData(rhd.rhd).then(() => {
        setIsModalOpen(false);

        if (afterDataChanged) {
          afterDataChanged("undoDeletion", rhd.uuid, rhd.id);
        }
      });
    },
    [afterDataChanged]
  );

  const onHistoricalDataDeleteClick = useCallback(
    (uuid: string) => {
      setDeleting(true);
      (async () => {
        const rhd = await queryRestoreHistoricalData(uuid);
        await deleteHistoricalDataByUUID(uuid);
        return rhd;
      })()
        .then((rhd) => {
          toast({
            description: "Record deleted",
            action: (
              <ToastAction
                altText="Restore deleted historical data"
                onClick={() =>
                  onDeletionUndoClick({
                    uuid,
                    rhd,
                  })
                }
              >
                Undo
              </ToastAction>
            ),
          });
          if (afterDataChanged) {
            afterDataChanged("delete", uuid, undefined);
          }
          setSelectedDataId(null);
          setIsModalOpen(false);
        })
        .catch((e) =>
          toast({
            description: e.message,
            variant: "destructive",
          })
        )
        .finally(() => {
          setDeleting(false);
        });
    },
    [afterDataChanged, onDeletionUndoClick, toast]
  );

  const onHistoricalDataDetailDeleteClick = useCallback(
    (id: number) => {
      setDeleting(true);
      (async () => {
        const rhd = await queryRestoreHistoricalData(id);
        await deleteHistoricalDataDetailById(id);
        return rhd;
      })()
        .then((rhd) => {
          toast({
            description: "Record deleted",
            action: (
              <ToastAction
                altText="Restore deleted historical record"
                onClick={() =>
                  onDeletionUndoClick({
                    id,
                    rhd,
                  })
                }
              >
                Undo
              </ToastAction>
            ),
          });
          if (afterDataChanged) {
            afterDataChanged("delete", undefined, id);
          }

          setData((prev) =>
            prev.map((record) => ({
              ...record,
              assets: record.assets.filter((asset) => asset.id !== id),
            }))
          );
        })
        .catch((e) =>
          toast({
            description: e.message,
            variant: "destructive",
          })
        )
        .finally(() => {
          setDeleting(false);
        });
    },
    [afterDataChanged, onDeletionUndoClick, toast]
  );

  const onRowClick = useCallback((id: string) => {
    setSelectedDataId(id);
    setDetailLimit(DETAIL_PAGE_SIZE);
    setDetailSearch("");
    setIsModalOpen(true);
  }, []);

  const emptyState = !pageLoading && dataRows.length === 0;
  const loadedRangeStart = dataRows.length ? dataPage * pageSize + 1 : 0;
  const loadedRangeEnd = Math.min((dataPage + 1) * pageSize, dataRows.length);
  const totalPages = maxDataPage + 1;
  const latestRow = dataRows[0] ?? null;

  return (
    <StaggerContainer className="space-y-4">
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSelectedDataId(null);
          }
        }}
      >
        <DialogContent className="min-w-[80%]">
          <DialogHeader>
            <DialogTitle>Historical Data Detail</DialogTitle>
            {selectedData ? (
              <p className="text-xs text-muted-foreground">
                {timeToDateStr(new Date(selectedData.createdAt).getTime(), true)}
                {" · "}
                {currency.symbol}
                {prettyNumberToLocaleString(
                  currencyWrapper(currency)(selectedData.total)
                )}
              </p>
            ) : null}
          </DialogHeader>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-sm font-medium text-muted-foreground">Assets</p>
              <p className="text-xl font-semibold">{rankData.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Value greater than $1
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-sm font-medium text-muted-foreground">
                Visible Rows
              </p>
              <p className="text-xl font-semibold">
                {Math.min(detailLimit, filteredRankDataCount)} /{" "}
                {filteredRankDataCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Increment by {DETAIL_PAGE_SIZE}
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-sm font-medium text-muted-foreground">Filter</p>
              <Input
                value={detailSearch}
                onChange={(e) => {
                  setDetailSearch(e.target.value);
                  setDetailLimit(DETAIL_PAGE_SIZE);
                }}
                placeholder="Search symbol, e.g. BTC"
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="w-full max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-[42px]">Rank</TableHead>
                  <TableHead className="h-[42px]">Asset</TableHead>
                  <TableHead className="h-[42px] text-right">Price</TableHead>
                  <TableHead className="h-[42px] text-right">Amount</TableHead>
                  <TableHead className="h-[42px] text-right">Value</TableHead>
                  <TableHead className="h-[42px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRankData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-6 text-center text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      No assets matched current filter
                    </TableCell>
                  </TableRow>
                ) : null}
                {visibleRankData.map((item) => {
                  const apiPath = logoMap[item.symbol] || UnknownLogo;
                  return (
                    <TableRow
                      key={"historical-data-detail-row-" + item.assetId}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="py-1.5 text-sm"># {item.rank}</TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-1 text-sm">
                          <img
                            className="inline-block w-[18px] h-[18px] rounded-full"
                            src={apiPath}
                            alt={item.symbol}
                          />
                          <p>{item.symbol}</p>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-sm">
                        {currency.symbol}
                        {prettyPriceNumberToLocaleString(
                          currencyWrapper(currency)(item.price)
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-sm">
                        {prettyNumberKeepNDigitsAfterDecimalPoint(item.amount, 4)}
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-sm">
                        {currency.symbol}
                        {prettyNumberToLocaleString(
                          currencyWrapper(currency)(item.value)
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="opacity-80 hover:opacity-100 transition-opacity"
                              disabled={deleting}
                            >
                              <img
                                src={DeleteIcon}
                                alt="delete"
                                style={{
                                  border: 0,
                                  height: 18,
                                  width: 18,
                                }}
                              />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Are you absolutely sure?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Deleting this asset may affect income and trend
                                calculations. Confirm to continue.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  onHistoricalDataDetailDeleteClick(item.assetId)
                                }
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
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
                ? "Show Less"
                : `Show More (${Math.min(
                    DETAIL_PAGE_SIZE,
                    filteredRankDataCount - detailLimit
                  )})`}
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <FadeUp>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{dataRows.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Historical snapshots stored
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Page Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {totalPages === 0 ? "0 / 0" : `${dataPage + 1} / ${totalPages}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Showing {loadedRangeStart}-{loadedRangeEnd}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latest Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {latestRow
                  ? `${currency.symbol}${prettyNumberToLocaleString(
                      currencyWrapper(currency)(latestRow.total)
                    )}`
                  : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {latestRow
                  ? timeToDateStr(new Date(latestRow.createdAt).getTime(), true)
                  : "No data"}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeUp>

      <FadeUp>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              History Records
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Click a row to view detailed holdings
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <div>
                {pageLoading ? "Loading..." : `Total ${dataRows.length} records`}
                {dataRows.length
                  ? ` · Showing ${loadedRangeStart}-${loadedRangeEnd}`
                  : ""}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setDataPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-[84px] text-sm">
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
                  onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
                  disabled={dataPage <= 0}
                >
                  <ChevronLeftIcon />
                </Button>
                <Select
                  value={String(dataPage)}
                  onValueChange={(v) => {
                    setDataPage(Number(v));
                  }}
                >
                  <SelectTrigger className="h-8 w-[120px] text-sm">
                    <SelectValue placeholder="Select Page" />
                  </SelectTrigger>
                  <SelectContent className="overflow-y-auto max-h-[20rem]">
                    <SelectGroup>
                      {_.range(maxDataPage + 1).map((pageIdx) => (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDataPage(Math.min(dataPage + 1, maxDataPage))}
                  disabled={dataPage >= maxDataPage}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>

            <div className="relative min-h-[300px]">
              <ScrollArea className="w-full max-h-[62vh] rounded-lg border border-border/40 bg-background/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-[42px]">Date</TableHead>
                      <TableHead className="h-[42px] text-right">Total</TableHead>
                      <TableHead className="h-[42px] text-right">Change</TableHead>
                      <TableHead className="h-[42px]">Assets</TableHead>
                      <TableHead className="h-[42px]">Opt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, idx) => {
                      const isLatest = dataPage === 0 && idx === 0;
                      const topAssets = _(row.assets)
                        .filter((asset) => asset.value > 0)
                        .sortBy("value")
                        .reverse()
                        .take(7)
                        .value();

                      return (
                        <TableRow
                          key={"historical-row-" + row.id}
                          className="group cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => onRowClick(row.id)}
                        >
                          <TableCell className="py-1.5 text-sm">
                            <div className="flex flex-col">
                              <span>
                                {timeToDateStr(new Date(row.createdAt).getTime(), true)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.id.slice(0, 8)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-sm font-semibold">
                            {currency.symbol}
                            {prettyNumberToLocaleString(
                              currencyWrapper(currency)(row.total)
                            )}
                          </TableCell>
                          <TableCell
                            className="py-1.5 text-right text-sm"
                            style={{
                              color: positiveNegativeColor(row.change ?? 0, quoteColor),
                            }}
                          >
                            {row.change === null
                              ? "-"
                              : `${row.change > 0 ? "+" : ""}${currency.symbol}${prettyNumberToLocaleString(
                                  currencyWrapper(currency)(Math.abs(row.change))
                                )}`}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <ImageStack
                                imageSrcs={topAssets.map(
                                  (asset) => logoMap[asset.symbol] || UnknownLogo
                                )}
                                imageWidth={18}
                                imageHeight={18}
                              />
                              <span className="text-xs text-muted-foreground">
                                {row.assets.length} assets
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            {isLatest ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    className="hidden group-hover:inline-block opacity-80 hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={deleting}
                                  >
                                    <img
                                      src={DeleteIcon}
                                      alt="delete"
                                      style={{
                                        border: 0,
                                        height: 18,
                                        width: 18,
                                      }}
                                    />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete latest record?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      The latest snapshot will be removed. You
                                      can restore it immediately via Undo.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        onHistoricalDataDeleteClick(row.id)
                                      }
                                    >
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div
                className={`absolute inset-0 z-10 rounded-lg backdrop-blur-md bg-background/60 transition-opacity duration-500 ${
                  pageLoading ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              />

              {emptyState ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-lg text-muted-foreground">
                    No historical records
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </FadeUp>
    </StaggerContainer>
  );
};

export default App;
