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

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
    });
  }, [rangeKey]);
  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(dr: TDateRange) {
    const topN = await queryTopNAssets(dr, 6);
    const data = await queryAssetsPercentageChange(dr);

    setTopN(topN);
    setAssetsPercentageChangeData(data);
  }

  const options = useMemo(() => ({
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
  }), []);

  const preparedData = useMemo(() => {
    const topNSet = new Set(topN);
    const labels: string[] = [];
    const othersData: number[] = [];
    const topNData = topN.map(() => [] as number[]);

    assetsPercentageChangeData.forEach((entry) => {
      labels.push(timeToDateStr(entry.timestamp));

      const percentageBySymbol = new Map<string, number>();
      let others = 0;

      entry.percentages.forEach((item) => {
        if (topNSet.has(item.symbol)) {
          percentageBySymbol.set(item.symbol, item.percentage);
          return;
        }
        others += item.percentage;
      });

      topN.forEach((symbol, idx) => {
        topNData[idx].push(percentageBySymbol.get(symbol) ?? 0);
      });
      othersData.push(others);
    });

    return { labels, topNData, othersData };
  }, [assetsPercentageChangeData, topN]);

  const lineDataMemo = useMemo(() => {
    const topNDatasets = topN.map((symbol, idx) => {
      const color = chartColors[idx % chartColors.length];
      return {
        label: symbol,
        data: preparedData.topNData[idx],
        borderColor: color.main,
        backgroundColor: color.bg,
        fill: true,
        borderWidth: 1.5,
        tension: 0.4,
        pointRadius: 0,
      };
    });
    const othersDatasets = {
      label: "Others",
      data: preparedData.othersData,
      borderColor: "rgba(148,163,184,0.5)",
      backgroundColor: "rgba(148,163,184,0.15)",
      fill: true,
      borderWidth: 1.5,
      tension: 0.4,
      pointRadius: 0,
    };

    return {
      labels: preparedData.labels,
      datasets: [...topNDatasets, othersDatasets],
    };
  }, [preparedData, topN]);

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
