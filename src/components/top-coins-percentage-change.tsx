import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timestampToDate } from "@/utils/date";
import { TopCoinsPercentageChangeData } from "@/middlelayers/types";
import { useContext, useEffect, useRef, useState } from "react";
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
import { loadingWrapper } from "@/lib/loading";
import { ChartResizeContext } from "@/App";

const prefix = "tcpc";
const chartNameKey = "Change of Top Coins";

const App = ({ size, version }: { size: number; version: number }) => {
  const wsize = useWindowSize();

  const { needResize } = useContext(ChartResizeContext);
  const [loading, setLoading] = useState(false);
  const [topCoinsPercentageChangeData, setTopCoinsPercentageChangeData] =
    useState<TopCoinsPercentageChangeData>({
      timestamps: [],
      coins: [],
    });

  const [currentType, setCurrentType] = useState(getWholeKey("value")); // ['tcpcValue', 'tcpcPrice']
  const chartRef =
    useRef<
      ChartJSOrUndefined<
        "line",
        (number | [number, number] | Point | BubbleDataPoint | null)[],
        unknown
      >
    >(null);

  useEffect(() => {
    loadData().then(() => resizeChartWithDelay(chartNameKey));
  }, [size, version]);

  useEffect(() => resizeChart(chartNameKey), [needResize]);

  async function loadData() {
    setLoading(true);
    try {
      const tcpcd = await queryTopCoinsPercentageChangeData(size);
      setTopCoinsPercentageChangeData(tcpcd);
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
        text: `Change of Top Coins ${getLabel()} Percentage`,
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
          precision: 2,
          callback: function (value: number) {
            return value + "%";
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

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
        currentType === getWholeKey("value")
          ? percentageData.value
          : percentageData.price
      );
    });
    return timestamps.map((date) => coinRankDataMap.get(date) ?? null);
  }

  function lineData() {
    return {
      labels: topCoinsPercentageChangeData.timestamps.map((x) =>
        timestampToDate(x)
      ),
      datasets: topCoinsPercentageChangeData.coins.map((coin) => ({
        label: coin.coin,
        data: coinPercentageData(
          topCoinsPercentageChangeData.timestamps,
          coin.percentageData
        ),
        borderColor: coin.lineColor,
        backgroundColor: coin.lineColor,
        borderWidth: 4,
        tension: 0.1,
        pointRadius: 0.2,
        pointStyle: "rotRect",
      })),
    };
  }

  function onTypeSelectChange(type: string) {
    setCurrentType(type);

    const buttons = document.getElementsByClassName("active");

    for (let i = 0; i < buttons.length; i++) {
      if (
        [getWholeKey("value"), getWholeKey("price")].includes(buttons[i].id)
      ) {
        buttons[i].classList.remove("active");
      }
    }

    document.getElementById(type)?.classList.add("active");
  }

  function getWholeKey(key: string): string {
    return prefix + _(key).upperFirst();
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Change of Top Coins {getLabel()} Percentage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <ButtonGroup
              defaultValue="value"
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
