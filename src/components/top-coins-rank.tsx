import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timeToDateStr } from "@/utils/date";
import { TDateRange, TopCoinsRankData } from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { BubbleDataPoint, Point } from "chart.js";
import _ from "lodash";
import { hideOtherLinesClickWrapper } from "@/utils/legend";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  queryTopCoinsRank,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { loadingWrapper } from "@/lib/loading";
import { ChartResizeContext } from "@/App";

const chartName = "Trend of Top Coins Rank";

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const wsize = useWindowSize();
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { needResize } = useContext(ChartResizeContext);
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const chartRef =
    useRef<
      ChartJSOrUndefined<
        "line",
        (number | [number, number] | Point | BubbleDataPoint | null)[],
        unknown
      >
    >(null);

  useEffect(() => {
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
  }, [dateRange]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(dr: TDateRange) {
    updateLoading(true);
    try {
      const tcr = await queryTopCoinsRank(dr);
      setTopCoinsRankData(tcr);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }

    setLoading(val);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    hover: {
      mode: "index",
      intersect: false,
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      title: {
        display: false,
        text: chartName,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        itemSort: (a: { raw: number }, b: { raw: number }) => {
          return a.raw - b.raw;
        },
      },
      legend: {
        onClick: (e: any, legendItem: { datasetIndex: number }, legend: any) =>
          hideOtherLinesClickWrapper(
            _(topCoinsRankData.coins).size(),
            chartRef.current
          )(e, legendItem, legend),
      },
    },
    scales: {
      x: {
        title: {
          display: false,
          text: "Date",
        },
        ticks: {
          autoSkip: true,
        },
      },
      y: {
        title: {
          display: false,
          text: "Rank",
        },
        offset: true,
        reverse: true,
        ticks: {
          precision: 0,
          callback: function (value: number) {
            return "#" + value;
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function coinRankData(
    timestamps: number[],
    coinRankData: { rank?: number; timestamp: number }[]
  ) {
    const coinRankDataMap = new Map<number, number | undefined>();
    coinRankData.forEach((rankData) => {
      coinRankDataMap.set(rankData.timestamp, rankData.rank);
    });
    return timestamps.map((date) => coinRankDataMap.get(date) || null);
  }

  function lineData() {
    return {
      labels: topCoinsRankData.timestamps.map((x) => timeToDateStr(x)),
      datasets: topCoinsRankData.coins.map((coin) => ({
        label: coin.coin,
        data: coinRankData(topCoinsRankData.timestamps, coin.rankData),
        borderColor: coin.lineColor,
        backgroundColor: coin.lineColor,
        borderWidth: 4,
        tension: 0.1,
        pointRadius: 0.2,
        pointStyle: "rotRect",
      })),
    };
  }

  const lineDataMemo = useMemo(() => lineData(), [topCoinsRankData]);

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Trend of Top Coins Rank
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            {loadingWrapper(
              loading,
              <Line
                ref={chartRef}
                options={options as any}
                data={lineDataMemo}
              />,
              "mt-4",
              10
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
