import _ from "lodash";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timeToDateStr } from "@/utils/date";
import {
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
  TDateRange,
} from "@/middlelayers/types";
import { currencyWrapper, simplifyNumber } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  queryCoinsAmountChange,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import {
  chartColors,
  createGradientFill,
  glassScaleOptions,
  glassTooltip,
} from "@/utils/chart-theme";

const chartName = "Trend of Coin";

const App = ({
  currency,
  dateRange,
  symbol,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  symbol: string;
}) => {
  const wsize = useWindowSize();
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [coinsAmountAndValueChangeData, setCoinsAmountAndValueChangeData] =
    useState<CoinsAmountAndValueChangeData>({
      coin: symbol,
      timestamps: [],
      amounts: [],
      values: [],
    });

  const chartHasData = useMemo(
    () => !_(coinsAmountAndValueChangeData.timestamps).isEmpty(),
    [coinsAmountAndValueChangeData]
  );

  useEffect(() => {
    loadData(symbol, dateRange).then(() => {
      resizeChartWithDelay(chartName);
      reportLoaded();
    });
  }, [dateRange, symbol]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(symbol: string, dateRange: TDateRange) {
    const cac = await queryCoinsAmountChange(symbol, dateRange);
    if (!cac) {
      return;
    }
    setCoinsAmountAndValueChangeData(cac);
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
        display: false,
      },
      tooltip: {
        ...glassTooltip,
        callbacks: {
          label: (context: {
            dataset: { label: string; yAxisID: string };
            parsed: { y: number };
          }) => {
            const v = context.parsed.y.toLocaleString();
            const vs =
              context.dataset.yAxisID === "y1" ? currency.symbol + v : v;
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
        },
        grid: {
          display: false,
        },
      },
      y1: {
        title: {
          display: false,
        },
        offset: true,
        position: "left",
        ticks: {
          ...glassScaleOptions.ticks,
          precision: 4,
          callback: (value: any) => {
            return simplifyNumber(value);
          },
        },
        grid: {
          ...glassScaleOptions.grid,
        },
      },
      y2: {
        title: {
          display: false,
        },
        offset: true,
        position: "right",
        ticks: {
          ...glassScaleOptions.ticks,
          precision: 4,
          callback: (value: any) => {
            return simplifyNumber(value);
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function chartDataByCoin(current: CoinsAmountAndValueChangeData) {
    if (!current) {
      return {
        labels: [],
        datasets: [],
      };
    }
    return {
      labels: _(current.timestamps)
        .map((x) => timeToDateStr(x))
        .value(),
      datasets: [
        {
          label: `Value`,
          data: _(current.values)
            .map((v) => currencyWrapper(currency)(v))
            .value(),
          borderColor: chartColors[0].main,
          backgroundColor: chartColors[0].bg,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          yAxisID: "y1",
        },
        {
          label: "Amount",
          data: current.amounts,
          borderColor: chartColors[5].main,
          backgroundColor: chartColors[5].bg,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
          yAxisID: "y2",
        },
      ],
    };
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Trend of {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="flex items-center justify-center"
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            {chartHasData ? (
              <Line
                options={options as any}
                data={chartDataByCoin(coinsAmountAndValueChangeData)}
                plugins={[
                  {
                    id: "gradientFill",
                    beforeDraw(chart: any) {
                      const { ctx, chartArea } = chart;
                      if (!chartArea) return;
                      chart.data.datasets.forEach(
                        (ds: any, idx: number) => {
                          if (ds.fill) {
                            const colorIdx = idx === 0 ? 0 : 5;
                            ds.backgroundColor = createGradientFill(
                              ctx,
                              chartArea,
                              chartColors[colorIdx].main,
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
            ) : (
              <div className="text-lg text-muted-foreground m-auto">
                No Available Data For Selected Dates
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
