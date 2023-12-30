import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timestampToDate } from "@/utils/date";
import { TopCoinsRankData } from "@/middlelayers/types";
import { useEffect, useRef, useState } from "react";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { BubbleDataPoint, Point } from "chart.js";
import _ from "lodash";
import { legendOnClick } from "@/utils/legend";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { queryTopCoinsRank } from "@/middlelayers/charts";
import { loadingWrapper } from "@/utils/loading";

const App = ({ size, version }: { size: number; version: number }) => {
  const wsize = useWindowSize();
  const [loading, setLoading] = useState(false);
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
    loadData();
  }, [size, version]);

  async function loadData() {
    setLoading(true);
    try {
      const tcr = await queryTopCoinsRank(size);
      setTopCoinsRankData(tcr);
    } finally {
      setLoading(false);
    }
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    hover: {
      mode: "nearest",
      intersect: false,
    },
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    plugins: {
      title: {
        display: false,
        text: "Trend of Top Coins Rank",
      },
      datalabels: {
        display: false,
      },
      legend: {
        onClick: legendOnClick(
          _(topCoinsRankData.coins).size(),
          chartRef.current
        ),
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
      labels: topCoinsRankData.timestamps.map((x) => timestampToDate(x)),
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
                data={lineData()}
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
