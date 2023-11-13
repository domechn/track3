import { CurrencyRateDetail, PNLData } from "@/middlelayers/types";
import { timestampToDate } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import _ from "lodash";
import { Bar } from "react-chartjs-2";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";

const App = ({
  currency,
  pnlData,
}: {
  currency: CurrencyRateDetail;
  pnlData: PNLData;
}) => {
  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: false,
        // text is set for resizing
        text: "PNL of Asset",
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
        ticks: {
          maxTicksLimit: 2,
          autoSkip: false,
          labelOffset: -2,
          callback: function (val: number, index: number) {
            const { data } = pnlData;
            const size = _(data).size();

            const start = 0;
            // !to fix display issue
            const end = size < 40 ? size - 2 : size - 4;

            // only show start and end date
            if (index === start) {
              return timestampToDate(data[start].timestamp);
            }

            if (index === end) {
              return timestampToDate(data[size - 1].timestamp);
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
      .map((x) => Math.max(0, x))
      .drop(1)
      .value();
  }
  function formatNegativeLineData() {
    return _(pnlData.data)
      .map((x, idx) => x.totalValue - (pnlData.data[idx - 1]?.totalValue || 0))
      .map(currencyWrapper(currency))
      .map((x) => Math.min(0, x))
      .drop(1)
      .value();
  }

  function getLatestTotalValue(): number | undefined {
    return _.last(pnlData.data)?.totalValue;
  }

  function lineData() {
    return {
      labels: _(pnlData.data)
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
      prettyNumberToLocaleString(currencyWrapper(currency)(val));
    if (val > 0) {
      return "+" + valStr;
    }
    return valStr;
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
              <div
                className={`text-l font-bold ${getPNLTextColor(
                  pnlData.todayPNL?.value
                )}`}
              >
                {formatPNLPercentage(pnlData.todayPNL?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlData.todayPNL?.value
                )}`}
              >
                {formatPNLValue(pnlData.todayPNL?.value)}
              </p>
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">7T PNL</div>
              <div
                className={`text-l font-bold ${getPNLTextColor(
                  pnlData.sevenTPnl?.value
                )}`}
              >
                {formatPNLPercentage(pnlData.sevenTPnl?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlData.sevenTPnl?.value
                )}`}
              >
                {formatPNLValue(pnlData.sevenTPnl?.value)}
              </p>
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">30T PNL</div>
              <div
                className={`text-l font-bold ${getPNLTextColor(
                  pnlData.thirtyPNL?.value
                )}`}
              >
                {formatPNLPercentage(pnlData.thirtyPNL?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlData.thirtyPNL?.value
                )}`}
              >
                {formatPNLValue(pnlData.thirtyPNL?.value)}
              </p>
            </div>
          </div>
          <div className="h-30">
            <Bar options={options as any} data={lineData()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
