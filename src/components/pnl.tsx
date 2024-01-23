import { CurrencyRateDetail, PNLData } from "@/middlelayers/types";
import { timestampToDate } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import _ from "lodash";
import { Bar } from "react-chartjs-2";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  simplifyNumber,
} from "@/utils/currency";
import { useContext, useEffect, useState } from "react";
import { loadingWrapper } from "@/lib/loading";
import {
  queryPNLValue,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";

const chartName = "PNL of Asset";

const App = ({
  currency,
  size,
  version,
}: {
  currency: CurrencyRateDetail;
  size: number;
  version: number;
}) => {
  const [loading, setLoading] = useState(false);
  const { needResize } = useContext(ChartResizeContext);
  const [pnlData, setPnlData] = useState<PNLData>({
    data: [],
  });

  useEffect(() => {
    loadData().then(() => resizeChartWithDelay(chartName));
  }, [size, version]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData() {
    setLoading(true);
    try {
      const pd = await queryPNLValue(size);
      setPnlData(pd);
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
      tooltip: {
        callbacks: {
          label: (context: { parsed: { y?: number } }) => {
            const yv = context.parsed.y;
            if (!yv) {
              return "";
            }
            const isNegative = yv < 0;

            const v = Math.abs(yv).toLocaleString();
            return (isNegative ? "-" : "") + currency.symbol + v;
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
          maxRotation: 0,
          minRotation: 0,
          align: "center",
          autoSkip: false,
          callback: function (val: number, index: number) {
            const data = pnlData.data;

            // -1, because we remove first element in labels, but not in pnlData.data
            const size = data.length - 1;
            // both add 1, because the first one is the title
            const start = 0;
            const end = size - 1;
            // only show start and end date
            if (index === start) {
              return timestampToDate(data[index + 1].timestamp);
            }

            if (index === end) {
              return timestampToDate(data[index + 1].timestamp);
            }

            return "";
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        title: {
          display: false,
          text: currency.currency,
        },
        offset: true,
        ticks: {
          precision: 2,
          maxTicksLimit: 4,
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

  function formatPositiveLineData() {
    return _(pnlData.data)
      .map((x, idx) => x.totalValue - (pnlData.data[idx - 1]?.totalValue || 0))
      .map(currencyWrapper(currency))
      .map((x) => (x < 0 ? undefined : x))
      .drop(1)
      .value();
  }
  function formatNegativeLineData() {
    return _(pnlData.data)
      .map((x, idx) => x.totalValue - (pnlData.data[idx - 1]?.totalValue || 0))
      .map(currencyWrapper(currency))
      .map((x) => (x >= 0 ? undefined : x))
      .drop(1)
      .value();
  }

  function getLatestTotalValue(): number | undefined {
    return _.last(pnlData.data)?.totalValue;
  }

  function lineData() {
    return {
      labels: _(pnlData.data)
        // !remove the first element, because it is the comparison of the first and second element
        .tail()
        .map((x) => timestampToDate(x.timestamp))
        .value(),
      // two datasets for different colors
      datasets: [
        {
          label: "Value",
          data: formatPositiveLineData(),
          stack: "value",
          // borderColor: lineColor,
          backgroundColor: "#4caf50",
        },
        {
          // !add a blank in label to make the difference between positive and negative, if they are the same, it will cause display issue when rendering the chart
          label: " Value",
          data: formatNegativeLineData(),
          stack: "value",
          // borderColor: lineColor,
          backgroundColor: "#f44336",
        },
      ],
    };
  }

  function formatPNLValue(val?: number): string {
    if (!val) {
      return "-";
    }
    const valStr =
      currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(val)));
    if (val > 0) {
      return "+" + valStr;
    }
    return "-" + valStr;
  }

  function formatPNLPercentage(val?: number): string {
    if (val === undefined) {
      return "-";
    }
    const latest = getLatestTotalValue();
    if (!latest) {
      return "-";
    }

    let percentage = 0;

    if (val === 0) {
      percentage = 100;
    } else {
      percentage = (val / latest) * 100;
    }

    let percentageStr = percentage.toFixed(2) + "%";

    if (percentage > 0) {
      percentageStr = "+" + percentageStr;
    }

    return percentageStr;
  }

  function formatTimestampData(ts?: number) {
    return ts ? timestampToDate(ts) : "";
  }

  function getPNLTextColor(val?: number): string {
    if (!val) {
      return "text-gray-600";
    }
    return val > 0 ? "text-green-600" : "text-red-600";
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PNL Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex grid grid-cols-3 gap-4">
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlData.todayPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">Last PNL</div>
              {loadingWrapper(
                loading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlData.todayPNL?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlData.todayPNL?.value)}
                </div>,
                "h-[22px]"
              )}
              {loadingWrapper(
                loading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlData.todayPNL?.value
                  )}`}
                >
                  {formatPNLValue(pnlData.todayPNL?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">7T PNL</div>
              {loadingWrapper(
                loading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlData.sevenTPnl?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlData.sevenTPnl?.value)}
                </div>,

                "h-[22px]"
              )}
              {loadingWrapper(
                loading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlData.sevenTPnl?.value
                  )}`}
                >
                  {formatPNLValue(pnlData.sevenTPnl?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">30T PNL</div>
              {loadingWrapper(
                loading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlData.thirtyPNL?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlData.thirtyPNL?.value)}
                </div>,

                "h-[22px]"
              )}
              {loadingWrapper(
                loading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlData.thirtyPNL?.value
                  )}`}
                >
                  {formatPNLValue(pnlData.thirtyPNL?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
          </div>
          <div className="h-30">
            {loadingWrapper(
              loading,
              <Bar options={options as any} data={lineData()} />,
              "mt-[19.5px] h-[18px]",
              4
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
