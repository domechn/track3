import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { calculateTotalProfit } from "@/middlelayers/charts";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { loadingWrapper } from "@/utils/loading";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import _ from "lodash";
import { Skeleton } from "./ui/skeleton";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";

type TopType = "profitTop" | "lossTop";

const App = ({
  currency,
  // version is used for reloading data
  version,
}: {
  currency: CurrencyRateDetail;
  version: number;
}) => {
  const [profit, setProfit] = useState(0);
  const [coinsProfit, setCoinsProfit] = useState<
    {
      symbol: string;
      value: number;
    }[]
  >([]);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [topType, setTopType] = useState<TopType>("profitTop");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    calculateTotalProfit()
      .then((res) => {
        setProfit(res.total);
        setCoinsProfit(_(res.coins).sortBy("value").value());

        // set logo map
        getLogoMap(res.coins).then((m) => setLogoMap(m));
      })
      .finally(() => setLoading(false));
  }, [version]);

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

  function getProfitDisplayColor(val: number) {
    if (val === 0) {
      return "gray";
    }

    return val > 0 ? "green" : "red";
  }

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
            <div className="text-2xl font-bold">
              {currency.symbol +
                prettyNumberToLocaleString(currencyWrapper(currency)(profit))}
            </div>,
            "h-[32px]"
          )}

          <ButtonGroup
            defaultValue="profitTop"
            onValueChange={(val: TopType) => onTypeSelectChange(val)}
          >
            <ButtonGroupItem value="profitTop">Profit Top</ButtonGroupItem>
            <ButtonGroupItem value="lossTop">Loss Top</ButtonGroupItem>
          </ButtonGroup>

          <Table>
            <TableBody>
              {loading
                ? _(5)
                    .range()
                    .map((i) => (
                      <TableRow key={"coin-profit-row-loading-" + i}>
                        <TableCell>
                          <Skeleton className="my-[10px] h-[20px] w-[100%]" />
                        </TableCell>
                      </TableRow>
                    ))
                    .value()
                : topTypeData.map((d) => (
                    <TableRow key={d.symbol} className="h-[55px]">
                      <TableCell>
                        <div className="flex flex-row items-center">
                          <img
                            className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                            src={logoMap[d.symbol] || UnknownLogo}
                            alt={d.symbol}
                          />
                          <div className="font-bold text-base">{d.symbol}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`text-${getProfitDisplayColor(
                            d.value
                          )}-600`}
                        >
                          {currency.symbol +
                            prettyNumberToLocaleString(
                              currencyWrapper(currency)(d.value)
                            )}
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
