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
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import _ from "lodash";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { positiveNegativeColor } from "@/utils/color";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

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
  showCoinsProfitPercentage,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  showCoinsProfitPercentage?: boolean;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const [profit, setProfit] = useState(0);
  // note: undefined means infinite
  const [profitPercentage, setProfitPercentage] = useState<
    number | undefined
  >();
  const [coinsProfit, setCoinsProfit] = useState<
    {
      symbol: string;
      percentage?: number;
      value: number;
    }[]
  >([]);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const navigate = useNavigate();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const loadGenRef = useRef(0);
  const logoPathCacheRef = useRef<Map<string, string>>(new Map());

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    const gen = ++loadGenRef.current;

    calculateTotalProfit(dateRange)
      .then(async (res) => {
        if (gen !== loadGenRef.current) {
          return;
        }

        const sortedCoins = _(res.coins).sortBy("value").value();
        setProfit(res.total);
        setProfitPercentage(res.percentage);
        setCoinsProfit(sortedCoins);

        const symbols = _(
          sortedCoins.slice(0, 5).concat(sortedCoins.slice(-5))
        )
          .map((coin) => coin.symbol)
          .uniq()
          .value();
        const m = await getLogoMap(symbols);
        if (gen !== loadGenRef.current) {
          return;
        }
        setLogoMap((prev) => ({ ...prev, ...m }));
      })
      .finally(() => {
        if (gen === loadGenRef.current) {
          reportLoaded();
        }
      });
  }, [rangeKey]);

  const topProfitData = useMemo(
    () => _(coinsProfit).takeRight(5).reverse().value(),
    [coinsProfit]
  );
  const topLossData = useMemo(() => _(coinsProfit).take(5).value(), [coinsProfit]);

  const totalToneClass = useMemo(
    () => getToneClass(profit, quoteColor),
    [profit, quoteColor]
  );
  const totalToneBadgeClass = useMemo(
    () => getToneBadgeClass(profit, quoteColor),
    [profit, quoteColor]
  );
  const positiveCount = useMemo(
    () => coinsProfit.filter((coin) => coin.value > 0).length,
    [coinsProfit]
  );
  const negativeCount = useMemo(
    () => coinsProfit.filter((coin) => coin.value < 0).length,
    [coinsProfit]
  );

  async function getLogoMap(symbols: string[]) {
    const acd = await getAppCacheDir();
    const symbolsNeedLoad = symbols.filter(
      (symbol) => !logoPathCacheRef.current.has(symbol)
    );

    if (symbolsNeedLoad.length === 0) {
      return symbols.reduce((acc, symbol) => {
        const path = logoPathCacheRef.current.get(symbol);
        if (path) {
          acc[symbol] = path;
        }
        return acc;
      }, {} as { [x: string]: string });
    }

    const kvs = await bluebird.map(
      symbolsNeedLoad,
      async (symbol) => {
        const path = await getImageApiPath(acd, symbol);
        logoPathCacheRef.current.set(symbol, path);
        return { [symbol]: path };
      },
      { concurrency: 6 }
    );

    const cachedMap = symbols.reduce((acc, symbol) => {
      const path = logoPathCacheRef.current.get(symbol);
      if (path) {
        acc[symbol] = path;
      }
      return acc;
    }, {} as { [x: string]: string });

    return _.assign({}, ...kvs, cachedMap);
  }

  const renderRows = (
    rows: {
      symbol: string;
      percentage?: number;
      value: number;
    }[],
    rankStart = 1
  ) =>
    rows.map((d, idx) => (
      <TableRow
        key={d.symbol}
        className="h-[42px] cursor-pointer group"
        onClick={() => navigate(`/coins/${d.symbol}`)}
      >
        <TableCell className="w-[36px] py-1.5 text-xs text-muted-foreground font-mono">
          #{rankStart + idx}
        </TableCell>
        <TableCell className="py-1.5">
          <div className="flex flex-row items-center">
            <img
              className="inline-block w-[18px] h-[18px] mr-2 rounded-full"
              src={logoMap[d.symbol] || UnknownLogo}
              alt={d.symbol}
            />
            <div className="font-medium text-sm">{d.symbol}</div>
            <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block text-muted-foreground" />
          </div>
        </TableCell>
        <TableCell className="text-right py-1.5">
          <div className={`text-sm ${getToneClass(d.value, quoteColor)}`}>
            {(d.value < 0 ? "-" : "+") +
              currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(Math.abs(d.value))
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
    ));

  return (
    <Card>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Profit
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Total {coinsProfit.length} coins | Up {positiveCount} | Down{" "}
            {negativeCount}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <div className={`text-xl font-semibold ${totalToneClass}`}>
              {(profit < 0 ? "-" : "+") +
                currency.symbol +
                prettyNumberToLocaleString(
                  currencyWrapper(currency)(Math.abs(profit))
                )}
            </div>
            <div className="text-xs text-muted-foreground">
              Net PnL For Selected Range
            </div>
          </div>
          <div
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${totalToneBadgeClass}`}
          >
            {profitPercentage === undefined
              ? "∞"
              : prettyNumberKeepNDigitsAfterDecimalPoint(profitPercentage, 2)}
            %
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">
              Top Profit
            </div>
            <Table>
              <TableBody>{renderRows(topProfitData)}</TableBody>
            </Table>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">
              Top Loss
            </div>
            <Table>
              <TableBody>{renderRows(topLossData)}</TableBody>
            </Table>
          </div>
        </div>
        {coinsProfit.length === 0 && (
          <div className="flex items-center justify-center text-lg text-muted-foreground py-6">
            No Available Data For Selected Dates
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
