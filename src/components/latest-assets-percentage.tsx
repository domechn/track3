import { Doughnut } from "react-chartjs-2";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TDateRange,
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
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import {
  queryLatestAssetsPercentage,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { offsetHoveredItemWrapper } from "@/utils/legend";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { chartColors, glassTooltip } from "@/utils/chart-theme";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const chartName = "Percentage of Assets";

const App = ({
  currency,
  dateRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
}) => {
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [dataPage, setDataPage] = useState<number>(0);
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
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      reportLoaded();
    });
  }, [dateRange]);

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

  async function loadData(dr: TDateRange) {
    const lap = await queryLatestAssetsPercentage();
    setLatestAssetsPercentageData(lap);
  }

  const maxDataPage = useMemo(() => {
    // - 0.000000000001 is for float number precision
    const mp = Math.floor(
      latestAssetsPercentageData.length / pageSize - 0.000000000001
    );
    return mp >= 0 ? mp : 0;
  }, [latestAssetsPercentageData]);

  const pagedLatestAssetsPercentageData = useMemo(
    () =>
      latestAssetsPercentageData.slice(
        dataPage * pageSize,
        (dataPage + 1) * pageSize
      ),
    [latestAssetsPercentageData, dataPage]
  );

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
    responsive: true,
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
        onHover: (e: any, legendItem: { index: number }, legend: any) =>
          offsetHoveredItemWrapper(chartRef.current)(e, legendItem, legend),
        // disable onclick
        onClick: () => {},
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        ...glassTooltip,
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
          borderColor: "rgba(255,255,255,0.15)",
          backgroundColor: d.map(
            (_coin, i) => chartColors[i % chartColors.length].main
          ),
          borderWidth: 2,
          hoverOffset: 12,
          cutout: "72%",
        },
      ],
    };
  }

  function renderDoughnut() {
    return (
      <Doughnut ref={chartRef} options={options as any} data={lineData()} />
    );
  }

  function renderTokenHoldingList() {
    return (
      <>
        <div className="flex w-[100%] h-[40px] justify-between items-center">
          <div className="text-sm font-medium text-muted-foreground ml-2">
            Token Holding
          </div>
          <div className="flex space-x-2 py-3 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
              disabled={dataPage <= 0}
            >
              <ChevronLeftIcon />
            </Button>
            <div className="text-muted-foreground text-xs">
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
            {pagedLatestAssetsPercentageData.map((d) => (
              <TableRow
                key={d.coin}
                className="h-[42px] cursor-pointer group"
                onClick={() => navigate(`/coins/${d.coin}`)}
              >
                <TableCell className="py-1.5">
                  <div className="flex flex-row items-center">
                    <img
                      className="inline-block w-[18px] h-[18px] mr-2 rounded-full"
                      src={logoMap[d.coin] || UnknownLogo}
                      alt={d.coin}
                    />
                    <div
                      className="mr-1 font-medium text-sm"
                      title={"" + d.amount}
                    >
                      {d.amount >= 1
                        ? prettyNumberKeepNDigitsAfterDecimalPoint(
                            d.amount,
                            4
                          )
                        : prettyPriceNumberToLocaleString(d.amount)}
                    </div>
                    <div className="text-muted-foreground text-xs truncate">
                      {d.coin}
                    </div>
                    <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block text-muted-foreground" />
                  </div>
                </TableCell>
                <TableCell className="text-right py-1.5">
                  <div className="text-muted-foreground text-xs">
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
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <div className="col-span-2 md:col-span-3 h-[330px]">
              {renderDoughnut()}
            </div>
            <div className="col-span-2 md:col-span-2 flex flex-col items-start justify-center">
              {renderTokenHoldingList()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
