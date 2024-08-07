import {
  listAllowedSymbols,
  loadAllAssetActionsBySymbol,
  queryAssetMaxAmountBySymbol,
  queryLastAssetsBySymbol,
  updateAssetPrice,
} from "@/middlelayers/charts";
import {
  Asset,
  AssetAction,
  CurrencyRateDetail,
  TDateRange,
} from "@/middlelayers/types";
import _ from "lodash";
import { useEffect, useMemo, useState } from "react";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { useNavigate, useParams } from "react-router-dom";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { getImageApiPath } from "@/utils/app";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { timeToDateStr } from "@/utils/date";
import {
  CaretSortIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { toast } from "./ui/use-toast";
import CoinsAmountAndValueChange from "./coins-amount-and-value-change";
import { Skeleton } from "./ui/skeleton";
import { loadingWrapper } from "@/lib/loading";
import WalletAssetsPercentage from "./wallet-assets-percentage";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { cn } from "@/lib/utils";

const App = ({
  currency,
  dateRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
}) => {
  const { symbol } = useParams() as { symbol: string };
  const navigate = useNavigate();
  const pageSize = 20;

  const [loading, setLoading] = useState<boolean>(false);

  const [dataPage, setDataPage] = useState<number>(0);

  const [actions, setActions] = useState<AssetAction[]>([]);
  const [lastAsset, setLastAsset] = useState<Asset | undefined>();
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [updatePriceIndex, setUpdatePriceIndex] = useState("");
  const [updatePriceValue, setUpdatePriceValue] = useState(-1);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);

  const [maxPosition, setMaxPosition] = useState<number>(0);

  const [coinSelectOpen, setCoinSelectOpen] = useState(false);
  const [walletAliasMap, setWalletAliasMap] = useState<{
    [k: string]: string | undefined;
  }>({});

  const [logo, setLogo] = useState("");

  const [allowSymbols, setAllowSymbols] = useState<string[]>([]);

  useEffect(() => {
    loadAllowedSymbols();
  }, []);

  useEffect(() => {
    loadSymbolData(symbol).then(() => {
      setInitialLoaded(true);
    });

    // reset pagination
    setDataPage(0);
  }, [symbol, dateRange]);

  async function getLogoPath(symbol: string) {
    const acd = await getAppCacheDir();
    return getImageApiPath(acd, symbol);
  }

  useEffect(() => {
    if (actions.length === 0) {
      return;
    }

    // init wallet alias map
    const wa = new WalletAnalyzer(async () => []);
    wa.listWalletAliases(
      _(actions).map("wallet").compact().uniq().value()
    ).then((res) => {
      const wam: { [k: string]: string | undefined } = {};
      _(res).forEach((k, v) => {
        wam[v] = k?.alias ? `${k?.alias} (${k.type})` : k?.wallet;
      });
      setWalletAliasMap(wam);
    });
  }, [actions]);

  const breakevenPrice = useMemo(
    () => Math.max(0, calculateBreakevenPrice(actions, lastAsset)),
    [actions, lastAsset]
  );

  const profit = useMemo(
    () => calculateProfit(actions, lastAsset),
    [lastAsset, actions]
  );

  const breakEvenPriceStr = useMemo(
    () =>
      breakevenPrice === 0 && profit < 0
        ? "∞"
        : currency.symbol +
          prettyPriceNumberToLocaleString(
            currencyWrapper(currency)(breakevenPrice)
          ),
    [currency, breakevenPrice, profit]
  );

  const costPrice = useMemo(() => calculateCostPrice(actions), [actions]);
  const costPriceStr = useMemo(
    () =>
      currency.symbol +
      prettyPriceNumberToLocaleString(currencyWrapper(currency)(costPrice)),
    [currency, costPrice]
  );
  const lastPrice = useMemo(() => lastAsset?.price || 0, [lastAsset]);
  const lastPriceStr = useMemo(
    () =>
      currency.symbol +
      prettyPriceNumberToLocaleString(currencyWrapper(currency)(lastPrice)),
    [currency, lastPrice]
  );

  const rank = useMemo(() => {
    const rankNum = _(allowSymbols).indexOf(symbol) + 1;
    if (rankNum === 0) {
      return "-";
    }

    return "#" + rankNum;
  }, [symbol, allowSymbols]);

  const profitStr = useMemo(
    () =>
      currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(currency)(profit)),
    [currency, profit]
  );

  const maxPositionStr = useMemo(
    () => prettyNumberKeepNDigitsAfterDecimalPoint(maxPosition, 8),
    [maxPosition]
  );

  const profitRate = useMemo(() => {
    const costPrice = calculateCostPrice(actions);
    if (costPrice <= 0) {
      return "∞";
    }
    if (!lastAsset?.amount) {
      return "-";
    }
    const latestAvgPrice = lastAsset.value / lastAsset.amount;
    return ((latestAvgPrice - costPrice) / costPrice * 100).toFixed(2);
  }, [lastAsset, actions]);

  function getAssetActionIndex(act: AssetAction) {
    return `${act.uuid}-${act.assetID}`;
  }

  async function loadSymbolData(s: string) {
    updateLoading(true);
    try {
      const aa = await loadAllAssetActionsBySymbol(s);
      setActions(_(aa).sortBy("changedAt").reverse().value());

      const la = await queryLastAssetsBySymbol(s);
      setLastAsset(la);

      const ama = await queryAssetMaxAmountBySymbol(s);
      setMaxPosition(ama);

      const lp = await getLogoPath(s);
      setLogo(lp);
    } finally {
      updateLoading(false);
    }
  }

  async function loadAllowedSymbols() {
    const ss = await listAllowedSymbols();
    setAllowSymbols(ss);
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }
    setLoading(val);
  }

  function calculateBreakevenPrice(acts: AssetAction[], la?: Asset) {
    return la && la.amount ? calculateBreakevenValue(acts) / la.amount : 0;
  }

  function calculateBreakevenValue(acts: AssetAction[]) {
    return _(acts).sumBy((a) => a.amount * a.price);
  }

  function calculateCostPrice(acts: AssetAction[]) {
    const totalBuyValue = calculateBuyValue(acts);
    const totalBuyAmount = _(acts)
      .filter((a) => a.amount > 0)
      .sumBy((a) => a.amount);

    return totalBuyAmount ? totalBuyValue / totalBuyAmount : 0;
  }

  function calculateBuyValue(acts: AssetAction[]) {
    return _(acts)
      .filter((a) => a.amount > 0)
      .sumBy((a) => a.amount * a.price);
  }

  function calculateProfit(acts: AssetAction[], la?: Asset) {
    return la ? la.value - calculateBreakevenValue(acts) : 0;
  }

  function onUpdatePriceDialogSaveClick() {
    if (!symbol) {
      toast({
        description: "Invalid symbol",
        variant: "destructive",
      });
      return;
    }
    if (updatePriceValue < 0) {
      toast({
        description: "Invalid price",
        variant: "destructive",
      });
      return;
    }
    const actIndex = _(actions).findIndex(
      (act) => getAssetActionIndex(act) === updatePriceIndex
    );
    if (actIndex === -1) {
      toast({
        description: "Invalid action",
        variant: "destructive",
      });
      return;
    }
    const act = actions[actIndex];

    const usdPrice = updatePriceValue / currency.rate;

    updateAssetPrice(
      act.uuid,
      act.assetID,
      symbol,
      usdPrice,
      act.changedAt
    ).then(() => {
      const newActions = [...actions];
      newActions[actIndex].price = usdPrice;
      setActions(newActions);
      setUpdatePriceDialogOpen(false);
      setUpdatePriceIndex("");
      setUpdatePriceValue(-1);
    });
  }

  function HistoryTable() {
    const historicalData = useMemo(() => {
      const start = dateRange.start.toISOString();
      const end = dateRange.end.toISOString();
      return _(actions)
        .filter((a) => a.changedAt >= start && a.changedAt <= end)
        .value();
    }, [actions, dateRange]);

    const maxDataPage = useMemo(() => {
      // - 0.000000000001 is for float number precision
      const mp = Math.floor(historicalData.length / pageSize - 0.000000000001);
      return mp >= 0 ? mp : 0;
    }, [historicalData]);

    const tableHasData = useMemo(
      () => !_(historicalData).isEmpty(),
      [historicalData]
    );

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex space-x-2 py-1 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
              disabled={dataPage <= 0}
            >
              <ChevronLeftIcon />
            </Button>
            <div className="text-muted-foreground text-sm">
              {dataPage + 1} {"/"} {maxDataPage + 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDataPage(Math.min(dataPage + 1, maxDataPage))}
              disabled={dataPage >= maxDataPage}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[300px]">Buy/Sell Price</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? _(10)
                    .range()
                    .map((i) => (
                      <TableRow key={"coin-analytics-history-loading-" + i}>
                        {_(4)
                          .range()
                          .map((j) => (
                            <TableCell
                              key={`coin-analytics-history-loading-${i}-${j}`}
                            >
                              <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                            </TableCell>
                          ))
                          .value()}
                      </TableRow>
                    ))
                    .value()
                : historicalData
                    .slice(dataPage * pageSize, (dataPage + 1) * pageSize)
                    .map((act, i) => (
                      <TableRow key={i} className="h-[55px] group">
                        <TableCell>
                          <div className="flex flex-row items-center">
                            <div
                              className="mr-1 font-bold text-base"
                              title={"" + act.amount}
                            >
                              {act.amount > 0 ? "+" : "-"}
                              {/* use pretty price to avoid amount is supper small */}
                              {prettyPriceNumberToLocaleString(
                                Math.abs(act.amount)
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <div className="text-gray-600">
                              {currency.symbol}
                              {prettyPriceNumberToLocaleString(
                                currencyWrapper(currency)(act.price)
                              )}
                            </div>
                            <Pencil2Icon
                              className="h-[20px] w-[20px] cursor-pointer hidden group-hover:inline-block text-gray-600"
                              onClick={() => {
                                setUpdatePriceIndex(getAssetActionIndex(act));
                                setUpdatePriceValue(act.price);
                                setUpdatePriceDialogOpen(true);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-600">
                            {act.amount > 0 ? "+" : "-"}
                            {currency.symbol}
                            {prettyPriceNumberToLocaleString(
                              currencyWrapper(currency)(
                                Math.abs(act.price * act.amount)
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-600">
                            {timeToDateStr(
                              new Date(act.changedAt).getTime(),
                              true
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            {act.wallet ? walletAliasMap[act.wallet] || "" : ""}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>

          {!tableHasData && (
            <div className="flex items-center justify-center">
              <div className="text-xl text-gray-300 m-auto">
                No Historical Data For Selected Dates
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Dialog
        open={updatePriceDialogOpen}
        onOpenChange={setUpdatePriceDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Buy/Sell Price</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              type="number"
              defaultValue={currencyWrapper(currency)(updatePriceValue)}
              onChange={(e) => {
                if (!e.target.value || e.target.value === "0.") {
                  return;
                }
                if (+e.target.value < 0) {
                  toast({
                    description: "Invalid price",
                    variant: "destructive",
                  });
                  return;
                }
                setUpdatePriceValue(+e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdatePriceDialogSaveClick();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit" onClick={onUpdatePriceDialogSaveClick}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-4 grid-cols-4">
        <div className="col-span-4 md:col-span-1 sm:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Symbol</CardTitle>
              <svg
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="2876"
                className="h-4 w-4 text-muted-foreground"
              >
                <path
                  d="M580.8 468.8H448c-38.4 0-68.8-30.4-68.8-64s30.4-64 68.8-64h192c25.6 0 43.2-17.6 43.2-43.2s-17.6-43.2-43.2-43.2h-84.8v-43.2c0-25.6-17.6-43.2-43.2-43.2s-43.2 17.6-43.2 43.2V256h-17.6c-84.8 0-153.6 68.8-153.6 148.8s68.8 148.8 153.6 148.8h132.8c38.4 0 68.8 30.4 68.8 64s-33.6 64-72 64H384c-25.6 0-43.2 17.6-43.2 43.2S358.4 768 384 768h84.8v43.2c0 25.6 17.6 43.2 43.2 43.2s43.2-17.6 43.2-43.2V768h25.6c84.8 0 153.6-68.8 153.6-148.8s-68.8-150.4-153.6-150.4z"
                  p-id="2877"
                  fill="#2c2c2c"
                ></path>
                <path
                  d="M512 0C230.4 0 0 230.4 0 512s230.4 512 512 512 512-230.4 512-512S793.6 0 512 0z m0 939.2c-235.2 0-427.2-192-427.2-427.2S276.8 84.8 512 84.8s427.2 192 427.2 427.2-192 427.2-427.2 427.2z"
                  p-id="2878"
                  fill="#2c2c2c"
                ></path>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="flex">
                <img
                  className="inline-block w-[32px] h-[32px] mr-2 rounded-full py-[2px]"
                  src={logo || UnknownLogo}
                  alt={symbol}
                />
                <div className="w-[100%] h-[32px] overflow-hidden">
                  <Popover
                    open={coinSelectOpen}
                    onOpenChange={setCoinSelectOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={coinSelectOpen}
                        className="h-[100%] w-[100%] text-2xl font-bold border-none shadow-none focus:ring-0 flex justify-between items-center"
                      >
                        <div>{symbol}</div>
                        <CaretSortIcon className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[100%] p-1">
                      <Command>
                        <CommandInput
                          placeholder="Search coin..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No coin found.</CommandEmpty>
                          <CommandGroup>
                            {allowSymbols.map((s) => (
                              <CommandItem
                                key={s}
                                value={s}
                                onSelect={(v) => {
                                  setCoinSelectOpen(false);
                                  navigate(`/coins/${v}`);
                                }}
                              >
                                <div>{s}</div>
                                <CheckIcon
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    s === symbol ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex space-x-1">
                <div>rank:</div>
                {loadingWrapper(loading, <div>{rank}</div>, "h-[16px]")}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-4 md:col-span-1 sm:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium overflow-hidden whitespace-nowrap overflow-ellipsis">
                Breakeven Price
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
                {loadingWrapper(
                  loading,
                  <div>{breakEvenPriceStr}</div>,
                  "h-[28px] mb-[4px]"
                )}
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex  space-x-1">
                <div>last price:</div>
                {loadingWrapper(loading, <div>{lastPriceStr}</div>, "h-[16px]")}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-4 md:col-span-1 sm:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
              <svg
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1885"
                className="h-4 w-4 text-muted-foreground"
              >
                <path
                  d="M162.016 580.992L192.032 640q-31.008 30.016-32 64 4 64 102.496 111.008T512.032 864q151.008-2.016 249.504-48.992T864.032 704q-0.992-34.016-32-64l31.008-59.008q31.008 26.016 48 56.992T928.032 704q-4.992 99.008-123.008 160.512T512.032 928q-175.008-2.016-292.992-63.488T96.032 704q0-35.008 17.504-66.016t48.512-56.992z m0-192L192.032 448q-31.008 30.016-32 64 4 64 102.496 111.008T512.032 672q151.008-2.016 249.504-48.992T864.032 512q-0.992-34.016-32-64l31.008-59.008q31.008 26.016 48 56.992T928.032 512q-4.992 99.008-123.008 160.512T512.032 736q-175.008-2.016-292.992-63.488T96.032 512q0-35.008 17.504-66.016t48.512-56.992zM512 544q-175.008-2.016-292.992-63.488T96 320q4.992-99.008 123.008-160.512T512 96q175.008 2.016 292.992 63.488T928 320q-4.992 99.008-123.008 160.512T512 544z m0-64q151.008-2.016 249.504-48.992T864 320q-4-64-102.496-111.008T512 160q-151.008 2.016-249.504 48.992T160 320q4 64 102.496 111.008T512 480z"
                  p-id="1886"
                  fill="#515151"
                ></path>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
                {loadingWrapper(
                  loading,
                  <div>{profitStr}</div>,
                  "h-[28px] mb-[4px]"
                )}
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex  space-x-1">
                <div>profit rate:</div>
                {loadingWrapper(loading, <div>{profitRate}%</div>, "h-[16px]")}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-4 md:col-span-1 sm:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost Price</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
                {loadingWrapper(
                  loading,
                  <div>{costPriceStr}</div>,
                  "h-[28px] mb-[4px]"
                )}
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex  space-x-1">
                <div>max pos:</div>
                {loadingWrapper(
                  loading,
                  <div>{maxPositionStr}</div>,
                  "h-[16px]"
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <CoinsAmountAndValueChange
        currency={currency}
        symbol={symbol}
        dateRange={dateRange}
      />
      <WalletAssetsPercentage
        currency={currency}
        dateRange={dateRange}
        symbol={symbol}
      />
      <HistoryTable />
    </div>
  );
};

export default App;
