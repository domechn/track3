import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AssetChangeData,
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import { timeToDateStr } from "@/utils/date";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  simplifyNumber,
} from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import _ from "lodash";
import { Line } from "react-chartjs-2";
import {
  queryAssetChange,
  queryTotalValue,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import bluebird from "bluebird";
import { ChartResizeContext } from "@/App";
import { positiveNegativeTextClass } from "@/utils/color";
import {
  chartColors,
  createGradientFill,
  glassScaleOptions,
  glassTooltip,
} from "@/utils/chart-theme";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

interface TotalValueShower {
  currencyName(): string;

  changePercentage(): number;

  formatTotalValue(): string;

  formatChangeValue(): string;
}

const chartName = "Trend of Asset";
const btcSymbol = "₿";

class FiatTotalValue implements TotalValueShower {
  private currency: CurrencyRateDetail;
  private prevValue: number;
  private latestValue: number;

  constructor(
    currency: CurrencyRateDetail,
    prevValue: number,
    latestValue: number
  ) {
    this.currency = currency;
    this.prevValue = prevValue;
    this.latestValue = latestValue;
  }
  formatTotalValue(): string {
    return (
      this.currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(this.currency)(this.latestValue)
      )
    );
  }

  currencyName(): string {
    return this.currency.currency;
  }

  changePercentage(): number {
    return !this.prevValue
      ? 100
      : ((this.latestValue - this.prevValue) / this.prevValue) * 100;
  }

  private getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  formatChangeValue(): string {
    let val = this.latestValue - this.prevValue;
    const p = this.getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return (
      p +
      this.currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(this.currency)(val))
    );
  }
}

class BTCTotalValue implements TotalValueShower {
  private prevValue: number;
  private latestValue: number;
  private preBtcPrice: number;
  private latestBtcPrice: number;

  private symbol = btcSymbol;

  constructor(
    prevValue: number,
    latestValue: number,
    preBtcPrice: number,
    latestBtcPrice: number
  ) {
    this.prevValue = prevValue;
    this.latestValue = latestValue;

    this.preBtcPrice = preBtcPrice;
    this.latestBtcPrice = latestBtcPrice;
  }

  formatTotalValue(): string {
    const bp = this.latestBtcPrice;
    if (!bp) {
      return this.symbol + "0";
    }
    return this.symbol + (this.latestValue / bp).toFixed(8);
  }

  currencyName(): string {
    return "BTC";
  }

  changePercentage(): number {
    const preBTC = this.getBTCAmount(this.prevValue, this.preBtcPrice);
    const latestBTC = this.getBTCAmount(this.latestValue, this.latestBtcPrice);
    if (!preBTC) {
      return !!latestBTC ? 100 : 0;
    }
    return ((latestBTC - preBTC) / preBTC) * 100;
  }

  private getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  formatChangeValue(): string {
    let val =
      this.getBTCAmount(this.latestValue, this.latestBtcPrice) -
      this.getBTCAmount(this.prevValue, this.preBtcPrice);
    const p = this.getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return p + this.symbol + val.toFixed(8);
  }

  private getBTCAmount(value: number, btcPrice: number) {
    if (!btcPrice) {
      return 0;
    }
    return value / btcPrice;
  }
}

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const lineColor = chartColors[0].main;
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [totalValueData, setTotalValueData] = useState<TotalValueData>({
    totalValue: 0,
  });
  const [assetChangeData, setAssetChangeData] = useState<AssetChangeData>({
    timestamps: [],
    data: [],
  });

  const [btcAsBase, setBtcAsBase] = useState(false);

  const [showPercentageInChart, setShowPercentageInChart] = useState(false);

  const [showValue, setShowValue] = useState(false);
  const loadGenRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  const totalValue = useMemo(() => totalValueData.totalValue, [totalValueData]);
  const firstTotalValue = useMemo(() => assetChangeData.data[0]?.usdValue ?? 0, [assetChangeData]);
  const firstDate = useMemo(() => timeToDateStr(assetChangeData.timestamps[0] ?? 0), [assetChangeData]);

  const totalValueShower = useMemo(
    () =>
      getTotalValueShower(
        btcAsBase,
        firstTotalValue,
        totalValue,
        assetChangeData
      ),
    [assetChangeData, firstTotalValue, totalValue, btcAsBase]
  );

  const changedValueOrPercentage = useMemo(() => {
    if (showValue) {
      return totalValueShower.formatChangeValue();
    }
    let val = getPercentageChange(totalValueShower, totalValue, firstTotalValue);
    const p = getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return `${p}${prettyNumberToLocaleString(val)}%`;
  }, [showValue, firstTotalValue, totalValue, totalValueShower]);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    loadData(dateRange, gen).then(() => {
      if (gen !== loadGenRef.current) {
        return;
      }
      resizeChartWithDelay(chartName);
      reportLoaded();
    });
  }, [rangeKey]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(dr: TDateRange, gen: number) {
    return bluebird.all([loadTotalValue(gen), loadChartData(dr, gen)]);
  }

  async function loadTotalValue(gen: number) {
    const tv = await queryTotalValue();
    if (gen !== loadGenRef.current) {
      return;
    }
    setTotalValueData(tv);
  }

  async function loadChartData(dr: TDateRange, gen: number) {
    const ac = await queryAssetChange(dr);
    if (gen !== loadGenRef.current) {
      return;
    }
    setAssetChangeData(ac);
  }

  function getTotalValueShower(
    btcAsBase: boolean,
    firstTotalValue: number,
    totalValue: number,
    assetChangeData: AssetChangeData
  ) {
    if (btcAsBase) {
      return new BTCTotalValue(
        firstTotalValue,
        totalValue,
        assetChangeData.data[0]?.btcPrice ?? 0,
        assetChangeData.data[assetChangeData.data.length - 1]?.btcPrice ?? 0
      );
    }
    return new FiatTotalValue(
      currency,
      firstTotalValue,
      totalValue
    );
  }

  function getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  function getPercentageChange(
    ts: TotalValueShower,
    totalValue: number,
    firstTotalValue: number
  ) {
    // to handle empty data
    if (totalValue === firstTotalValue) {
      return 0;
    }
    if (firstTotalValue === 0) {
      return 100;
    }
    return ts.changePercentage();
  }

  const lineValues = useMemo(() => {
    const baseData = assetChangeData.data[0];
    if (!baseData) {
      return [];
    }

    const baseDataValue =
      (btcAsBase
        ? baseData.btcPrice
          ? baseData.usdValue / baseData.btcPrice
          : 0
        : currencyWrapper(currency)(baseData.usdValue)) || 0.0000000001;

    if (btcAsBase) {
      return _(assetChangeData.data)
        .map((d) => (d.btcPrice ? d.usdValue / d.btcPrice : 0))
        .map((d) =>
          showPercentageInChart ? (d / baseDataValue) * 100 - 100 : d
        )
        .value();
    }
    return _(assetChangeData.data)
      .map((d) => currencyWrapper(currency)(d.usdValue))
      .map((d) => (showPercentageInChart ? (d / baseDataValue) * 100 - 100 : d))
      .value();
  }, [assetChangeData, btcAsBase, currency, showPercentageInChart]);

  function changePercentageColorClass(
    ts: TotalValueShower,
    totalValue: number,
    firstTotalValue: number
  ) {
    const pc = getPercentageChange(ts, totalValue, firstTotalValue);
    return positiveNegativeTextClass(pc, quoteColor, 500);
  }

  const options = useMemo(() => ({
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
          label: (context: { parsed: { y: number } }) => {
            const v = context.parsed.y.toLocaleString();
            if (showPercentageInChart) {
              return `${v}%`;
            }
            if (btcAsBase) {
              return `${btcSymbol}${v}`;
            }
            return currency.symbol + v;
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
            const data = assetChangeData.timestamps;

            const size = data.length;
            const start = 0;
            const end = size - 1;

            // only show start and end date
            if (index === start) {
              return timeToDateStr(data[index]);
            }

            if (index === end) {
              return timeToDateStr(data[index]);
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
            return showPercentageInChart
              ? `${value.toLocaleString()}%`
              : simplifyNumber(value);
          },
        },
        grid: {
          ...glassScaleOptions.grid,
        },
      },
    },
  }), [showPercentageInChart, btcAsBase, currency.symbol, currency.currency, assetChangeData.timestamps]);

  const lineDataMemo = useMemo(() => {
    return {
      labels: assetChangeData.timestamps.map((x) => timeToDateStr(x)),
      datasets: [
        {
          label: "Value",
          data: lineValues,
          borderColor: lineColor,
          backgroundColor: (context: any) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) {
              return chartColors[0].bg;
            }
            return createGradientFill(ctx, chartArea, lineColor);
          },
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointStyle: "rotRect",
          fill: "start",
        },
      ],
    };
  }, [assetChangeData.timestamps, lineValues, lineColor]);

  return (
    <div>
      <Card
        onMouseEnter={() => setShowValue(true)}
        onMouseLeave={() => setShowValue(false)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Value In {totalValueShower.currencyName()}
          </CardTitle>
          <div className="flex space-x-2">
            <svg
              viewBox="0 0 1024 1024"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => setShowPercentageInChart(!showPercentageInChart)}
            >
              <path
                d="M904.8 167.771429l-48.457143-48.457143a9.177143 9.177143 0 0 0-12.914286 0L119.2 843.314286a9.177143 9.177143 0 0 0 0 12.914285l48.457143 48.457143c3.542857 3.542857 9.371429 3.542857 12.914286 0L904.685714 180.571429c3.657143-3.428571 3.657143-9.257143 0.114286-12.8zM274.285714 438.857143c90.742857 0 164.571429-73.828571 164.571429-164.571429s-73.828571-164.571429-164.571429-164.571428-164.571429 73.828571-164.571428 164.571428 73.828571 164.571429 164.571428 164.571429z m0-246.857143c45.371429 0 82.285714 36.914286 82.285715 82.285714s-36.914286 82.285714-82.285715 82.285715-82.285714-36.914286-82.285714-82.285715 36.914286-82.285714 82.285714-82.285714z m475.428572 393.142857c-90.742857 0-164.571429 73.828571-164.571429 164.571429s73.828571 164.571429 164.571429 164.571428 164.571429-73.828571 164.571428-164.571428-73.828571-164.571429-164.571428-164.571429z m0 246.857143c-45.371429 0-82.285714-36.914286-82.285715-82.285714s36.914286-82.285714 82.285715-82.285715 82.285714 36.914286 82.285714 82.285715-36.914286 82.285714-82.285714 82.285714z"
                p-id="4221"
                fill="currentColor"
              ></path>
            </svg>
            <svg
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-muted-foreground cursor-pointer"
              onClick={() => setBtcAsBase(!btcAsBase)}
            >
              <path
                d="M3.35355 1.85355C3.54882 1.65829 3.54882 1.34171 3.35355 1.14645C3.15829 0.951184 2.84171 0.951184 2.64645 1.14645L0.646447 3.14645C0.451184 3.34171 0.451184 3.65829 0.646447 3.85355L2.64645 5.85355C2.84171 6.04882 3.15829 6.04882 3.35355 5.85355C3.54882 5.65829 3.54882 5.34171 3.35355 5.14645L2.20711 4H9.5C11.433 4 13 5.567 13 7.5C13 7.77614 13.2239 8 13.5 8C13.7761 8 14 7.77614 14 7.5C14 5.01472 11.9853 3 9.5 3H2.20711L3.35355 1.85355ZM2 7.5C2 7.22386 1.77614 7 1.5 7C1.22386 7 1 7.22386 1 7.5C1 9.98528 3.01472 12 5.5 12H12.7929L11.6464 13.1464C11.4512 13.3417 11.4512 13.6583 11.6464 13.8536C11.8417 14.0488 12.1583 14.0488 12.3536 13.8536L14.3536 11.8536C14.5488 11.6583 14.5488 11.3417 14.3536 11.1464L12.3536 9.14645C12.1583 8.95118 11.8417 8.95118 11.6464 9.14645C11.4512 9.34171 11.4512 9.65829 11.6464 9.85355L12.7929 11H5.5C3.567 11 2 9.433 2 7.5Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              ></path>
            </svg>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-semibold">{totalValueShower.formatTotalValue()}</div>
          <p className="text-xs text-muted-foreground mb-2">
            <span
              className={changePercentageColorClass(
                totalValueShower,
                totalValue,
                firstTotalValue
              )}
            >
              {changedValueOrPercentage}
            </span>{" "}
            from {firstDate}
          </p>
          <div className="h-[120px]">
            <Line options={options as any} data={lineDataMemo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
