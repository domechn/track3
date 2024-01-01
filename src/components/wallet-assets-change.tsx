import _ from "lodash";
import {
  CurrencyRateDetail,
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
import { Skeleton } from './ui/skeleton'

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const [loading, setLoading] = useState(false);
  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const wac = await WALLET_ANALYZER.queryWalletAssetsChange();
      setWalletAssetsChange(wac);
    } finally {
      setLoading(false);
    }
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
    if (value < 0) {
      return "red";
    } else if (value > 0) {
      return "green";
    }
    return "gray";
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
                          <TableRow
                            key={"wallet-assets-change-loading-" + i}
                          >
                            <TableCell>
                              <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="my-[5px] h-[20px] w-[100%]" />
                            </TableCell>
                          </TableRow>
                        ))
                        .value()
                    : walletAssetsChange.map((d) => (
                        <TableRow key={d.wallet}>
                          <TableCell className="font-medium">
                            {!d.walletType || d.walletType === "null"
                              ? "Unknown"
                              : tweakWalletType(d.walletType)}
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
