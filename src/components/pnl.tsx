import {
  CurrencyRateDetail,
  PNLChartData,
  PNLTableDate,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { timeToDateStr } from "@/utils/date";
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
  queryPNLChartValue,
  queryPNLTableValue,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { positiveNegativeColor } from '@/utils/color'

const chartName = "PNL of Asset";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor
}) => {
  const [tableLoading, setTableLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const { needResize } = useContext(ChartResizeContext);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [pnlTableData, setPnlTableData] = useState<PNLTableDate>({});
  const [pnlChartData, setPnlChartData] = useState<PNLChartData>([]);

  useEffect(() => {
    loadChartData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
    loadTableData();
  }, [dateRange]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadTableData() {
    updateLoading(true, "table");
    try {
      const pd = await queryPNLTableValue();
      setPnlTableData(pd);
    } finally {
      updateLoading(false, "table");
    }
  }

  async function loadChartData(dr: TDateRange) {
    updateLoading(true, "chart");
    try {
      const pd = await queryPNLChartValue(dr);
      setPnlChartData(pd);
    } finally {
      updateLoading(false, "chart");
    }
  }

  function updateLoading(val: boolean, loadingType: "chart" | "table") {
    if (initialLoaded) {
      return;
    }

    if (loadingType === "chart") {
      setChartLoading(val);
    } else if (loadingType === "table") {
      setTableLoading(val);
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
            const data = pnlChartData;

            // -1, because we remove first element in labels, but not in pnlData.data
            const size = data.length - 1;
            // both add 1, because the first one is the title
            const start = 0;
            const end = size - 1;
            // only show start and end date
            if (index === start) {
              return timeToDateStr(data[index + 1].timestamp);
            }

            if (index === end) {
              return timeToDateStr(data[index + 1].timestamp);
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
    return _(pnlChartData)
      .map((x, idx) => x.totalValue - (pnlChartData[idx - 1]?.totalValue || 0))
      .map(currencyWrapper(currency))
      .map((x) => (x < 0 ? undefined : x))
      .drop(1)
      .value();
  }
  function formatNegativeLineData() {
    return _(pnlChartData)
      .map((x, idx) => x.totalValue - (pnlChartData[idx - 1]?.totalValue || 0))
      .map(currencyWrapper(currency))
      .map((x) => (x >= 0 ? undefined : x))
      .drop(1)
      .value();
  }

  function getLatestTotalValue(): number | undefined {
    return _.last(pnlChartData)?.totalValue;
  }

  function pnlBackgroundColor(val: 'positive' | 'negative'): string {
    const c = positiveNegativeColor(val === 'positive' ? 1 : -1, quoteColor)
    return c === 'green' ? '#4caf50' : '#f44336'
  }

  function lineData() {
    return {
      labels: _(pnlChartData)
        // !remove the first element, because it is the comparison of the first and second element
        .tail()
        .map((x) => timeToDateStr(x.timestamp))
        .value(),
      // two datasets for different colors
      datasets: [
        {
          label: "Value",
          data: formatPositiveLineData(),
          stack: "value",
          // borderColor: lineColor,
          backgroundColor: pnlBackgroundColor('positive'),
        },
        {
          // !add a blank in label to make the difference between positive and negative, if they are the same, it will cause display issue when rendering the chart
          label: " Value",
          data: formatNegativeLineData(),
          stack: "value",
          // borderColor: lineColor,
          backgroundColor: pnlBackgroundColor('negative')
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
    return ts ? timeToDateStr(ts) : "";
  }

  function getPNLTextColor(val?: number): string {
    const c = positiveNegativeColor(val ?? 0, quoteColor);
    return `text-${c}-600`;
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
              title={formatTimestampData(pnlTableData.todayPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">Last PNL</div>
              {loadingWrapper(
                tableLoading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlTableData.todayPNL?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlTableData.todayPNL?.value)}
                </div>,
                "h-[22px]"
              )}
              {loadingWrapper(
                tableLoading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlTableData.todayPNL?.value
                  )}`}
                >
                  {formatPNLValue(pnlTableData.todayPNL?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlTableData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">7T PNL</div>
              {loadingWrapper(
                tableLoading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlTableData.sevenTPnl?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlTableData.sevenTPnl?.value)}
                </div>,
                "h-[22px]"
              )}
              {loadingWrapper(
                tableLoading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlTableData.sevenTPnl?.value
                  )}`}
                >
                  {formatPNLValue(pnlTableData.sevenTPnl?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlTableData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">30T PNL</div>
              {loadingWrapper(
                tableLoading,
                <div
                  className={`text-l font-bold ${getPNLTextColor(
                    pnlTableData.thirtyPNL?.value
                  )}`}
                >
                  {formatPNLPercentage(pnlTableData.thirtyPNL?.value)}
                </div>,
                "h-[22px]"
              )}
              {loadingWrapper(
                tableLoading,
                <p
                  className={`text-xs ${getPNLTextColor(
                    pnlTableData.thirtyPNL?.value
                  )}`}
                >
                  {formatPNLValue(pnlTableData.thirtyPNL?.value)}
                </p>,
                "h-[14px] mt-[4px]"
              )}
            </div>
          </div>
          <div className="h-30">
            {loadingWrapper(
              chartLoading,
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
