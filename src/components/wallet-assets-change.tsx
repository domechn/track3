import _ from "lodash";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  WalletAssetsChangeData,
} from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { insertEllipsis } from "@/utils/string";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useEffect, useState } from "react";
import { WALLET_ANALYZER } from "@/middlelayers/charts";
import { Skeleton } from "./ui/skeleton";
import { getWalletLogo } from "@/lib/utils";
import { positiveNegativeColor } from "@/utils/color";
import { openUrl } from "@tauri-apps/plugin-opener";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);

  useEffect(() => {
    loadData().then(() => {
      setInitialLoaded(true);
    });
  }, [dateRange]);

  async function loadData() {
    updateLoading(true);
    try {
      const wac = await WALLET_ANALYZER.queryWalletAssetsChange();
      setWalletAssetsChange(wac);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }
    setLoading(val);
  }

  function getArrow(value: number) {
    if (value < 0) {
      return "↓";
    } else if (value > 0) {
      return "↑";
    }
    return "";
  }

  function getChangeClassName(value: number) {
    return positiveNegativeColor(value, quoteColor);
  }

  function getPositiveValue(value: number) {
    if (value < 0) {
      return -value;
    }
    return value;
  }

  function tweakWalletType(walletType: string) {
    return <span>{walletType}</span>;
  }

  function onWalletClick(wallet: string, walletType?: string) {
    if (walletType !== "ERC20") {
      return;
    }
    // jump to debank in browser
    const url = `https://debank.com/profile/${wallet}`;
    openUrl(url);
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Value Changes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex ">
            <div className="w-[100%] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet Type</TableHead>
                    <TableHead>Wallet Alias</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? _(5)
                        .range()
                        .map((i) => (
                          <TableRow key={"wallet-assets-change-loading-" + i}>
                            {_(4)
                              .range()
                              .map((j) => (
                                <TableCell
                                  key={`wallet-assets-change-loading-${i}-${j}`}
                                >
                                  <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                                </TableCell>
                              ))
                              .value()}
                          </TableRow>
                        ))
                        .value()
                    : walletAssetsChange.map((d) => (
                        <TableRow
                          key={d.wallet}
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => onWalletClick(d.wallet, d.walletType)}
                        >
                          <TableCell className="font-medium">
                            {!d.walletType || d.walletType === "null" ? (
                              <div>Unknown</div>
                            ) : (
                              <div className="flex space-x-1">
                                <img
                                  className="h-5 w-5 text-muted-foreground"
                                  src={getWalletLogo(d.walletType)}
                                ></img>
                                <div>{tweakWalletType(d.walletType)}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {d.walletAlias ??
                              insertEllipsis(
                                !d.wallet || d.wallet === "null"
                                  ? "Unknown"
                                  : d.wallet,
                                32
                              )}
                          </TableCell>
                          <TableCell
                            className={`text-${getChangeClassName(
                              d.changePercentage
                            )}-500`}
                          >
                            {getArrow(d.changePercentage)}
                            {prettyNumberToLocaleString(
                              getPositiveValue(d.changePercentage)
                            )}
                            %
                          </TableCell>
                          <TableCell
                            className={`text-right text-${getChangeClassName(
                              d.changePercentage
                            )}-500`}
                          >
                            {getArrow(d.changeValue)}
                            {currency.symbol}
                            {prettyNumberToLocaleString(
                              currencyWrapper(currency)(
                                getPositiveValue(d.changeValue)
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
