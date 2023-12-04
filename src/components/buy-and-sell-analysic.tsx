import {
  loadAllAssetActionsBySymbol,
  queryLastAssetsBySymbol,
  updateAssetPrice,
} from "@/middlelayers/charts";
import { Asset, AssetAction, CurrencyRateDetail } from "@/middlelayers/types";
import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { useParams } from "react-router-dom";
import {
  currencyWrapper,
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
import { timestampToDate } from "@/utils/date";
import { Pencil2Icon } from "@radix-ui/react-icons";
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

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const { symbol } = useParams();

  const [actions, setActions] = useState<AssetAction[]>([]);
  const [latestAsset, setLatestAsset] = useState<Asset | undefined>();

  const [updatePriceIndex, setUpdatePriceIndex] = useState(-1);
  const [updatePriceValue, setUpdatePriceValue] = useState(-1);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);

  const [breakevenPrice, setBreakevenPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [profit, setProfit] = useState<number>(0);

  const [walletAliasMap, setWalletAliasMap] = useState<{
    [k: string]: string | undefined;
  }>({});

  const [logo, setLogo] = useState("");

  useEffect(() => {
    if (symbol) {
      loadSymbolData(symbol);
    }
  }, [symbol]);

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

    const ap = Math.max(0, calculateBreakevenPrice(actions));
    setBreakevenPrice(ap);
    setProfit(calculateProfit(ap));

    setCostPrice(calculateCostPrice(actions));
  }, [actions]);

  function loadSymbolData(s: string) {
    loadAllAssetActionsBySymbol(s).then((res) => {
      setActions(_(res).sortBy('changedAt').reverse().value());
    });

    queryLastAssetsBySymbol(s).then((res) => {
      setLatestAsset(res);
    });

    getLogoPath(s).then((res) => {
      setLogo(res);
    });
  }

  function calculateBreakevenPrice(acts: AssetAction[]) {
    return latestAsset && latestAsset.amount
      ? _(acts).sumBy((a) => a.amount * a.price) / latestAsset.amount
      : 0;
  }

  function calculateCostPrice(acts: AssetAction[]) {
    const totalBuyValue = _(acts)
      .filter((a) => a.amount > 0)
      .sumBy((a) => a.amount * a.price);
    const totalBuyAmount = _(acts)
      .filter((a) => a.amount > 0)
      .sumBy((a) => a.amount);

    return totalBuyAmount ? totalBuyValue / totalBuyAmount : 0;
  }

  function calculateProfit(averagePrice: number) {
    return latestAsset
      ? latestAsset.value - averagePrice * latestAsset.amount
      : 0;
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
    const act = actions[updatePriceIndex];

    updateAssetPrice(
      act.uuid,
      act.assetID,
      symbol,
      updatePriceValue,
      act.changedAt
    ).then(() => {
      const newActions = [...actions];
      newActions[updatePriceIndex].price = updatePriceValue;
      setActions(newActions);
      setUpdatePriceDialogOpen(false);
      setUpdatePriceIndex(-1);
      setUpdatePriceValue(-1);
    });
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
              defaultValue={updatePriceValue}
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
        <div className="col-span-2 md:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              {/* TODO: quick switch coin */}
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
                  className="inline-block w-[32px] h-[32px] mr-2 rounded-full"
                  src={logo || UnknownLogo}
                  alt={symbol}
                />
                <div className="text-2xl font-bold">{symbol}</div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-2 md:col-span-1">
          <Card>
            {/* TODO: compare with latest price */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
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
                {currency.symbol +
                  prettyPriceNumberToLocaleString(
                    currencyWrapper(currency)(breakevenPrice)
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-2 md:col-span-1">
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
              <div className="text-2xl font-bold">
                {currency.symbol +
                  prettyNumberToLocaleString(currencyWrapper(currency)(profit))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-2 md:col-span-1">
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
                {currency.symbol +
                  prettyPriceNumberToLocaleString(
                    currencyWrapper(currency)(costPrice)
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-bold">
              History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead className="w-[300px]">Buy/Sell Price</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Wallet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((act, i) => (
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
                        <div className="flex">
                          <div className="text-gray-600">{currency.symbol}</div>
                          <div className="text-gray-600">
                            {prettyPriceNumberToLocaleString(
                              currencyWrapper(currency)(act.price)
                            )}
                          </div>
                        </div>
                        <Pencil2Icon
                          className="h-[20px] w-[20px] cursor-pointer hidden group-hover:inline-block text-gray-600"
                          onClick={() => {
                            setUpdatePriceIndex(i);
                            setUpdatePriceValue(act.price);
                            setUpdatePriceDialogOpen(true);
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-gray-600">
                        {timestampToDate(
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default App;
