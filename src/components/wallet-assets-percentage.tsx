import { Bar } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import {
  CurrencyRateDetail,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import { insertEllipsis } from "@/utils/string";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WALLET_ANALYZER, resizeChart, resizeChartWithDelay } from "@/middlelayers/charts";
import { loadingWrapper } from "@/utils/loading";
import { ChartResizeContext } from "@/App";

const chartName = "Percentage And Total Value of Each Wallet";

const App = ({
  currency,
  version,
}: {
  currency: CurrencyRateDetail;
  version: number;
}) => {
  const size = useWindowSize();

  const { needResize } = useContext(ChartResizeContext);
  const [loading, setLoading] = useState(false);
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  useEffect(() => {
    loadData().then(() => resizeChartWithDelay(chartName));
  }, [version]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData() {
    setLoading(true);

    try {
      const wap = await WALLET_ANALYZER.queryWalletAssetsPercentage();
      setWalletAssetsPercentage(wap);
    } finally {
      setLoading(false);
    }
  }

  const totalValue = useMemo(
    () =>
      currencyWrapper(currency)(_(walletAssetsPercentage).sumBy("value")) ||
      0.0001,
    [walletAssetsPercentage, currency]
  );

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    indexAxis: "y",
    barPercentage: 0.9,
    plugins: {
      title: {
        display: false,
        text: chartName,
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: "auto",
        align: "top",
        offset: Math.max(0, 15 - _(walletAssetsPercentage).size()),
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
      labels: walletAssetsPercentage.map((d) =>
        d.walletAlias
          ? `${d.walletType}-${d.walletAlias}`
          : insertEllipsis(d.wallet, 16)
      ),
      datasets: [
        {
          alias: "y",
          fill: false,
          data: walletAssetsPercentage.map((d) =>
            currencyWrapper(currency)(d.value).toFixed(2)
          ),
          borderColor: walletAssetsPercentage.map((d) => d.chartColor),
          backgroundColor: walletAssetsPercentage.map((d) => d.chartColor),
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
            {loadingWrapper(
              loading,
              <Bar options={options as any} data={lineData()} />,
              "h-[25px] my-4",
              10
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
