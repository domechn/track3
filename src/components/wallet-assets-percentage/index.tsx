import { Bar } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import {
  CurrencyRateDetail,
  WalletAssetsPercentageData,
} from "../../middlelayers/types";
import { currencyWrapper } from "../../utils/currency";
import _ from "lodash";
import { useEffect, useState } from "react";

const App = ({
  data,
  currency,
}: {
  data: WalletAssetsPercentageData;
  currency: CurrencyRateDetail;
}) => {
  const size = useWindowSize();

  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    setTotalValue(currencyWrapper(currency)(_(data).sumBy("value")) || 0.0001);
  }, [data, currency]);

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    indexAxis: "y",
    barPercentage: 0.9,
    plugins: {
      title: {
        display: true,
        text: `Percentage And Total Value of Each Wallet`,
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: "auto",
        align: "top",
        offset: Math.max(0, 16 - _(data).size()),
        formatter: (value: number) => {
          return `${((value / totalValue) * 100).toFixed(2)}%`;
        },
      },
    },
    scales: {
      x: {
        ticks: {
          precision: 2,
          callback: function (value: number) {
            if (value === 0) {
              return value;
            }
            return currency.symbol + value;
          },
        },
      },
    },
  };

  function lineData() {
    return {
      labels: data.map((d) => d.walletAlias || d.wallet),
      datasets: [
        {
          alias: "y",
          fill: false,
          data: data.map((d) => currencyWrapper(currency)(d.value).toFixed(2)),
          borderColor: data.map((d) => d.chartColor),
          backgroundColor: data.map((d) => d.chartColor),
          borderWidth: 1,
        },
      ],
    };
  }

  return (
    <div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 400),
        }}
      >
        <Bar options={options as any} data={lineData()} />
      </div>
    </div>
  );
};

export default App;
