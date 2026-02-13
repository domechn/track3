import { useContext, useEffect, useMemo, useState } from "react";
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
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { positiveNegativeColor } from "@/utils/color";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

type TopType = "profitTop" | "lossTop";

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
  const [topType, setTopType] = useState<TopType>("profitTop");
  const navigate = useNavigate();
  const { reportLoaded } = useContext(OverviewLoadingContext);

  useEffect(() => {
    calculateTotalProfit(dateRange)
      .then((res) => {
        setProfit(res.total);
        setProfitPercentage(res.percentage);
        setCoinsProfit(_(res.coins).sortBy("value").value());

        // set logo map
        getLogoMap(res.coins).then((m) => setLogoMap(m));
      })
      .finally(() => reportLoaded());
  }, [dateRange]);

  const topTypeData = useMemo(() => {
    const size = 5;

    return topType === "profitTop"
      ? _(coinsProfit).takeRight(size).reverse().value()
      : _(coinsProfit).take(5).value();
  }, [coinsProfit, topType]);

  async function getLogoMap(d: { symbol: string }[]) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(d, async (coin) => {
      const path = await getImageApiPath(acd, coin.symbol);
      return { [coin.symbol]: path };
    });

    return _.assign({}, ...kvs);
  }

  function onTypeSelectChange(val: TopType) {
    setTopType(val);
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xl font-semibold flex space-x-2 items-baseline">
            <div>
              {(profit < 0 ? "-" : "+") +
                currency.symbol +
                prettyNumberToLocaleString(
                  currencyWrapper(currency)(Math.abs(profit))
                )}
            </div>
            <div className="text-sm text-muted-foreground">
              {profitPercentage === undefined
                ? "∞"
                : prettyNumberKeepNDigitsAfterDecimalPoint(
                    profitPercentage,
                    2
                  )}
              %
            </div>
          </div>

          <ButtonGroup
            defaultValue="profitTop"
            onValueChange={(val: TopType) => onTypeSelectChange(val)}
          >
            <ButtonGroupItem value="profitTop">Profit Top</ButtonGroupItem>
            <ButtonGroupItem value="lossTop">Loss Top</ButtonGroupItem>
          </ButtonGroup>

          <Table>
            <TableBody>
              {topTypeData.map((d) => (
                <TableRow
                  key={d.symbol}
                  className="h-[42px] cursor-pointer group"
                  onClick={() => navigate(`/coins/${d.symbol}`)}
                >
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
                    <div
                      className={`text-sm text-${positiveNegativeColor(
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
                    {showCoinsProfitPercentage && (
                      <div className="text-xs text-muted-foreground">
                        {(d.percentage || 0) < 0 ? "" : "+"}
                        {d.percentage === undefined
                          ? "∞"
                          : prettyNumberKeepNDigitsAfterDecimalPoint(
                              d.percentage,
                              2
                            )}
                        %
                      </div>
                    )}
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
