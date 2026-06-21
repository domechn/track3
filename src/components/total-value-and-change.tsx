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
import { Button } from "@/components/ui/button";
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
import { useTranslation, useLocaleTag } from "@/i18n";

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

  constructor(currency: CurrencyRateDetail, prevValue: number, latestValue: number) {
    this.currency = currency;
    this.prevValue = prevValue;
    this.latestValue = latestValue;
  }
  formatTotalValue(): string {
    return (
      this.currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(this.currency)(this.latestValue),
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
    latestBtcPrice: number,
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

  private getBTCAmount(value: number, btcPrice: number): number {
    if (!btcPrice) {
      return 0;
    }
    return value / btcPrice;
  }
}

function getTotalValueShower(
  currency: CurrencyRateDetail,
  firstTotalValue: number | null,
  lastTotalValue: number,
  preBtcPrice: number,
  latestBtcPrice: number,
  btcAsBase: boolean,
): TotalValueShower {
  if (btcAsBase) {
    return new BTCTotalValue(
      firstTotalValue ?? 0,
      lastTotalValue,
      preBtcPrice,
      latestBtcPrice,
    );
  }
  return new FiatTotalValue(currency, firstTotalValue ?? 0, lastTotalValue);
}

function changePercentageColorClass(
  totalValueShower: TotalValueShower,
  lastTotalValue: number,
  firstTotalValue: number | null,
): string {
  if (!lastTotalValue) {
    return "text-muted-foreground";
  }
  if (!firstTotalValue) {
    return "text-emerald-500";
  }
  return positiveNegativeTextClass(totalValueShower.changePercentage());
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
  const { t } = useTranslation();
  const localeTag = useLocaleTag();
  const [firstTotalValue, setFirstTotalValue] = useState<number | null>(null);
  const [firstDate, setFirstDate] = useState<string>("-");
  const [lastTotalValue, setLastTotalValue] = useState<number>(0);
  const [showValue, setShowValue] = useState<boolean>(false);
  const [preBtcPrice, setPreBtcPrice] = useState<number>(0);
  const [latestBtcPrice, setLatestBtcPrice] = useState<number>(0);
  const [assetChangeData, setAssetChangeData] = useState<AssetChangeData>({
    timestamps: [],
    data: [],
  });
  const [showPercentageInChart, setShowPercentageInChart] = useState<boolean>(false);
  const [btcAsBase, setBtcAsBase] = useState<boolean>(false);
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const lastLoadGen = useRef(0);

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  const totalValue = useMemo<TotalValueData | null>(() => {
    if (!assetChangeData?.data?.length) {
      return null;
    }
    const last = assetChangeData.data[assetChangeData.data.length - 1];
    if (!last) {
      return null;
    }
    return { totalValue: last.usdValue };
  }, [assetChangeData]);

  useEffect(() => {
    const gen = ++lastLoadGen.current;
    let active = true;
    (async () => {
      const [ac, tv] = await Promise.all([
        queryAssetChange(dateRange),
        queryTotalValue(dateRange),
      ]);
      if (!active || gen !== lastLoadGen.current) {
        return;
      }
      setAssetChangeData(ac);
      setLastTotalValue(tv.totalValue);
      const first = ac.data[0];
      setFirstTotalValue(first ? first.usdValue : null);
      const firstTs = ac.timestamps[0];
      if (firstTs) {
        setFirstDate(timeToDateStr(firstTs));
      }
      setPreBtcPrice(first?.btcPrice ?? 0);
      const last = ac.data[ac.data.length - 1];
      setLatestBtcPrice(last?.btcPrice ?? 0);
      resizeChartWithDelay(chartName);
      reportLoaded();
    })();
    return () => {
      active = false;
    };
  }, [rangeKey, reportLoaded]);

  useEffect(() => resizeChart(chartName), [needResize]);

  const totalValueShower = useMemo(
    () =>
      getTotalValueShower(
        currency,
        firstTotalValue,
        lastTotalValue,
        preBtcPrice,
        latestBtcPrice,
        btcAsBase,
      ),
    [currency, firstTotalValue, lastTotalValue, preBtcPrice, latestBtcPrice, btcAsBase],
  );

  const changedValueOrPercentage = useMemo(() => {
    if (!lastTotalValue || firstTotalValue === null) {
      return "-";
    }
    const pct = totalValueShower.changePercentage();
    if (showValue) {
      return totalValueShower.formatChangeValue();
    }
    return `${pct >= 0 ? "+" : pct < 0 ? "-" : ""}${prettyNumberToLocaleString(
      Math.abs(pct),
    )}%`;
  }, [lastTotalValue, firstTotalValue, totalValueShower, showValue]);

  const lineValues = useMemo(() => {
    if (!assetChangeData?.data?.length) {
      return [] as number[];
    }
    if (showPercentageInChart) {
      const first = assetChangeData.data[0]?.usdValue ?? 0;
      return assetChangeData.data.map((d) =>
        first ? ((d.usdValue - first) / first) * 100 : 0,
      );
    }
    if (btcAsBase) {
      return assetChangeData.data.map((d) =>
        d.btcPrice ? d.usdValue / d.btcPrice : 0,
      );
    }
    return assetChangeData.data.map((d) => d.usdValue);
  }, [assetChangeData, showPercentageInChart, btcAsBase]);

  const lineColor = useMemo(() => {
    const pct = totalValueShower.changePercentage();
    return pct >= 0 ? chartColors[0].main : chartColors[1].main;
  }, [totalValueShower]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        tooltip: {
          ...glassTooltip,
          callbacks: {
            label: (context: { parsed: { y: number } }) => {
              const v = context.parsed.y;
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

              if (index === start) {
                return timeToDateStr(data[index], false, localeTag);
              }

              if (index === end) {
                return timeToDateStr(data[index], false, localeTag);
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
                ? `${value.toLocaleString(localeTag)}%`
                : simplifyNumber(value);
            },
          },
          grid: {
            ...glassScaleOptions.grid,
          },
        },
      },
    }),
    [
      showPercentageInChart,
      btcAsBase,
      currency.symbol,
      currency.currency,
      assetChangeData.timestamps,
      localeTag,
    ],
  );

  const lineDataMemo = useMemo(() => {
    return {
      labels: assetChangeData.timestamps.map((x) =>
        timeToDateStr(x, false, localeTag),
      ),
      datasets: [
        {
          label: t("common.value"),
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
  }, [assetChangeData.timestamps, lineValues, lineColor, t, localeTag]);

  return (
    <div className="h-full">
      <Card
        className="flex h-full flex-col"
        onMouseEnter={() => setShowValue(true)}
        onMouseLeave={() => setShowValue(false)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("common.total")} {t("common.value")} {t("common.in")}{" "}
            {totalValueShower.currencyName()}
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-muted-foreground sm:h-8 sm:w-8"
              aria-label={t("overview.showPercentage")}
              onClick={() => setShowPercentageInChart(!showPercentageInChart)}
            >
              <svg
                viewBox="0 0 1024 1024"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M904.8 167.771429l-48.457143-48.457143a9.177143 9.177143 0 0 0-12.914286 0L119.2 843.314286a9.177143 9.177143 0 0 0 0 12.914285l48.457143 48.457143c3.542857 3.542857 9.371429 3.542857 12.914286 0L904.685714 180.571429c3.657143-3.428571 3.657143-9.257143 0.114286-12.8zM274.285714 438.857143c90.742857 0 164.571429-73.828571 164.571429-164.571429s-73.828571-164.571429-164.571429-164.571428-164.571429 73.828571-164.571428 164.571428 73.828571 164.571429 164.571428 164.571429z m0-246.857143c45.371429 0 82.285714 36.914286 82.285715 82.285714s-36.914286 82.285714-82.285715 82.285715-82.285714-36.914286-82.285714-82.285715 36.914286-82.285714 82.285714-82.285714z m475.428572 393.142857c-90.742857 0-164.571429 73.828571-164.571429 164.571429s73.828571 164.571429 164.571429 164.571428 164.571429-73.828571 164.571428-164.571428-73.828571-164.571429-164.571428-164.571429z m0 246.857143c-45.371429 0-82.285714-36.914286-82.285715-82.285714s36.914286-82.285715 82.285715-82.285715 82.285714 36.914286 82.285714 82.285715-36.914286 82.285714-82.285714 82.285714z"
                  p-id="4221"
                  fill="currentColor"
                ></path>
              </svg>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-muted-foreground sm:h-8 sm:w-8"
              aria-label={t("overview.switchBaseCurrency")}
              onClick={() => setBtcAsBase(!btcAsBase)}
            >
              <svg
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M3.35355 1.85355C3.54882 1.65829 3.54882 1.34171 3.35355 1.14645C3.15829 0.951184 2.84171 0.951184 2.64645 1.14645L0.646447 3.14645C0.451184 3.34171 0.451184 3.65829 0.646447 3.85355L2.64645 5.85355C2.84171 6.04882 3.15829 6.04882 3.35355 5.85355C3.54882 5.65829 3.54882 5.34171 3.35355 5.14645L2.20711 4H9.5C11.433 4 13 5.567 13 7.5C13 7.77614 13.2239 8 13.5 8C13.7761 8 14 7.77614 14 7.5C14 5.01472 11.9853 3 9.5 3H2.20711L3.35355 1.85355ZM2 7.5C2 7.22386 1.77614 7 1.5 7C1.22386 7 1 7.22386 1 7.5C1 9.98528 3.01472 12 5.5 12H12.7929L11.6464 13.1464C11.4512 13.3417 11.4512 13.6583 11.6464 13.8536C11.8417 14.0488 12.1583 14.0488 12.3536 13.8536L14.3536 11.8536C14.5488 11.6583 14.5488 11.3417 14.3536 11.1464L12.3536 9.14645C12.1583 8.95118 11.8417 8.95118 11.6464 9.14645C11.4512 9.34171 11.4512 9.65829 11.6464 9.85355L12.7929 11H5.5C3.567 11 2 9.433 2 7.5Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                ></path>
              </svg>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="text-2xl font-semibold font-mono tabular-nums tracking-tight">
            {totalValueShower.formatTotalValue()}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            <span
              className={`tabular-nums ${changePercentageColorClass(
                totalValueShower,
                lastTotalValue,
                firstTotalValue,
              )}`}
            >
              {changedValueOrPercentage}
            </span>{" "}
            {t("common.from")} {firstDate}
          </p>
          <div className="min-h-[120px] flex-1">
            <Line options={options as any} data={lineDataMemo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
