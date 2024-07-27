import { ChartResizeContext } from "@/App";
import { loadingWrapper } from "@/lib/loading";
import {
  queryPNLChartValue,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import {
  CurrencyRateDetail,
  PNLChartData,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { positiveNegativeColor } from "@/utils/color";
import { currencyWrapper, simplifyNumber } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import _ from "lodash";
import { useContext, useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";

const chartName = "PNL of Asset";

const App = ({
  currency,
  dateRange,
  quoteColor,
  className,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  className?: string;
}) => {
  const { needResize } = useContext(ChartResizeContext);
  const [pnlChartData, setPnlChartData] = useState<PNLChartData>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    loadChartData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      setInitialLoaded(true);
    });
  }, [dateRange]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadChartData(dr: TDateRange) {
    updateLoading(true);
    try {
      const pd = await queryPNLChartValue(dr);
      setPnlChartData(pd);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }

    setChartLoading(val);
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

  function pnlBackgroundColor(val: "positive" | "negative"): string {
    const c = positiveNegativeColor(val === "positive" ? 1 : -1, quoteColor);
    return c === "green" ? "#4caf50" : "#f44336";
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
          backgroundColor: pnlBackgroundColor("positive"),
        },
        {
          // !add a blank in label to make the difference between positive and negative, if they are the same, it will cause display issue when rendering the chart
          label: " Value",
          data: formatNegativeLineData(),
          stack: "value",
          // borderColor: lineColor,
          backgroundColor: pnlBackgroundColor("negative"),
        },
      ],
    };
  }

  return (
    <div className={className}>
      {loadingWrapper(
        chartLoading,
        <Bar options={options as any} data={lineData()} />,
        "mt-[19.5px] h-[18px]",
        4
      )}
    </div>
  );
};

export default App;
