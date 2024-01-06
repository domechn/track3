import _ from "lodash";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timestampToDate } from "@/utils/date";
import {
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
} from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useEffect, useState } from "react";
import {
  queryCoinsAmountChange,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { loadingWrapper } from "@/utils/loading";
import { ChartResizeContext } from "@/App";

const chartName = "Trend of Coin";

const App = ({
  currency,
  size,
  version,
  symbol,
}: {
  currency: CurrencyRateDetail;
  size: number;
  version: number;
  symbol: string;
}) => {
  const wsize = useWindowSize();
  const { needResize } = useContext(ChartResizeContext);
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

  useEffect(() => {
    loadData().then(() => resizeChartWithDelay(chartName));
  }, [size, version, symbol]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData() {
    setLoading(true);
    try {
      const cac = await queryCoinsAmountChange(symbol, size);
      if (!cac) {
        return;
      }
      setCoinsAmountAndValueChangeData(cac);
    } finally {
      setLoading(false);
    }
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
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function chartDataByCoin(coin: string) {
    const current = coinsAmountAndValueChangeData;
    if (!current) {
      return {
        labels: [],
        datasets: [],
      };
    }
    return {
      labels: current.timestamps.map((x) => timestampToDate(x)),
      datasets: [
        {
          label: `Value(${currency.currency})`,
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
            Trend of Coin
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
              <Line options={options as any} data={chartDataByCoin(symbol)} />,
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
