import { AssetsPercentageChangeData, TDateRange } from "@/middlelayers/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useWindowSize } from "@/utils/hook";
import { loadingWrapper } from "@/lib/loading";
import { useContext, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { ChartResizeContext } from "@/App";
import {
  queryAssetsPercentageChange,
  queryTopNAssets,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { timeToDateStr } from "@/utils/date";
import _ from "lodash";
import { generateRandomColors } from "@/utils/color";

const chartName = "Coins Percentage Overview";

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const wsize = useWindowSize();
  const [topN, setTopN] = useState<string[]>([]);
  const { needResize } = useContext(ChartResizeContext);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assetsPercentageChangeData, setAssetsPercentageChangeData] = useState(
    [] as AssetsPercentageChangeData
  );

  useEffect(() => {
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
  }, [dateRange]);
  useEffect(() => resizeChart(chartName), [needResize]);

  const colors = useMemo(() => generateRandomColors(topN.length + 1), [topN]);

  async function loadData(dr: TDateRange) {
    updateLoading(true);

    try {
      const topN = await queryTopNAssets(dr, 6);
      const data = await queryAssetsPercentageChange(dr);

      setTopN(topN);
      setAssetsPercentageChangeData(data);
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
        // text is set for resizing
        text: chartName,
      },
      datalabels: {
        display: false,
      },
      legend: {
        display: true,
      },
      tooltip: {
        itemSort: (a: any, b: any) => b.parsed.y - a.parsed.y,
        // mode: "index",
        callbacks: {
          label: (context: {
            dataset: { label: string; yAxisID: string };
            parsed: { y: number };
          }) => {
            const v = context.parsed.y.toLocaleString();
            const vs = context.dataset.yAxisID === "y1" ? "$" + v : v;
            return " " + context.dataset.label + ": " + vs;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: false,
        },
        ticks: {
          autoSkip: true,
        },
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        reverse: true,
        max: 100,
        title: {
          display: false,
        },
        ticks: {
          precision: 0,
          stepSize: 25,
          callback: function (value: number) {
            return 100 - value + "%";
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function lineData() {
    const topNDatasets = _(topN)
      .map((s, idx) => {
        const colorIdx = idx;
        return {
          label: s,
          data: _(assetsPercentageChangeData)
            .map(
              (d) =>
                _(d.percentages).find((p) => p.symbol === s)?.percentage ?? 0
            )
            .value(),
          backgroundColor: `rgba(${colors[colorIdx].R}, ${colors[colorIdx].G}, ${colors[colorIdx].B}, 1)`,
          fill: true,
          borderWidth: 0,
          pointStyle: false as any,
        };
      })
      .compact()
      .value();
    const othersIdx = topN.length;
    const othersDatasets = {
      label: "Others",
      data: _(assetsPercentageChangeData)
        .map(
          (d) =>
            _(d.percentages)
              .filter((p) => !topN.includes(p.symbol))
              .sumBy("percentage") ?? 0
        )
        .value(),
      backgroundColor: `rgba(${colors[othersIdx].R}, ${colors[othersIdx].G}, ${colors[othersIdx].B})`,
      fill: true,
      borderWidth: 0,
      pointStyle: false as any,
    };
    return {
      labels: assetsPercentageChangeData.map((x) => timeToDateStr(x.timestamp)),
      datasets: [...topNDatasets, othersDatasets],
    };
  }

  const lineDataMemo = useMemo(
    () => lineData(),
    [assetsPercentageChangeData, topN, colors]
  );

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            {chartName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 placeholder">
          <div
            className="flex items-center justify-center"
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            {loadingWrapper(
              loading,
              <Line options={options as any} data={lineDataMemo} />,
              "my-[10px] h-[26px]",
              10
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
