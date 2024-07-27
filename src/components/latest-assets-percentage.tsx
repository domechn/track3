import { Doughnut } from "react-chartjs-2";
import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TDateRange,
} from "@/middlelayers/types";
import { Card, CardContent } from "./ui/card";
import _ from "lodash";
import { useNavigate } from "react-router-dom";
import bluebird from "bluebird";
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  OpenInNewWindowIcon,
} from "@radix-ui/react-icons";
import {
  queryLatestAssetsPercentage,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { Skeleton } from "./ui/skeleton";
import { loadingWrapper } from "@/lib/loading";
import { ChartResizeContext } from "@/App";
import { offsetHoveredItemWrapper } from "@/utils/legend";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { getImageApiPath } from "@/utils/app";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";

const chartName = "Percentage of Assets";

const App = React.memo(
  ({
    currency,
    dateRange,
  }: {
    currency: CurrencyRateDetail;
    dateRange: TDateRange;
  }) => {
    const { needResize } = useContext(ChartResizeContext);
    const [dataPage, setDataPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const [latestAssetsPercentageData, setLatestAssetsPercentageData] =
      useState<LatestAssetsPercentageData>([]);
    const chartRef =
      useRef<ChartJSOrUndefined<"doughnut", number[], unknown>>(null);
    const pageSize = 5;
    const navigate = useNavigate();
    const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});

    const loadData = useCallback(async (dr: TDateRange) => {
      updateLoading(true);
      try {
        const lap = await queryLatestAssetsPercentage();
        setLatestAssetsPercentageData(lap);
      } finally {
        updateLoading(false);
      }
    }, []);

    const getLogoMap = useCallback(async (d: LatestAssetsPercentageData) => {
      const acd = await getAppCacheDir();
      const kvs = await bluebird.map(d, async (coin) => {
        const path = await getImageApiPath(acd, coin.coin);
        return { [coin.coin]: path };
      });

      return _.assign({}, ...kvs);
    }, []);

    const updateLoading = (val: boolean) => {
      if (!initialLoaded) {
        setLoading(val);
      }
    };

    const splitTopAndOtherData = useCallback(
      (d: LatestAssetsPercentageData) => {
        const count = 5;
        if (d.length <= count) {
          return d;
        }
        const top = _(d).sortBy("percentage").reverse().take(count).value();
        const other = _(d).sortBy("percentage").reverse().drop(count).value();

        return _([
          ...top,
          other.length > 0
            ? {
                coin: "Other",
                percentage: _(other).map("percentage").sum(),
                value: _(other).map("value").sum(),
                chartColor: other[0]?.chartColor ?? "#4B5563",
              }
            : null,
        ])
          .filter(Boolean)
          .compact()
          .value();
      },
      []
    );

    const percentageData = useMemo(
      () => splitTopAndOtherData(latestAssetsPercentageData),
      [latestAssetsPercentageData, splitTopAndOtherData]
    );

    const maxDataPage = useMemo(
      () =>
        Math.floor(
          latestAssetsPercentageData.length / pageSize - 0.000000000001
        ),
      [latestAssetsPercentageData, pageSize]
    );

    const pagedLatestAssetsPercentageData = useMemo(
      () =>
        latestAssetsPercentageData.slice(
          dataPage * pageSize,
          (dataPage + 1) * pageSize
        ),
      [latestAssetsPercentageData, dataPage, pageSize]
    );

    useEffect(() => {
      loadData(dateRange).then(() => {
        resizeChartWithDelay(chartName);
        setInitialLoaded(true);
      });
    }, [dateRange, loadData]);

    useEffect(() => resizeChart(chartName), [needResize]);

    useEffect(() => {
      downloadCoinLogos(
        _(latestAssetsPercentageData)
          .map((d) => ({
            symbol: d.coin,
            price: d.value / (d.amount || 1),
          }))
          .value()
      );

      getLogoMap(latestAssetsPercentageData).then((m) => setLogoMap(m));
    }, [latestAssetsPercentageData, getLogoMap]);

    const options = {
      maintainAspectRatio: false,
      responsive: false,
      layout: {
        padding: 20,
      },
      plugins: {
        title: { display: false, text: chartName },
        legend: {
          display: true,
          position: "right",
          font: {
            size: 13,
          },
          labels: { font: {} },
          onHover: (e: any, legendItem: { index: number }, legend: any) =>
            offsetHoveredItemWrapper(chartRef.current)(e, legendItem, legend),
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

    const lineData = () => {
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
    };

    const renderDoughnut = () => {
      return loadingWrapper(
        loading,
        <Doughnut ref={chartRef} options={options as any} data={lineData()} />,
        "mt-6 h-[30px]",
        6
      );
    };

    const renderTokenHoldingList = () => {
      return (
        <>
          <div className="flex w-full h-12 justify-between items-center">
            <div className="font-bold text-muted-foreground ml-2">
              Token Holding
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
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`latest-assets-percentage-row-loading-${i}`}>
                      <TableCell>
                        <Skeleton className="my-2.5 h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : pagedLatestAssetsPercentageData.map((d) => (
                    <TableRow
                      key={d.coin}
                      className="h-14 cursor-pointer group"
                      onClick={() => navigate(`/coins/${d.coin}`)}
                    >
                      <TableCell>
                        <div className="flex items-center">
                          <img
                            className="inline-block w-5 h-5 mr-2 rounded-full"
                            src={logoMap[d.coin] || UnknownLogo}
                            alt={d.coin}
                          />
                          <div
                            className="mr-1 font-bold text-base"
                            title={String(d.amount)}
                          >
                            {d.amount >= 1
                              ? prettyNumberKeepNDigitsAfterDecimalPoint(
                                  d.amount,
                                  4
                                )
                              : prettyPriceNumberToLocaleString(d.amount)}
                          </div>
                          <div className="text-gray-600">{d.coin}</div>
                          <OpenInNewWindowIcon className="ml-2 h-4 w-4 hidden group-hover:inline-block text-gray-600" />
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
    };

    return (
      <div>
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
              <div className="col-span-2 md:col-span-3 h-[330px]">
                {renderDoughnut()}
              </div>
              <div className="col-span-2 md:col-span-2 flex flex-col items-start justify-top">
                {renderTokenHoldingList()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

export default App;
