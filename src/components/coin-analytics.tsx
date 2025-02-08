import {
  calculateTotalProfit,
  listAllowedSymbols,
  queryAssetMaxAmountBySymbol,
  queryLastAssetsBySymbol,
  queryTransactionsBySymbolAndDateRange,
  updateTransactionPrice,
  updateTransactionTxnType,
} from "@/middlelayers/charts";
import {
  Asset,
  AssetAction,
  CurrencyRateDetail,
  TDateRange,
  Transaction,
  TransactionType,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface UpdatePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updatePriceValue: number;
  setUpdatePriceValue: (value: number) => void;
  onSave: () => void;
  currency: CurrencyRateDetail;
}

export const UpdatePriceDialog = ({
  open,
  onOpenChange,
  updatePriceValue,
  setUpdatePriceValue,
  onSave,
  currency,
}: UpdatePriceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onSave();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button type="submit" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface UpdateTransactionTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateTxnTypeValue?: TransactionType;
  setUpdateTxnTypeValue: (value: TransactionType) => void;
  onSave: () => void;
}

export const UpdateTransactionTypeDialog = ({
  open,
  onOpenChange,
  updateTxnTypeValue,
  setUpdateTxnTypeValue,
  onSave,
}: UpdateTransactionTypeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[250px]">
        <DialogHeader>
          <DialogTitle>Update Txn Type</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Select
            onValueChange={(e) => setUpdateTxnTypeValue(e as TransactionType)}
            value={updateTxnTypeValue}
          >
            <SelectTrigger>
              <SelectValue placeholder="Transaction Type" />
            </SelectTrigger>
            <SelectContent className="overflow-y-auto max-h-[20rem]">
              <SelectGroup>
                <SelectItem value="sell">sell</SelectItem>
                <SelectItem value="buy">buy</SelectItem>
                <SelectItem value="withdraw">withdraw</SelectItem>
                <SelectItem value="deposit">deposit</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastAsset, setLastAsset] = useState<Asset | undefined>();
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [buyAmount, setBuyAmount] = useState<number>(0);
  const [sellAmount, setSellAmount] = useState<number>(0);
  const [costAvgPrice, setCostAvgPrice] = useState<number>(0);
  const [sellAvgPrice, setSellAvgPrice] = useState<number>(0);

  const [profit, setProfit] = useState<number>(0);
  const [profitPercentage, setProfitPercentage] = useState<
    number | undefined
  >();

  const [updateTxnId, setUpdateTxnId] = useState<number>(0);
  const [updatePriceValue, setUpdatePriceValue] = useState(-1);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);

  const [updateTxnTypeValue, setUpdateTxnTypeValue] = useState<
    TransactionType | undefined
  >();
  const [updateTxnDialogOpen, setUpdateTxnTypeDialogOpen] = useState(false);

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
    if (transactions.length === 0) {
      return;
    }

    // init wallet alias map
    const wa = new WalletAnalyzer(async () => []);
    wa.listWalletAliases(
      _(transactions).map("wallet").compact().uniq().value()
    ).then((res) => {
      const wam: { [k: string]: string | undefined } = {};
      _(res).forEach((k, v) => {
        wam[v] = k?.alias ? `${k?.alias} (${k.type})` : k?.wallet;
      });
      setWalletAliasMap(wam);
    });
  }, [transactions]);

  const breakevenPrice = useMemo(() => {
    if (!lastAsset) {
      return;
    }
    if (lastAsset.amount === 0) {
      return profit > 0 ? 0 : undefined;
    }
    return (lastAsset.price * lastAsset.amount - profit) / lastAsset.amount;
  }, [profit, lastAsset]);

  const breakEvenPriceStr = useMemo(
    () =>
      breakevenPrice === undefined
        ? "∞"
        : currency.symbol +
          prettyPriceNumberToLocaleString(
            currencyWrapper(currency)(_.max([breakevenPrice, 0]) || 0)
          ),
    [currency, breakevenPrice]
  );

  const sellPriceStr = useMemo(
    () =>
      currency.symbol +
      prettyPriceNumberToLocaleString(currencyWrapper(currency)(sellAvgPrice)),
    [currency, sellAvgPrice]
  );
  const sellAmountStr = useMemo(() => prettyAmount(sellAmount), [sellAmount]);

  const costPriceStr = useMemo(
    () =>
      currency.symbol +
      prettyPriceNumberToLocaleString(currencyWrapper(currency)(costAvgPrice)),
    [currency, costAvgPrice]
  );
  const buyAmountStr = useMemo(() => prettyAmount(buyAmount), [buyAmount]);
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

  const positionsStr = useMemo(
    () => prettyAmount(lastAsset?.amount || 0),
    [lastAsset]
  );
  const maxPositionsStr = useMemo(
    () => prettyAmount(maxPosition),
    [maxPosition]
  );

  const profitRate = useMemo(
    () => (profitPercentage ? profitPercentage.toFixed(2) : 0),
    [profitPercentage]
  );

  function prettyAmount(amount: number) {
    return amount >= 1
      ? prettyNumberKeepNDigitsAfterDecimalPoint(amount, 4)
      : prettyPriceNumberToLocaleString(amount);
  }

  async function loadSymbolData(s: string) {
    updateLoading(true);
    try {
      const txns = await queryTransactionsBySymbolAndDateRange(s, dateRange);
      setTransactions(txns);

      const tp = await calculateTotalProfit(
        {
          start: new Date(1970, 0, 1),
          end: new Date(2999, 12, 30, 23, 59, 59),
        },
        s
      );
      const la = await queryLastAssetsBySymbol(s);
      setLastAsset(la);

      const ama = await queryAssetMaxAmountBySymbol(s);
      setMaxPosition(ama);

      const lp = await getLogoPath(s);
      setLogo(lp);

      const detail = _(tp.coins).find((c) => c.symbol === s);
      if (!detail) {
        return;
      }

      setBuyAmount(detail.buyAmount);
      setSellAmount(detail.sellAmount);
      setCostAvgPrice(detail.costAvgPrice);
      setSellAvgPrice(detail.sellAvgPrice);

      setProfit(tp.total);
      setProfitPercentage(tp.percentage);
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
    const txnIndex = _(transactions).findIndex((act) => act.id === updateTxnId);
    if (txnIndex === -1) {
      toast({
        description: "Invalid action",
        variant: "destructive",
      });
      return;
    }
    const act = transactions[txnIndex];

    const usdPrice = updatePriceValue / currency.rate;

    updateTransactionPrice(act.id, usdPrice).then(() => {
      const newTxns = [...transactions];
      newTxns[txnIndex].price = usdPrice;
      setTransactions(newTxns);
      setUpdatePriceDialogOpen(false);
      setUpdateTxnId(0);
      setUpdatePriceValue(-1);
    });
  }

  function onUpdateTxnTypeDialogSaveClick() {
    if (!symbol) {
      toast({
        description: "Invalid symbol",
        variant: "destructive",
      });
      return;
    }
    if (!updateTxnTypeValue) {
      toast({
        description: "Invalid txnType",
        variant: "destructive",
      });
      return;
    }
    const txnIndex = _(transactions).findIndex((act) => act.id === updateTxnId);
    if (txnIndex === -1) {
      toast({
        description: "Invalid action",
        variant: "destructive",
      });
      return;
    }
    const act = transactions[txnIndex];

    updateTransactionTxnType(act.id, updateTxnTypeValue).then(() => {
      const newTxns = [...transactions];
      newTxns[txnIndex].txnType = updateTxnTypeValue;
      setTransactions(newTxns);
      setUpdateTxnTypeDialogOpen(false);
      setUpdateTxnId(0);
      setUpdateTxnTypeValue(undefined);
    });
  }

  function HistoryTable() {
    const historicalData = useMemo(() => transactions, [transactions]);

    const maxDataPage = useMemo(() => {
      // - 0.000000000001 is for float number precision
      const mp = Math.floor(historicalData.length / pageSize - 0.000000000001);
      return mp >= 0 ? mp : 0;
    }, [historicalData]);

    const tableHasData = useMemo(
      () => !_(historicalData).isEmpty(),
      [historicalData]
    );

    const getAmountStr = (act: Transaction) => {
      const raw = prettyPriceNumberToLocaleString(act.amount);
      if (act.txnType === "sell" || act.txnType === "withdraw") {
        return `-${raw}`;
      }
      if (act.txnType === "buy" || act.txnType === "deposit") {
        return `+${raw}`;
      }
      return raw;
    };

    const getValueStr = (act: Transaction) => {
      const raw = `${currency.symbol}${prettyPriceNumberToLocaleString(
        currencyWrapper(currency)(act.price * act.amount)
      )}`;
      if (act.txnType === "sell") {
        return `-${raw}`;
      }
      if (act.txnType === "buy") {
        return `+${raw}`;
      }
      return "0";
    };

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
                <TableHead className="w-[120px]">Type</TableHead>
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
                              {getAmountStr(act)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <div className="text-gray-600">{act.txnType}</div>
                            <Pencil2Icon
                              className="h-[20px] w-[20px] cursor-pointer hidden group-hover:inline-block text-gray-600"
                              onClick={() => {
                                setUpdateTxnId(act.id);
                                setUpdateTxnTypeValue(act.txnType);
                                setUpdateTxnTypeDialogOpen(true);
                              }}
                            />
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
                                setUpdateTxnId(act.id);
                                setUpdatePriceValue(act.price);
                                setUpdatePriceDialogOpen(true);
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-600">
                            {getValueStr(act)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-600">
                            {timeToDateStr(
                              new Date(act.txnCreatedAt).getTime(),
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
      <UpdatePriceDialog
        open={updatePriceDialogOpen}
        onOpenChange={setUpdatePriceDialogOpen}
        updatePriceValue={updatePriceValue}
        setUpdatePriceValue={setUpdatePriceValue}
        onSave={onUpdatePriceDialogSaveClick}
        currency={currency}
      />

      <UpdateTransactionTypeDialog
        open={updateTxnDialogOpen}
        onOpenChange={setUpdateTxnTypeDialogOpen}
        updateTxnTypeValue={updateTxnTypeValue}
        setUpdateTxnTypeValue={setUpdateTxnTypeValue}
        onSave={onUpdateTxnTypeDialogSaveClick}
      />
      <div className="grid gap-4 grid-cols-6">
        <div className="col-span-6 md:col-span-2 sm:col-span-3">
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
                        <div className='truncate'>{symbol}</div>
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
        <div className="col-span-6 md:col-span-2 sm:col-span-3">
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
        <div className="col-span-6 md:col-span-2 sm:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positions</CardTitle>
              <svg
                className="h-4 w-4 text-muted-foreground"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="3273"
                width="16"
                height="16"
              >
                <path
                  d="M205.971 159.72c23.856-65.521 103.802-93.332 177.05-66.675L804.79 246.58H836.8c68.04 0 123.2 55.162 123.2 123.204v123.204a33.602 33.602 0 0 1-33.6 33.6c-37.114 0-67.2 30.088-67.2 67.203 0 37.114 30.086 67.202 67.2 67.202 18.557 0 33.6 15.043 33.6 33.6v123.204C960 885.838 904.84 941 836.8 941H187.2C119.16 941 64 885.838 64 817.796V694.593c0-18.558 15.043-33.601 33.6-33.601 37.114 0 67.2-30.088 67.2-67.202 0-37.115-30.086-67.202-67.2-67.202-18.557 0-33.6-15.044-33.6-33.601V369.783c0-63.618 48.216-115.98 110.096-122.52l31.875-87.542z m630 153.291H792.66l-0.067 0.168-0.493-0.179-606.07 0.011c-14.86 0-29.112 5.9-39.62 16.402A55.983 55.983 0 0 0 130 369.01v93.832c58.002 14.918 100.853 67.534 100.853 130.164 0 62.629-42.851 115.245-100.853 130.163v93.832a55.983 55.983 0 0 0 16.41 39.597A56.045 56.045 0 0 0 186.03 873h649.94c14.86 0 29.112-5.9 39.62-16.402A55.983 55.983 0 0 0 892 817.001V723.17c-58.002-14.918-100.853-67.534-100.853-130.163 0-62.63 42.851-115.246 100.853-130.164V369.01a55.983 55.983 0 0 0-16.41-39.597 56.045 56.045 0 0 0-39.62-16.402zM645.4 634c18.557 0 33.6 15.222 33.6 34s-15.043 34-33.6 34H376.6c-18.557 0-33.6-15.222-33.6-34s15.043-34 33.6-34h268.8z m0-157c18.557 0 33.6 15.222 33.6 34s-15.043 34-33.6 34H376.6c-18.557 0-33.6-15.222-33.6-34s15.043-34 33.6-34h268.8zM359.018 156.031c-40.828-14.807-80.807-0.959-90.796 26.392L245 246h362l-247.982-89.969z"
                  fill="#515151"
                  p-id="3274"
                ></path>
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
                {loadingWrapper(
                  loading,
                  <div>{positionsStr}</div>,
                  "h-[28px] mb-[4px]"
                )}
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex  space-x-1">
                <div>max positions:</div>
                {loadingWrapper(
                  loading,
                  <div>{maxPositionsStr}</div>,
                  "h-[16px]"
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-6 md:col-span-2 sm:col-span-3">
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
        <div className="col-span-6 md:col-span-2 sm:col-span-3">
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
                <div>buy amount:</div>
                {loadingWrapper(loading, <div>{buyAmountStr}</div>, "h-[16px]")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-6 md:col-span-2 sm:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sell Price</CardTitle>
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
                  <div>{sellPriceStr}</div>,
                  "h-[28px] mb-[4px]"
                )}
              </div>
              <div className="text-xs text-muted-foreground overflow-hidden whitespace-nowrap overflow-ellipsis flex  space-x-1">
                <div>sell amount:</div>
                {loadingWrapper(
                  loading,
                  <div>{sellAmountStr}</div>,
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
        displayAmount={true}
      />
      <HistoryTable />
    </div>
  );
};

export default App;
