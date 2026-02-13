import { AssetsPercentageChangeData, TDateRange } from "@/middlelayers/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useWindowSize } from "@/utils/hook";
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
import {
  chartColors,
  createGradientFill,
  glassScaleOptions,
  glassTooltip,
} from "@/utils/chart-theme";

const chartName = "Coins Percentage Overview";

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const wsize = useWindowSize();
  const [topN, setTopN] = useState<string[]>([]);
  const { needResize } = useContext(ChartResizeContext);
  const [assetsPercentageChangeData, setAssetsPercentageChangeData] = useState(
    [] as AssetsPercentageChangeData
  );

  useEffect(() => {
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
    });
  }, [dateRange]);
  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(dr: TDateRange) {
    const topN = await queryTopNAssets(dr, 6);
    const data = await queryAssetsPercentageChange(dr);

    setTopN(topN);
    setAssetsPercentageChangeData(data);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: true,
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
        ...glassTooltip,
        itemSort: (a: any, b: any) => b.parsed.y - a.parsed.y,
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
          ...glassScaleOptions.ticks,
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
          ...glassScaleOptions.ticks,
          precision: 0,
          stepSize: 25,
          callback: function (value: number) {
            return 100 - value + "%";
          },
        },
        grid: {
          ...glassScaleOptions.grid,
        },
      },
    },
  };

  function lineData() {
    const topNDatasets = _(topN)
      .map((s, idx) => {
        const color = chartColors[idx % chartColors.length];
        return {
          label: s,
          data: _(assetsPercentageChangeData)
            .map(
              (d) =>
                _(d.percentages).find((p) => p.symbol === s)?.percentage ?? 0
            )
            .value(),
          borderColor: color.main,
          backgroundColor: color.bg,
          fill: true,
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0,
        };
      })
      .compact()
      .value();
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
      borderColor: "rgba(148,163,184,0.5)",
      backgroundColor: "rgba(148,163,184,0.15)",
      fill: true,
      borderWidth: 1.5,
      tension: 0.4,
      pointRadius: 0,
    };
    return {
      labels: assetsPercentageChangeData.map((x) => timeToDateStr(x.timestamp)),
      datasets: [...topNDatasets, othersDatasets],
    };
  }

  const lineDataMemo = useMemo(
    () => lineData(),
    [assetsPercentageChangeData, topN]
  );

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {chartName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="flex items-center justify-center"
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            <Line
              options={options as any}
              data={lineDataMemo}
              plugins={[
                {
                  id: "stackedGradientFill",
                  beforeDraw(chart: any) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    chart.data.datasets.forEach((ds: any, idx: number) => {
                      if (ds.fill) {
                        const color =
                          idx < topN.length
                            ? chartColors[idx % chartColors.length].main
                            : "rgba(148,163,184,1)";
                        ds.backgroundColor = createGradientFill(
                          ctx,
                          chartArea,
                          color,
                          0.35,
                          0.08
                        );
                      }
                    });
                  },
                },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
