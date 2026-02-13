import _ from "lodash";
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
import { useEffect, useState } from "react";
import { WALLET_ANALYZER } from "@/middlelayers/charts";
import { getWalletLogo } from "@/lib/utils";
import { positiveNegativeColor } from "@/utils/color";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  WALLET_AIRDROP_URLS,
  WALLET_DETAIL_URLS,
} from "@/middlelayers/constants";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  async function loadData() {
    const wac = await WALLET_ANALYZER.queryWalletAssetsChange();
    setWalletAssetsChange(wac);
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

  function getWalletDetailUrl(wallet: string, walletType?: string) {
    return WALLET_DETAIL_URLS[walletType ?? ""]?.(wallet);
  }

  function onWalletDetailClick(wallet: string, walletType?: string) {
    const url = getWalletDetailUrl(wallet, walletType);
    if (url) {
      openUrl(url);
    }
  }

  function getWalletAirdropUrl(wallet: string, walletType?: string) {
    return WALLET_AIRDROP_URLS[walletType ?? ""]?.(wallet);
  }

  function onWalletAirdropClick(wallet: string, walletType?: string) {
    const url = getWalletAirdropUrl(wallet, walletType);
    console.log(url);

    if (url) {
      openUrl(url);
    }
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Value Changes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex ">
            <div className="w-[100%] overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Wallet Type</TableHead>
                    <TableHead>Wallet Alias</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletAssetsChange.map((d) => (
                        <TableRow key={d.wallet} className="h-[42px] group">
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
                                {getWalletDetailUrl(d.wallet, d.walletType) && (
                                  <img
                                    src={MoneyBankIcon}
                                    className="h-5 w-5 text-muted-foreground hidden group-hover:inline-block cursor-pointer"
                                    onClick={() =>
                                      onWalletDetailClick(
                                        d.wallet,
                                        d.walletType
                                      )
                                    }
                                  ></img>
                                )}

                                {getWalletAirdropUrl(
                                  d.wallet,
                                  d.walletType
                                ) && (
                                  <img
                                    src={AirdropIcon}
                                    className="h-4 w-4 mt-0.5 text-muted-foreground hidden group-hover:inline-block cursor-pointer"
                                    onClick={() =>
                                      onWalletAirdropClick(
                                        d.wallet,
                                        d.walletType
                                      )
                                    }
                                  ></img>
                                )}
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
