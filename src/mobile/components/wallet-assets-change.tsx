import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  WalletAssetsChangeData,
} from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { getWalletDisplayName } from "@/mobile/components/wallet-assets-percentage";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { WALLET_ANALYZER } from "@/middlelayers/charts-refresh";
import { getWalletLogo } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  WALLET_AIRDROP_URLS,
  WALLET_DETAIL_URLS,
} from "@/middlelayers/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupItem } from "@/components/ui/button-group";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import { MobileRecordList, SegmentedControl, useIsMobile } from "@/mobile/components/mobile";

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
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("changeValue");
  const [pageSize, setPageSize] = useState<PageSize>("50");
  const [dataPage, setDataPage] = useState(0);
  const dataChangedVersion = useDataChangedVersion();

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
      .catch(() => {
        if (!mounted || gen !== loadGenRef.current) {
          return;
        }
        setWalletAssetsChange([]);
      })
      .finally(() => {
        if (mounted) {
          reportLoaded();
        }
      });

    return () => {
      mounted = false;
    };
  }, [dateRange, reportLoaded, dataChangedVersion]);

  useEffect(() => {
    setDataPage(0);
  }, [deferredSearch, pageSize, sortMode]);

  const rows = useMemo(
    () =>
      walletAssetsChange.map((item) => ({
        ...item,
        walletTypeText:
          !item.walletType || item.walletType === "null"
            ? t("common.unknown")
            : item.walletType,
        walletAliasText: getWalletDisplayName({
          ...item,
          wallet: !item.wallet || item.wallet === "null" ? t("common.unknown") : item.wallet,
        }, isMobile),
      })),
    [walletAssetsChange, isMobile],
  );

  const filteredRows = useMemo(() => {
    if (!deferredSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const haystack =
        `${row.walletTypeText} ${row.walletAliasText} ${row.wallet}`.toLowerCase();
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
    [parsedPageSize, sortedRows.length],
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

  const loadedRangeStart = sortedRows.length
    ? safePage * parsedPageSize + 1
    : 0;
  const loadedRangeEnd = Math.min(
    (safePage + 1) * parsedPageSize,
    sortedRows.length,
  );

  return (
    <Card className="wallet-change-card">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("walletValueChanges.title")}
          </CardTitle>
          {isMobile ? <div className="wallet-change-summary">
            <span>{t("walletValueChanges.count").replace("{n}", String(rows.length))}</span>
            {summary.up > 0 && <span data-tone="gain">{t("walletValueChanges.upCount").replace("{n}", String(summary.up))}</span>}
            {summary.down > 0 && <span data-tone="loss">{t("walletValueChanges.downCount").replace("{n}", String(summary.down))}</span>}
          </div> : <div className="text-xs text-muted-foreground">
            {t("walletValueChanges.totalLabel")
              .replace("{n}", String(rows.length))
              .replace("{up}", String(summary.up))
              .replace("{down}", String(summary.down))
              .replace("{flat}", String(summary.flat))}
          </div>}
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(isMobile ? "walletValueChanges.searchMobile" : "walletValueChanges.searchPlaceholder")}
            className="md:w-[320px]"
          />
          <div className="wallet-change-controls flex flex-wrap gap-2">
            {isMobile ? <>
              <SegmentedControl value={sortMode} onChange={setSortMode} label={t("walletValueChanges.title")}
                options={[
                  { value: "changeValue", label: t("walletValueChanges.sortMobileValue") },
                  { value: "changePercentage", label: t("walletValueChanges.sortMobilePercent") },
                  { value: "absChange", label: t("walletValueChanges.sortMobileVolatility") },
                ]} />
            </> : <>
            <ButtonGroup
              value={sortMode}
              onValueChange={(v) => setSortMode(v as SortMode)}
            >
              <ButtonGroupItem value="changeValue">
                {t("walletValueChanges.sortByValue")}
              </ButtonGroupItem>
              <ButtonGroupItem value="changePercentage">
                {t("walletValueChanges.sortByPercent")}
              </ButtonGroupItem>
              <ButtonGroupItem value="absChange">
                {t("walletValueChanges.sortByVolatility")}
              </ButtonGroupItem>
            </ButtonGroup>
            <ButtonGroup
              value={pageSize}
              onValueChange={(v) => setPageSize(v as PageSize)}
            >
              <ButtonGroupItem value="20">20</ButtonGroupItem>
              <ButtonGroupItem value="50">50</ButtonGroupItem>
              <ButtonGroupItem value="100">100</ButtonGroupItem>
            </ButtonGroup>
            </>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isMobile && <MobileRecordList className="wallet-change-mobile-list" records={pageRows.map((row) => {
          const detailUrl = getWalletDetailUrl(row.wallet, row.walletType);
          const airdropUrl = getWalletAirdropUrl(row.wallet, row.walletType);
          const change = `${row.changeValue < 0 ? "-" : row.changeValue > 0 ? "+" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(row.changeValue)))}`;
          return {
            id: `${row.wallet}-${row.walletType}`, title: row.walletAliasText,
            subtitle: <span className={getToneClass(row.changeValue, quoteColor)}>{change}</span>,
            fields: [
              { label: t("walletValueChanges.col.type"), value: row.walletTypeText },
              { label: t("walletValueChanges.col.alias"), value: row.walletAliasText },
              { label: t("walletValueChanges.col.percentage"), value: formatSignedNumber(row.changePercentage, "%") },
              { label: t("walletValueChanges.col.value"), value: change },
            ],
            actions: [
              ...(detailUrl ? [{ label: t("walletValueChanges.openDetails"), onClick: () => { void openUrl(detailUrl); } }] : []),
              ...(airdropUrl ? [{ label: t("walletValueChanges.openAirdrop"), onClick: () => { void openUrl(airdropUrl); } }] : []),
            ],
          };
        })} />}
        {!isMobile && <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  {t("walletValueChanges.col.type")}
                </TableHead>
                <TableHead>{t("walletValueChanges.col.alias")}</TableHead>
                <TableHead className="text-right">
                  {t("walletValueChanges.col.percentage")}
                </TableHead>
                <TableHead className="text-right">
                  {t("walletValueChanges.col.value")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const detailUrl = getWalletDetailUrl(
                  row.wallet,
                  row.walletType,
                );
                const airdropUrl = getWalletAirdropUrl(
                  row.wallet,
                  row.walletType,
                );

                return (
                  <TableRow
                    key={`${row.wallet}-${row.walletType}`}
                    className="h-[42px] group"
                  >
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5 text-sm">
                        {row.walletTypeText === "Unknown" ? (
                          <span>{t("common.unknown")}</span>
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
                                className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block touch:inline-block cursor-pointer"
                                onClick={() => openUrl(detailUrl)}
                                alt="detail"
                              />
                            )}
                            {airdropUrl && (
                              <img
                                src={AirdropIcon}
                                className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block touch:inline-block cursor-pointer"
                                onClick={() => openUrl(airdropUrl)}
                                alt="airdrop"
                              />
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">
                      {row.walletAliasText}
                    </TableCell>
                    <TableCell
                      className={`py-1.5 text-right text-sm ${getToneClass(row.changePercentage, quoteColor)}`}
                    >
                      {formatSignedNumber(row.changePercentage, "%")}
                    </TableCell>
                    <TableCell
                      className={`py-1.5 text-right text-sm ${getToneClass(row.changeValue, quoteColor)}`}
                    >
                      {row.changeValue < 0
                        ? "-"
                        : row.changeValue > 0
                          ? "+"
                          : ""}
                      {currency.symbol}
                      {prettyNumberToLocaleString(
                        currencyWrapper(currency)(Math.abs(row.changeValue)),
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>}

        {sortedRows.length === 0 && (
          <div className="flex items-center justify-center text-lg text-muted-foreground py-6">
            {t("walletValueChanges.noData")}
          </div>
        )}

        {sortedRows.length > 0 && (!isMobile || pageCount > 1) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {!isMobile && <div>
              {t("walletValueChanges.showing")
                .replace("{start}", String(loadedRangeStart))
                .replace("{end}", String(loadedRangeEnd))
                .replace("{total}", String(sortedRows.length))}
            </div>}
            <div className="flex items-center gap-2">
              <Button
                variant={isMobile ? "ghost" : "outline"}
                size="sm"
                disabled={safePage === 0}
                aria-label={t("walletValueChanges.prev")}
                onClick={() => setDataPage((prev) => Math.max(0, prev - 1))}
              >
                {t("walletValueChanges.prev")}
              </Button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant={isMobile ? "ghost" : "outline"}
                size="sm"
                disabled={safePage >= pageCount - 1}
                aria-label={t("walletValueChanges.next")}
                onClick={() =>
                  setDataPage((prev) => Math.min(pageCount - 1, prev + 1))
                }
              >
                {t("walletValueChanges.next")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
