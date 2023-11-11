import { Bar } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import {
  CurrencyRateDetail,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import _ from "lodash";
import { useEffect, useState } from "react";
import { insertEllipsis } from "@/utils/string";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

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
        display: false,
        text: `Percentage And Total Value of Each Wallet`,
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: "auto",
        align: "top",
        offset: Math.max(0, 15 - _(data).size()),
        formatter: (value: number) => {
          return `${prettyNumberToLocaleString((value / totalValue) * 100)}%`;
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `${currency.currency} Value`,
        },
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
      y: {
        offset: true,
        ticks: {
          precision: 2,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function lineData() {
    return {
      labels: data.map((d) =>
        d.walletAlias
          ? `${d.walletType}-${d.walletAlias}`
          : insertEllipsis(d.wallet, 16)
      ),
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Percentage And Total Value of Each Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            style={{
              height: Math.max((size.height || 100) / 2, 400),
            }}
          >
            <Bar options={options as any} data={lineData()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
