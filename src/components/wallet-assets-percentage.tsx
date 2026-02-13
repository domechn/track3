import { Pie } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import {
  CurrencyRateDetail,
  TDateRange,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
} from "@/utils/currency";
import _ from "lodash";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { insertEllipsis } from "@/utils/string";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  WALLET_ANALYZER,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { offsetHoveredItemWrapper } from "@/utils/legend";
import { chartColors, glassTooltip } from "@/utils/chart-theme";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const chartName = "Percentage And Total Value of Each Wallet";

const App = ({
  currency,
  dateRange,
  symbol,
  displayAmount,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  symbol?: string;
  displayAmount?: boolean;
}) => {
  const size = useWindowSize();
  const chartRef = useRef<ChartJSOrUndefined<"pie", string[], unknown>>(null);
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  const chartHasData = useMemo(
    () =>
      !_(walletAssetsPercentage)
        .filter((p) => p.value > 0)
        .isEmpty(),
    [walletAssetsPercentage]
  );

  useEffect(() => {
    loadData(symbol).then(() => {
      resizeChartWithDelay(chartName);
      reportLoaded();
    });
  }, [symbol, dateRange]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(s?: string) {
    const wap = await WALLET_ANALYZER.queryWalletAssetsPercentage(s);
    setWalletAssetsPercentage(wap);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: true,
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
        ...glassTooltip,
        callbacks: {
          label: (context: { dataIndex: number; parsed: number }) => {
            const p = walletAssetsPercentage[context.dataIndex];
            if (p && displayAmount) {
              return `${prettyNumberKeepNDigitsAfterDecimalPoint(
                p.amount,
                4
              )} / ${currency.symbol}${context.parsed.toLocaleString()}`;
            }

            return `${currency.symbol}${context.parsed.toLocaleString()}`;
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
          borderColor: "rgba(255,255,255,0.15)",
          backgroundColor: walletAssetsPercentage.map(
            (_d, i) => chartColors[i % chartColors.length].main
          ),
          borderWidth: 2,
          hoverOffset: 12,
        },
      ],
    };
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {symbol ? symbol + " " : ""}Percentage And Total Value of Each
            Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="flex items-center justify-center"
            style={{
              height: Math.max((size.height || 100) / 2, 400),
            }}
          >
            {chartHasData ? (
              <Pie
                ref={chartRef}
                options={options as any}
                data={lineData()}
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
