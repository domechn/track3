import { Doughnut } from "react-chartjs-2";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
} from "@/middlelayers/types";
import { Card, CardContent } from "./ui/card";
import _ from "lodash";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import { getImageApiPath } from "@/utils/app";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { downloadCoinLogos } from "@/middlelayers/data";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import bluebird from "bluebird";
import { useNavigate } from "react-router-dom";
import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import {
  queryLatestAssetsPercentage,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { Skeleton } from "./ui/skeleton";
import { loadingWrapper } from "@/utils/loading";
import { ChartResizeContext } from "@/App";
import { offsetHoveredItemWrapper } from "@/utils/legend";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";

const chartName = "Percentage of Assets";

const App = ({
  currency,
  size,
  version,
}: {
  currency: CurrencyRateDetail;
  size: number;
  version: number;
}) => {
  const { needResize } = useContext(ChartResizeContext);
  const [dataPage, setDataPage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [latestAssetsPercentageData, setLatestAssetsPercentageData] =
    useState<LatestAssetsPercentageData>([]);
  const chartRef =
    useRef<ChartJSOrUndefined<"doughnut", number[], unknown>>(null);
  const pageSize = 5;
  const navigate = useNavigate();

  const percentageData = useMemo(() => {
    return splitTopAndOtherData(latestAssetsPercentageData);
  }, [latestAssetsPercentageData]);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});

  useEffect(() => {
    loadData().then(() => resizeChartWithDelay(chartName));
  }, [size, version]);

  useEffect(() => resizeChart(chartName), [needResize]);

  useEffect(() => {
    // download coin logos
    downloadCoinLogos(
      _(latestAssetsPercentageData)
        .map((d) => ({
          symbol: d.coin,
          price: d.value / (d.amount || 1),
        }))
        .value()
    );

    // set logo map
    getLogoMap(latestAssetsPercentageData).then((m) => setLogoMap(m));
  }, [latestAssetsPercentageData]);

  async function loadData() {
    setLoading(true);
    try {
      const lap = await queryLatestAssetsPercentage();
      setLatestAssetsPercentageData(lap);
    } finally {
      setLoading(false);
    }
  }

  const maxDataPage = useMemo(() => {
    // - 0.000000000001 is for float number precision
    const mp = Math.floor(
      latestAssetsPercentageData.length / pageSize - 0.000000000001
    );
    return mp >= 0 ? mp : 0;
  }, [latestAssetsPercentageData]);

  async function getLogoMap(d: LatestAssetsPercentageData) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(d, async (coin) => {
      const path = await getImageApiPath(acd, coin.coin);
      return { [coin.coin]: path };
    });

    return _.assign({}, ...kvs);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    layout: {
      padding: 20,
    },
    plugins: {
      // text is set for resizing
      title: { display: false, text: chartName },
      legend: {
        display: true,
        position: "right",
        font: {
          size: 13,
        },
        labels: { font: {} },
        onHover: offsetHoveredItemWrapper(chartRef.current),
        // disable onclick
        onClick: () => {},
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { parsed: number }) => {
            return currency.symbol + context.parsed.toLocaleString();
          },
        },
      },
    },
  };

  function splitTopAndOtherData(d: LatestAssetsPercentageData) {
    const count = 5;
    if (d.length <= count) {
      return d;
    }
    const top = _(d).sortBy("percentage").reverse().take(count).value();
    const other = _(d).sortBy("percentage").reverse().drop(count).value();

    return _([
      ...top,
      other
        ? {
            coin: "Other",
            percentage: _(other).map("percentage").sum(),
            value: _(other).map("value").sum(),
            chartColor: other[0]?.chartColor ?? "#4B5563",
          }
        : null,
    ])
      .compact()
      .value();
  }

  function lineData() {
    const d = percentageData;
    return {
      labels: d.map((coin) => `${coin.percentage.toFixed(2)}% ` + coin.coin),
      datasets: [
        {
          data: d.map((coin) => currencyWrapper(currency)(coin.value)),
          borderColor: d.map((coin) => coin.chartColor),
          backgroundColor: d.map((coin) => coin.chartColor),
          borderWidth: 1,
          hoverOffset: 35,
        },
      ],
    };
  }

  function renderDoughnut() {
    return loadingWrapper(
      loading,
      <Doughnut ref={chartRef} options={options as any} data={lineData()} />,
      "mt-6 h-[30px]",
      6
    );
  }

  function renderTokenHoldingList() {
    return (
      <>
        <div className="flex w-[100%] h-[50px] justify-between items-center">
          <div className="font-bold text-muted-foreground ml-2">
            Token holding
          </div>
          <div className="flex space-x-2 py-4 items-center">
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
        </div>
        <Separator />
        <Table>
          <TableBody>
            {loading
              ? _(5)
                  .range()
                  .map((i) => (
                    <TableRow key={"latest-assets-percentage-row-loading-" + i}>
                      <TableCell>
                        <Skeleton className="my-[10px] h-[20px] w-[100%]" />
                      </TableCell>
                    </TableRow>
                  ))
                  .value()
              : latestAssetsPercentageData
                  .slice(dataPage * pageSize, (dataPage + 1) * pageSize)
                  .map((d) => (
                    <TableRow
                      key={d.coin}
                      className="h-[55px] cursor-pointer group"
                      onClick={() => navigate(`/coins/${d.coin}`)}
                    >
                      <TableCell>
                        <div className="flex flex-row items-center">
                          <img
                            className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                            src={logoMap[d.coin] || UnknownLogo}
                            alt={d.coin}
                          />
                          <div
                            className="mr-1 font-bold text-base"
                            title={"" + d.amount}
                          >
                            {d.amount >= 1
                              ? prettyNumberKeepNDigitsAfterDecimalPoint(
                                  d.amount,
                                  4
                                )
                              : prettyPriceNumberToLocaleString(d.amount)}
                          </div>
                          <div className="text-gray-600">{d.coin}</div>
                          <ArrowTopRightIcon className="ml-2 h-4 w-4 hidden group-hover:inline-block text-gray-600" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-gray-400">
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
      </>
    );
  }

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5 h-[330px]">
            <div className="col-span-2 md:col-span-3">{renderDoughnut()}</div>
            <div className="col-span-2 md:col-span-2 flex flex-col items-start justify-top">
              {renderTokenHoldingList()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
