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
import { loadingWrapper } from "@/lib/loading";
import { ChartResizeContext } from "@/App";

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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const y1Color = "#4F46E5";
  const y2Color = "#F97316";

  const [coinsAmountAndValueChangeData, setCoinsAmountAndValueChangeData] =
    useState<CoinsAmountAndValueChangeData>({
      coin: symbol,
      timestamps: [],
      amounts: [],
      values: [],
    });

  const [loading, setLoading] = useState(false);

  const chartHasData = useMemo(
    () => !_(coinsAmountAndValueChangeData.timestamps).isEmpty(),
    [coinsAmountAndValueChangeData]
  );

  useEffect(() => {
    loadData(symbol, dateRange).then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
  }, [dateRange, symbol]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(symbol: string, dateRange: TDateRange) {
    updateLoading(true);
    try {
      const cac = await queryCoinsAmountChange(symbol, dateRange);
      if (!cac) {
        return;
      }
      setCoinsAmountAndValueChangeData(cac);
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
        display: false,
      },
      tooltip: {
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
      },
      y1: {
        title: {
          display: false,
        },
        offset: true,
        position: "left",
        ticks: {
          precision: 4,
          callback: (value: any) => {
            return simplifyNumber(value);
          },
        },
        grid: {
          display: false,
        },
      },
      y2: {
        title: {
          display: false,
        },
        offset: true,
        position: "right",
        ticks: {
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
          borderColor: y1Color,
          backgroundColor: y1Color,
          borderWidth: 4,
          tension: 0.1,
          pointRadius: 0.2,
          pointStyle: "rotRect",
          yAxisID: "y1",
        },
        {
          label: "Amount",
          data: current.amounts,
          borderColor: y2Color,
          backgroundColor: y2Color,
          borderWidth: 4,
          tension: 0.1,
          pointRadius: 0.2,
          pointStyle: "rotRect",
          yAxisID: "y2",
        },
      ],
    };
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
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
            {loadingWrapper(
              loading,
              chartHasData ? (
                <Line
                  options={options as any}
                  data={chartDataByCoin(coinsAmountAndValueChangeData)}
                />
              ) : (
                <div className="text-3xl text-gray-300 m-auto">
                  No Available Data For Selected Dates
                </div>
              ),
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
