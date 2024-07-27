import { useEffect, useMemo, useState, useCallback } from "react";
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
import { loadingWrapper } from "@/lib/loading";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import _ from "lodash";
import { Skeleton } from "./ui/skeleton";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { positiveNegativeColor } from "@/utils/color";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";

type TopType = "profitTop" | "lossTop";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const [profit, setProfit] = useState(0);
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
  const [topType, setTopType] = useState<TopType>("profitTop");
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Memoize the callback to prevent unnecessary rerenders
  const updateLoading = useCallback(
    (val: boolean) => {
      if (initialLoaded) {
        return;
      }
      setLoading(val);
    },
    [initialLoaded]
  );

  // Memoize the callback for handling type selection change
  const onTypeSelectChange = useCallback((val: TopType) => {
    setTopType(val);
  }, []);

  // Load data and update state when dateRange changes
  useEffect(() => {
    const loadData = async () => {
      updateLoading(true);
      try {
        const res = await calculateTotalProfit(dateRange);
        setProfit(res.total);
        setProfitPercentage(res.percentage);
        setCoinsProfit(_(res.coins).sortBy("value").value());
        setInitialLoaded(true);
        const logoMap = await getLogoMap(res.coins);
        setLogoMap(logoMap);
      } finally {
        updateLoading(false);
      }
    };
    loadData();
  }, [dateRange, updateLoading]);

  // Memoize the function to get logo map
  const getLogoMap = useCallback(async (d: { symbol: string }[]) => {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(d, async (coin) => {
      const path = await getImageApiPath(acd, coin.symbol);
      return { [coin.symbol]: path };
    });
    return _.assign({}, ...kvs);
  }, []);

  // Memoize the topTypeData to prevent unnecessary calculations
  const topTypeData = useMemo(() => {
    const size = 5;
    return topType === "profitTop"
      ? _(coinsProfit).takeRight(size).reverse().value()
      : _(coinsProfit).take(size).value();
  }, [coinsProfit, topType]);

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 placeholder">
          {loadingWrapper(
            loading,
            <div className="text-2xl font-bold flex space-x-2 items-end">
              <div>
                {(profit < 0 ? "-" : "+") +
                  currency.symbol +
                  prettyNumberToLocaleString(
                    currencyWrapper(currency)(Math.abs(profit))
                  )}
              </div>
              <div className="text-base text-gray-500">
                {profitPercentage === undefined
                  ? "∞"
                  : prettyNumberKeepNDigitsAfterDecimalPoint(
                      profitPercentage,
                      2
                    )}
                %
              </div>
            </div>,
            "h-[32px]"
          )}

          <ButtonGroup
            defaultValue="profitTop"
            onValueChange={onTypeSelectChange}
          >
            <ButtonGroupItem value="profitTop">Profit Top</ButtonGroupItem>
            <ButtonGroupItem value="lossTop">Loss Top</ButtonGroupItem>
          </ButtonGroup>

          <Table>
            <TableBody>
              {loading
                ? _.range(5).map((i) => (
                    <TableRow key={"coin-profit-row-loading-" + i}>
                      <TableCell>
                        <Skeleton className="my-[10px] h-[20px] w-[100%]" />
                      </TableCell>
                    </TableRow>
                  ))
                : topTypeData.map((d) => (
                    <TableRow
                      key={d.symbol}
                      className="h-[55px] cursor-pointer group"
                      onClick={() => navigate(`/coins/${d.symbol}`)}
                    >
                      <TableCell>
                        <div className="flex flex-row items-center">
                          <img
                            className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                            src={logoMap[d.symbol] || UnknownLogo}
                            alt={d.symbol}
                          />
                          <div className="font-bold text-base">{d.symbol}</div>
                          <OpenInNewWindowIcon className="ml-2 h-4 w-4 hidden group-hover:inline-block text-gray-600" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`text-${positiveNegativeColor(
                            d.value,
                            quoteColor
                          )}-600`}
                        >
                          {(d.value < 0 ? "-" : "+") +
                            currency.symbol +
                            prettyNumberToLocaleString(
                              currencyWrapper(currency)(Math.abs(d.value))
                            )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {d.value < 0 ? "" : "+"}
                          {d.percentage === undefined
                            ? "∞"
                            : prettyNumberKeepNDigitsAfterDecimalPoint(
                                d.percentage,
                                2
                              )}
                          %
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
