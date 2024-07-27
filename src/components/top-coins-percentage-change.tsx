import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timeToDateStr } from "@/utils/date";
import { TDateRange, TopCoinsPercentageChangeData } from "@/middlelayers/types";
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

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const wsize = useWindowSize();
  const { needResize } = useContext(ChartResizeContext);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [topCoinsPercentageChangeData, setTopCoinsPercentageChangeData] =
    useState<TopCoinsPercentageChangeData>({
      timestamps: [],
      coins: [],
    });
  const getWholeKey = (key: string): string => prefix + _.upperFirst(key);
  const getLabel = () => _.upperFirst(currentType.replace(prefix, ""));

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
    loadData(dateRange).then(() => {
      resizeChartWithDelay(chartNameKey);
      setInitialLoaded(true);
    });
  }, [dateRange]);

  useEffect(() => resizeChart(chartNameKey), [needResize]);

  const loadData = async (dr: TDateRange) => {
    updateLoading(true);
    try {
      const tcpcd = await queryTopCoinsPercentageChangeData(dr);
      setTopCoinsPercentageChangeData(tcpcd);
    } finally {
      updateLoading(false);
    }
  };

  const updateLoading = (val: boolean) => {
    if (initialLoaded) {
      return;
    }
    setLoading(val);
  };

  const options = useMemo(
    () => ({
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
          text: `Change of Top Coins ${getLabel()} Percentage`,
        },
        tooltip: {
          itemSort: (a: { raw: number }, b: { raw: number }) => b.raw - a.raw,
        },
        datalabels: {
          display: false,
        },
        legend: {
          onClick: (
            e: any,
            legendItem: { datasetIndex: number },
            legend: any
          ) =>
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
            callback: (value: number) => `${value}%`,
          },
          grid: {
            display: false,
          },
        },
      },
    }),
    [topCoinsPercentageChangeData, currentType]
  );


  const coinPercentageData = (
    timestamps: number[],
    coinPercentageData: { value: number; price: number; timestamp: number }[]
  ) => {
    const coinRankDataMap = new Map<number, number>();
    coinPercentageData.forEach(({ timestamp, value, price }) => {
      coinRankDataMap.set(
        timestamp,
        currentType === getWholeKey("value") ? value : price
      );
    });
    return timestamps.map((date) => coinRankDataMap.get(date) ?? null);
  };

  const lineData = useMemo(
    () => ({
      labels: topCoinsPercentageChangeData.timestamps.map((t) =>
        timeToDateStr(t)
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
    }),
    [topCoinsPercentageChangeData, currentType]
  );

  const onTypeSelectChange = (type: string) => {
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
  };

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
              <Line ref={chartRef} options={options as any} data={lineData} />,
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
