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
  prettyNumberToLocaleString,
} from "@/utils/currency";
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
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";

const chartName = "wallet-assets-percentage";

type TopLimit = "8" | "12" | "20" | "all";

function getWalletDisplayName(item: {
  wallet: string;
  walletType?: string;
  walletAlias?: string;
}) {
  if (item.walletAlias) {
    return item.walletType
      ? `${item.walletType}-${item.walletAlias}`
      : item.walletAlias;
  }
  return insertEllipsis(item.wallet, 16);
}

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
  const loadGenRef = useRef(0);
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);
  const [topLimit, setTopLimit] = useState<TopLimit>("12");

  useEffect(() => {
    let mounted = true;
    const gen = ++loadGenRef.current;

    WALLET_ANALYZER.queryWalletAssetsPercentage(symbol)
      .then((wap) => {
        if (!mounted || gen !== loadGenRef.current) {
          return;
        }
        setWalletAssetsPercentage(wap);
        resizeChartWithDelay(chartName);
      })
      .finally(() => {
        if (mounted) {
          reportLoaded();
        }
      });

    return () => {
      mounted = false;
    };
  }, [dateRange, reportLoaded, symbol]);

  useEffect(() => resizeChart(chartName), [needResize]);

  const positiveWallets = useMemo(
    () => walletAssetsPercentage.filter((item) => item.value > 0),
    [walletAssetsPercentage]
  );

  const chartItems = useMemo(() => {
    const sorted = [...positiveWallets].sort((a, b) => b.value - a.value);
    if (topLimit === "all") {
      return sorted;
    }

    const limit = Number(topLimit);
    if (sorted.length <= limit) {
      return sorted;
    }

    const head = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    const restValue = rest.reduce((sum, item) => sum + item.value, 0);
    const restAmount = rest.reduce((sum, item) => sum + item.amount, 0);
    const restPercentage = rest.reduce((sum, item) => sum + item.percentage, 0);

    head.push({
      wallet: "others",
      walletAlias: "Others",
      percentage: restPercentage,
      value: restValue,
      amount: restAmount,
      chartColor: chartColors[(limit + 1) % chartColors.length].main,
    });

    return head;
  }, [positiveWallets, topLimit]);

  const chartHasData = chartItems.length > 0;

  const totalValue = useMemo(
    () => positiveWallets.reduce((sum, item) => sum + item.value, 0),
    [positiveWallets]
  );
  const topWallet = positiveWallets[0];

  const chartData = useMemo(
    () => ({
      labels: chartItems.map(
        (item) => `${item.percentage.toFixed(2)}% ${getWalletDisplayName(item)}`
      ),
      datasets: [
        {
          data: chartItems.map((item) =>
            currencyWrapper(currency)(item.value).toFixed(2)
          ),
          borderColor: "rgba(255,255,255,0.15)",
          backgroundColor: chartItems.map(
            (_item, i) => chartColors[i % chartColors.length].main
          ),
          borderWidth: 2,
          hoverOffset: 12,
        },
      ],
    }),
    [chartItems, currency]
  );

  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      layout: {
        padding: 20,
      },
      plugins: {
        title: { display: false, text: chartName },
        legend: {
          display: true,
          position: "right" as const,
          labels: { font: { size: 11 } },
          onHover: (e: unknown, legendItem: { index: number }, legend: unknown) =>
            offsetHoveredItemWrapper(chartRef.current)(e, legendItem, legend),
          onClick: () => {},
        },
        datalabels: {
          display: false,
        },
        tooltip: {
          ...glassTooltip,
          callbacks: {
            label: (context: { dataIndex: number; parsed: number }) => {
              const item = chartItems[context.dataIndex];
              if (!item) {
                return `${currency.symbol}${context.parsed.toLocaleString()}`;
              }

              if (displayAmount) {
                return `${prettyNumberKeepNDigitsAfterDecimalPoint(
                  item.amount,
                  4
                )} / ${currency.symbol}${context.parsed.toLocaleString()}`;
              }

              return `${currency.symbol}${context.parsed.toLocaleString()}`;
            },
          },
        },
      },
    }),
    [chartItems, currency.symbol, displayAmount]
  );

  const chartHeight = Math.max(Math.min((size.height || 760) * 0.55, 520), 340);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {symbol ? `${symbol} ` : ""}Wallet Allocation
        </CardTitle>
        <ButtonGroup value={topLimit} onValueChange={(v) => setTopLimit(v as TopLimit)}>
          <ButtonGroupItem value="8">Top 8</ButtonGroupItem>
          <ButtonGroupItem value="12">Top 12</ButtonGroupItem>
          <ButtonGroupItem value="20">Top 20</ButtonGroupItem>
          <ButtonGroupItem value="all">All</ButtonGroupItem>
        </ButtonGroup>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <div>
            Wallets: <span className="text-foreground">{positiveWallets.length}</span>
          </div>
          <div>
            Showing: <span className="text-foreground">{chartItems.length}</span>
          </div>
          <div>
            Total Value:{" "}
            <span className="text-foreground">
              {currency.symbol}
              {prettyNumberToLocaleString(currencyWrapper(currency)(totalValue))}
            </span>
          </div>
          <div>
            Top Wallet:{" "}
            <span className="text-foreground">
              {topWallet ? getWalletDisplayName(topWallet) : "-"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          {chartHasData ? (
            <Pie ref={chartRef} options={options as any} data={chartData} />
          ) : (
            <div className="text-lg text-muted-foreground m-auto">
              No Available Data For Selected Dates
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
