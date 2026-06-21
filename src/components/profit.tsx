import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
} from "@/utils/currency";
import { calculateTotalProfit } from "@/middlelayers/charts";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import _ from "lodash";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { positiveNegativeColor } from "@/utils/color";
import { Link } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import AssetLabel from "@/components/common/asset-label";
import {
  buildAssetDetailsPath,
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import { useTranslation } from "@/i18n";

function getToneClass(value: number, quoteColor: QuoteColor) {
  if (value === 0) {
    return "text-muted-foreground";
  }
  const positiveIsGreen = quoteColor === "green-up-red-down";
  const positiveClass = positiveIsGreen ? "text-emerald-500" : "text-rose-500";
  const negativeClass = positiveIsGreen ? "text-rose-500" : "text-emerald-500";
  return value > 0 ? positiveClass : negativeClass;
}

function getToneBadgeClass(value: number, quoteColor: QuoteColor) {
  const tone = positiveNegativeColor(value, quoteColor);
  if (tone === "green") {
    return "bg-emerald-500/15 text-emerald-500";
  }
  if (tone === "red") {
    return "bg-rose-500/15 text-rose-500";
  }
  return "bg-muted text-muted-foreground";
}

const App = ({
  currency,
  dateRange,
  quoteColor,
  showCoinsProfitPercentage = false,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  showCoinsProfitPercentage?: boolean;
}) => {
  const { t } = useTranslation();
  const [total, setTotal] = useState(0);
  const [totalPercentage, setTotalPercentage] = useState<number | undefined>(
    undefined,
  );
  const [coins, setCoins] = useState<
    {
      symbol: string;
      assetType: "crypto" | "stock";
      value: number;
      percentage?: number;
      buyAmount: number;
      sellAmount: number;
    }[]
  >([]);
  const [logoMap, setLogoMap] = useState<{ [k: string]: string }>({});
  const appCacheDirRef = useRef("");
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadProfit();
  }, [rangeKey]);

  async function loadProfit() {
    let didReport = false;
    const reportOnce = () => {
      if (didReport) return;
      didReport = true;
      reportLoaded();
    };
    try {
      const acd = await getAppCacheDir();
      appCacheDirRef.current = acd;
      const tp = await calculateTotalProfit(dateRange);
      setTotal(tp.total);
      setTotalPercentage(tp.percentage);
      setCoins(
        _(tp.coins)
          .orderBy(["value"], ["desc"])
          .take(50)
          .map((c) => ({
            symbol: c.symbol,
            assetType: c.assetType,
            value: c.value,
            percentage: c.percentage,
            buyAmount: c.buyAmount,
            sellAmount: c.sellAmount,
          }))
          .value()
      );
      // Report loaded as soon as data is ready; logo lookups
      // are best-effort and should not block loading.
      reportOnce();
      const symbols = _(tp.coins)
        .filter((c) => shouldDownloadCryptoLogo(c))
        .map((c) => ({ symbol: c.symbol, price: 0 }))
        .value();
      const kvs = await bluebird.map(symbols, async (s) => ({
        [getAssetLogoKey(s)]: await getImageApiPath(acd, s.symbol),
      }));
      setLogoMap((prev) => ({ ...prev, ..._.assign({}, ...kvs) }));
    } catch (err) {
      reportOnce();
      throw err;
    }
  }

  const totalProfit = total;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("profit.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">
              {t("profit.totalProfit")}
            </div>
            <div
              className={`text-xl font-semibold font-mono tabular-nums ${getToneClass(
                total,
                quoteColor,
              )}`}
            >
              {currency.symbol}
              {prettyNumberToLocaleString(currencyWrapper(currency)(total))}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalPercentage === undefined
                ? "∞"
                : `${totalPercentage >= 0 ? "+" : ""}${prettyNumberToLocaleString(
                    totalPercentage,
                  )}%`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {t("profit.viewAllCoins")}
            </div>
            <Link
              to="/comparison"
              className="text-sm text-primary inline-flex items-center gap-1"
            >
              {t("profit.viewAllCoins")}
              <OpenInNewWindowIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${getToneBadgeClass(
              totalProfit,
              quoteColor,
            )}`}
          >
            {t("profit.total")}: {currency.symbol}
            {prettyNumberToLocaleString(currencyWrapper(currency)(totalProfit))}
          </span>
        </div>
        {coins.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-muted-foreground mb-1">
              {t("profit.coinsProfit")}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px] py-1.5 text-xs text-muted-foreground font-mono">
                    #
                  </TableHead>
                  <TableHead>{t("profit.coin")}</TableHead>
                  <TableHead className="text-right">{t("profit.value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coins.slice(0, 6).map((d, idx) => (
                  <TableRow key={getAssetLogoKey(d)} className="h-[42px]">
                    <TableCell className="w-[36px] py-1.5 text-xs text-muted-foreground font-mono">
                      #{idx + 1}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Link
                        to={buildAssetDetailsPath(d)}
                        aria-label={t("overview.openAssetDetails", {
                          symbol: formatAssetLabel(d),
                        })}
                        className="group inline-flex flex-row items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <img
                          className="inline-block w-[18px] h-[18px] mr-2 rounded-full"
                          src={resolveAssetLogoSrc(d, logoMap[getAssetLogoKey(d)])}
                          alt={formatAssetLabel(d)}
                        />
                        <AssetLabel
                          asset={d}
                          className="min-w-0"
                          labelClassName="font-medium text-sm"
                        />
                        <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block text-muted-foreground" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right py-1.5">
                      <div className={`text-sm ${getToneClass(d.value, quoteColor)}`}>
                        {(d.value < 0 ? "-" : "+") +
                          currency.symbol +
                          prettyNumberToLocaleString(
                            currencyWrapper(currency)(Math.abs(d.value)),
                          )}
                      </div>
                      {showCoinsProfitPercentage && (
                        <div className="text-xs text-muted-foreground">
                          {(d.percentage || 0) < 0 ? "" : "+"}
                          {d.percentage === undefined
                            ? "∞"
                            : prettyNumberKeepNDigitsAfterDecimalPoint(d.percentage, 2)}
                          %
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
