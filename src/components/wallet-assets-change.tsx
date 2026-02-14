import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  WalletAssetsChangeData,
} from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { insertEllipsis } from "@/utils/string";
import MoneyBankIcon from "@/assets/icons/money-bank-icon.png";
import AirdropIcon from "@/assets/icons/airdrop-icon.png";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WALLET_ANALYZER } from "@/middlelayers/charts";
import { getWalletLogo } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  WALLET_AIRDROP_URLS,
  WALLET_DETAIL_URLS,
} from "@/middlelayers/constants";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

type SortMode = "changeValue" | "changePercentage" | "absChange";
type PageSize = "20" | "50" | "100";

function getWalletDetailUrl(wallet: string, walletType?: string) {
  return WALLET_DETAIL_URLS[walletType ?? ""]?.(wallet);
}

function getWalletAirdropUrl(wallet: string, walletType?: string) {
  return WALLET_AIRDROP_URLS[walletType ?? ""]?.(wallet);
}

function getToneClass(value: number, quoteColor: QuoteColor) {
  if (value === 0) {
    return "text-muted-foreground";
  }
  const positiveIsGreen = quoteColor === "green-up-red-down";
  const positiveClass = positiveIsGreen ? "text-emerald-500" : "text-rose-500";
  const negativeClass = positiveIsGreen ? "text-rose-500" : "text-emerald-500";
  return value > 0 ? positiveClass : negativeClass;
}

function formatSignedNumber(value: number, suffix = "") {
  if (value > 0) {
    return `+${prettyNumberToLocaleString(value)}${suffix}`;
  }
  if (value < 0) {
    return `-${prettyNumberToLocaleString(Math.abs(value))}${suffix}`;
  }
  return `0${suffix}`;
}

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const loadGenRef = useRef(0);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("changeValue");
  const [pageSize, setPageSize] = useState<PageSize>("50");
  const [dataPage, setDataPage] = useState(0);

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    let mounted = true;
    const gen = ++loadGenRef.current;

    WALLET_ANALYZER.queryWalletAssetsChange()
      .then((wac) => {
        if (!mounted || gen !== loadGenRef.current) {
          return;
        }
        setWalletAssetsChange(wac);
      })
      .finally(() => {
        if (mounted) {
          reportLoaded();
        }
      });

    return () => {
      mounted = false;
    };
  }, [dateRange, reportLoaded]);

  useEffect(() => {
    setDataPage(0);
  }, [deferredSearch, pageSize, sortMode]);

  const rows = useMemo(
    () =>
      walletAssetsChange.map((item) => ({
        ...item,
        walletTypeText:
          !item.walletType || item.walletType === "null" ? "Unknown" : item.walletType,
        walletAliasText:
          item.walletAlias ??
          insertEllipsis(
            !item.wallet || item.wallet === "null" ? "Unknown" : item.wallet,
            32
          ),
      })),
    [walletAssetsChange]
  );

  const filteredRows = useMemo(() => {
    if (!deferredSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack = `${row.walletTypeText} ${row.walletAliasText} ${row.wallet}`.toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, rows]);

  const sortedRows = useMemo(() => {
    const next = [...filteredRows];

    next.sort((a, b) => {
      if (sortMode === "changePercentage") {
        return b.changePercentage - a.changePercentage;
      }
      if (sortMode === "absChange") {
        return Math.abs(b.changeValue) - Math.abs(a.changeValue);
      }
      return b.changeValue - a.changeValue;
    });

    return next;
  }, [filteredRows, sortMode]);

  const parsedPageSize = Number(pageSize);
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(sortedRows.length / parsedPageSize)),
    [parsedPageSize, sortedRows.length]
  );

  const safePage = Math.min(dataPage, pageCount - 1);
  const pageRows = useMemo(() => {
    const start = safePage * parsedPageSize;
    return sortedRows.slice(start, start + parsedPageSize);
  }, [parsedPageSize, safePage, sortedRows]);

  const summary = useMemo(() => {
    let up = 0;
    let down = 0;
    let flat = 0;

    rows.forEach((row) => {
      if (row.changeValue > 0) {
        up += 1;
      } else if (row.changeValue < 0) {
        down += 1;
      } else {
        flat += 1;
      }
    });

    return { up, down, flat };
  }, [rows]);

  const loadedRangeStart = sortedRows.length ? safePage * parsedPageSize + 1 : 0;
  const loadedRangeEnd = Math.min((safePage + 1) * parsedPageSize, sortedRows.length);

  return (
    <Card>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Value Changes
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Total {rows.length} wallets | Up {summary.up} | Down {summary.down} | Flat {summary.flat}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallet type / alias / address"
            className="md:w-[320px]"
          />
          <div className="flex flex-wrap gap-2">
            <ButtonGroup value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <ButtonGroupItem value="changeValue">By Value</ButtonGroupItem>
              <ButtonGroupItem value="changePercentage">By %</ButtonGroupItem>
              <ButtonGroupItem value="absChange">By Volatility</ButtonGroupItem>
            </ButtonGroup>
            <ButtonGroup value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
              <ButtonGroupItem value="20">20</ButtonGroupItem>
              <ButtonGroupItem value="50">50</ButtonGroupItem>
              <ButtonGroupItem value="100">100</ButtonGroupItem>
            </ButtonGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Wallet Type</TableHead>
                <TableHead>Wallet Alias</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const detailUrl = getWalletDetailUrl(row.wallet, row.walletType);
                const airdropUrl = getWalletAirdropUrl(row.wallet, row.walletType);

                return (
                  <TableRow key={`${row.wallet}-${row.walletType}`} className="h-[42px] group">
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5 text-sm">
                        {row.walletTypeText === "Unknown" ? (
                          <span>Unknown</span>
                        ) : (
                          <>
                            <img
                              className="w-[18px] h-[18px] rounded-full"
                              src={getWalletLogo(row.walletTypeText)}
                              alt={row.walletTypeText}
                            />
                            <span>{row.walletTypeText}</span>
                            {detailUrl && (
                              <img
                                src={MoneyBankIcon}
                                className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block cursor-pointer"
                                onClick={() => openUrl(detailUrl)}
                                alt="detail"
                              />
                            )}
                            {airdropUrl && (
                              <img
                                src={AirdropIcon}
                                className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block cursor-pointer"
                                onClick={() => openUrl(airdropUrl)}
                                alt="airdrop"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">{row.walletAliasText}</TableCell>
                    <TableCell className={`py-1.5 text-right text-sm ${getToneClass(row.changePercentage, quoteColor)}`}>
                      {formatSignedNumber(row.changePercentage, "%")}
                    </TableCell>
                    <TableCell className={`py-1.5 text-right text-sm ${getToneClass(row.changeValue, quoteColor)}`}>
                      {row.changeValue < 0 ? "-" : row.changeValue > 0 ? "+" : ""}
                      {currency.symbol}
                      {prettyNumberToLocaleString(
                        currencyWrapper(currency)(Math.abs(row.changeValue))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {sortedRows.length === 0 && (
          <div className="flex items-center justify-center text-lg text-muted-foreground py-6">
            No Available Data For Selected Dates
          </div>
        )}

        {sortedRows.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing {loadedRangeStart}-{loadedRangeEnd} / {sortedRows.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setDataPage((prev) => Math.max(0, prev - 1))}
              >
                Prev
              </Button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setDataPage((prev) => Math.min(pageCount - 1, prev + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
