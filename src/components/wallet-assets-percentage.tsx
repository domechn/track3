import { Pie } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import {
  CurrencyRateDetail,
  TDateRange,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";
import _ from "lodash";
import { useContext, useEffect, useRef, useState } from "react";
import { insertEllipsis } from "@/utils/string";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  WALLET_ANALYZER,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { loadingWrapper } from "@/lib/loading";
import { ChartResizeContext } from "@/App";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { offsetHoveredItemWrapper } from "@/utils/legend";

const chartName = "Percentage And Total Value of Each Wallet";

const App = ({
  currency,
  dateRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
}) => {
  const size = useWindowSize();
  const chartRef = useRef<ChartJSOrUndefined<"pie", string[], unknown>>(null);
  const { needResize } = useContext(ChartResizeContext);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  useEffect(() => {
    loadData().then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
  }, [dateRange]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData() {
    updateLoading(true);

    try {
      const wap = await WALLET_ANALYZER.queryWalletAssetsPercentage();
      setWalletAssetsPercentage(wap);
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
    layout: {
      padding: 20,
    },
    plugins: {
      // text is set for resizing
      title: { display: false, text: chartName },
      legend: {
        display: true,
        position: "right",
        font: {
          size: 13,
        },
        labels: { font: {} },
        onHover: (e: any, legendItem: { index: number }, legend: any) =>
          offsetHoveredItemWrapper(chartRef.current)(e, legendItem, legend),
        // disable onclick
        onClick: () => {},
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { parsed: number }) => {
            return currency.symbol + context.parsed.toLocaleString();
          },
        },
      },
    },
  };

  function lineData() {
    return {
      labels: _(walletAssetsPercentage)
        .map(
          (d) =>
            `${d.percentage.toFixed(2)}% ` +
            (d.walletAlias
              ? `${d.walletType}-${d.walletAlias}`
              : insertEllipsis(d.wallet, 16))
        )
        .value(),
      datasets: [
        {
          data: _(walletAssetsPercentage)
            .map((d) => currencyWrapper(currency)(d.value).toFixed(2))
            .value(),
          borderColor: _(walletAssetsPercentage)
            .map((d) => d.chartColor)
            .value(),
          backgroundColor: _(walletAssetsPercentage)
            .map((d) => d.chartColor)
            .value(),
          borderWidth: 1,
          hoverOffset: 35,
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
              <Pie ref={chartRef} options={options as any} data={lineData()} />,
              "mt-6 h-[30px]",
              6
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
