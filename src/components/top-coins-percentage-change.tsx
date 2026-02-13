import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timeToDateStr } from "@/utils/date";
import { TDateRange, TopCoinsPercentageChangeData } from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import _ from "lodash";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { BubbleDataPoint, Point } from "chart.js";
import { hideOtherLinesClickWrapper } from "@/utils/legend";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  queryTopCoinsPercentageChangeData,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import {
  chartColors,
  createGradientFill,
  glassScaleOptions,
  glassTooltip,
} from "@/utils/chart-theme";

const prefix = "tcpc";
const chartNameKey = "Change of Top Coins";
const VALUE_KEY = getWholeKey("value");

function getWholeKey(key: string): string {
  return prefix + _(key).upperFirst();
}

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const wsize = useWindowSize();

  const { needResize } = useContext(ChartResizeContext);
  const [topCoinsPercentageChangeData, setTopCoinsPercentageChangeData] =
    useState<TopCoinsPercentageChangeData>({
      timestamps: [],
      coins: [],
    });

  const [currentType, setCurrentType] = useState(VALUE_KEY); // ['tcpcValue', 'tcpcPrice']
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
      resizeChartWithDelay(chartNameKey);
    });
  }, [dateRange]);

  useEffect(() => resizeChart(chartNameKey), [needResize]);

  async function loadData(dr: TDateRange) {
    const tcpcd = await queryTopCoinsPercentageChangeData(dr);
    setTopCoinsPercentageChangeData(tcpcd);
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
        text: `Change of Top Coins ${getLabel()} Percentage`,
      },
      tooltip: {
        ...glassTooltip,
        itemSort: (a: { raw: number }, b: { raw: number }) => {
          return b.raw - a.raw;
        },
      },
      datalabels: {
        display: false,
      },
      legend: {
        onClick: (e: any, legendItem: { datasetIndex: number }, legend: any) =>
          hideOtherLinesClickWrapper(
            _(topCoinsPercentageChangeData.coins).size(),
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
      },
      y: {
        title: {
          display: false,
          text: "Percentage",
        },
        offset: true,
        ticks: {
          ...glassScaleOptions.ticks,
          precision: 2,
          callback: function (value: number) {
            return value + "%";
          },
        },
        grid: {
          ...glassScaleOptions.grid,
        },
      },
    },
  }), [currentType, topCoinsPercentageChangeData.coins.length]);

  function getLabel() {
    return _.upperFirst(currentType.replace(prefix, ""));
  }

  function coinPercentageData(
    timestamps: number[],
    coinPercentageData: { value: number; price: number; timestamp: number }[]
  ) {
    const coinRankDataMap = new Map<number, number>();
    coinPercentageData.forEach((percentageData) => {
      coinRankDataMap.set(
        percentageData.timestamp,
        currentType === VALUE_KEY
          ? percentageData.value
          : percentageData.price
      );
    });
    return timestamps.map((date) => coinRankDataMap.get(date) ?? null);
  }

  const chartData = useMemo(() => {
    return {
      labels: topCoinsPercentageChangeData.timestamps.map((x) =>
        timeToDateStr(x)
      ),
      datasets: topCoinsPercentageChangeData.coins.map((coin, idx) => ({
        label: coin.coin,
        data: coinPercentageData(
          topCoinsPercentageChangeData.timestamps,
          coin.percentageData
        ),
        borderColor: chartColors[idx % chartColors.length].main,
        backgroundColor: chartColors[idx % chartColors.length].bg,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: true,
      })),
    };
  }, [topCoinsPercentageChangeData, currentType]);

  function onTypeSelectChange(type: string) {
    setCurrentType(type);
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Change of Top Coins {getLabel()} Percentage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <ButtonGroup
              value={currentType === VALUE_KEY ? "value" : "price"}
              onValueChange={(val: string) =>
                onTypeSelectChange(getWholeKey(val))
              }
            >
              <ButtonGroupItem value="value">Value</ButtonGroupItem>
              <ButtonGroupItem value="price">Price</ButtonGroupItem>
            </ButtonGroup>
          </div>
          <div
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            <Line
              ref={chartRef}
              options={options as any}
              data={chartData}
              plugins={[
                {
                  id: "gradientFill",
                  beforeDraw(chart: any) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    chart.data.datasets.forEach(
                      (ds: any, idx: number) => {
                        if (ds.fill) {
                          ds.backgroundColor = createGradientFill(
                            ctx,
                            chartArea,
                            chartColors[idx % chartColors.length].main,
                            0.2,
                            0.0
                          );
                        }
                      }
                    );
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
