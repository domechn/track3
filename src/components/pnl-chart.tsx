import { ChartResizeContext } from "@/App";
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
import { glassScaleOptions, glassTooltip } from "@/utils/chart-theme";
import { timeToDateStr } from "@/utils/date";
import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

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
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [pnlChartData, setPnlChartData] = useState<PNLChartData>([]);

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadChartData(dateRange).then(() => {
      resizeChartWithDelay(chartName);
      reportLoaded();
    });
  }, [rangeKey]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadChartData(dr: TDateRange) {
    const pd = await queryPNLChartValue(dr);
    setPnlChartData(pd);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: true,
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
        ...glassTooltip,
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
          ...glassScaleOptions.ticks,
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
          ...glassScaleOptions.ticks,
          precision: 2,
          maxTicksLimit: 4,
          callback: (value: any) => {
            return simplifyNumber(value);
          },
        },
        grid: {
          ...glassScaleOptions.grid,
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
    return c === "green" ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)";
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
          backgroundColor: pnlBackgroundColor("positive"),
          borderRadius: 4,
          maxBarThickness: 16,
        },
        {
          // !add a blank in label to make the difference between positive and negative, if they are the same, it will cause display issue when rendering the chart
          label: " Value",
          data: formatNegativeLineData(),
          stack: "value",
          backgroundColor: pnlBackgroundColor("negative"),
          borderRadius: 4,
          maxBarThickness: 16,
        },
      ],
    };
  }

  return (
    <div className={className}>
      <Bar options={options as any} data={lineData()} />
    </div>
  );
};

export default App;
