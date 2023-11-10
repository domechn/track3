import { useEffect, useState } from "react";
import {
  AssetChangeData,
  CurrencyRateDetail,
  TotalValueData,
} from "@/middlelayers/types";
import { timestampToDate } from "@/utils/date";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import _ from "lodash";
import { Line } from "react-chartjs-2";

interface TotalValueShower {
  currencyName(): string;

  changePercentage(): number;

  formatTotalValue(): string;

  formatChangeValue(): string;
}

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

  private symbol = "₿";

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
    return "BTC"
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
  totalValueData,
  assetChangeData,
  currency,
}: {
  currency: CurrencyRateDetail;
  assetChangeData: AssetChangeData;
  totalValueData: TotalValueData;
}) => {
  const lineColor = "rgba(255, 99, 71, 1)";

  const [changedValueOrPercentage, setChangedValueOrPercentage] = useState("");

  const [btcAsBase, setBtcAsBase] = useState(false);

  useEffect(() => {
    setChangedValueOrPercentage(formatChangePercentage());
  }, [totalValueData]);

  function getTotalValueShower() {
    if (btcAsBase) {
      return new BTCTotalValue(
        totalValueData.prevTotalValue,
        totalValueData.totalValue,
        getPreviousBTCPrice(),
        getLatestBTCPrice()
      );
    }
    return new FiatTotalValue(
      currency,
      totalValueData.prevTotalValue,
      totalValueData.totalValue
    );
  }

  function formatTotalValue() {
    return getTotalValueShower().formatTotalValue();
  }

  function getLatestBTCPrice() {
    return assetChangeData.data[assetChangeData.data.length - 1].btcPrice ?? 0;
  }

  function getPreviousBTCPrice() {
    return assetChangeData.data[assetChangeData.data.length - 2].btcPrice ?? 0;
  }

  function getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  function formatCurrencyName() {
    return getTotalValueShower().currencyName();
  }

  function getPercentageChange() {
    if (totalValueData.prevTotalValue === 0) {
      return 100;
    }
    return getTotalValueShower().changePercentage();
  }

  function formatChangePercentage() {
    let val = getPercentageChange();
    const p = getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return `${p}${prettyNumberToLocaleString(val)}%`;
  }

  function formatChangeValue() {
    return getTotalValueShower().formatChangeValue();
  }

  function formatLineData() {
    if (btcAsBase) {
      return _(assetChangeData.data)
        .map((d) => (d.btcPrice ? d.usdValue / d.btcPrice : 0))
        .value();
    }
    return _(assetChangeData.data)
      .map((d) => currencyWrapper(currency)(d.usdValue))
      .value();
  }

  function changePercentageColorClass() {
    if (getPercentageChange() === 0) {
      return "text-gray-500";
    }
    return getPercentageChange() > 0 ? "text-green-500" : "text-red-500";
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: false,
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
          text: "Date",
        },
        ticks: {
          maxTicksLimit: 2,
          autoSkip: false,
          labelOffset: -5,
          callback: function (val: number, index: number) {
            const total = _(assetChangeData.timestamps).size() - 1;

            // only show start and end date
            return index === 0 || index === total - 1
              ? timestampToDate(assetChangeData.timestamps[index])
              : "";
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

  function lineData() {
    return {
      labels: assetChangeData.timestamps.map((x) => timestampToDate(x)),
      datasets: [
        {
          label: "Value",
          data: formatLineData(),
          borderColor: lineColor,
          backgroundColor: lineColor,
          borderWidth: assetChangeData.data.length > 20 ? 2 : 4,
          tension: 0.1,
          pointRadius: assetChangeData.data.length > 20 ? 0 : 0.3,
          pointStyle: "rotRect",
        },
      ],
    };
  }

  return (
    <div>
      <Card
        onMouseEnter={() => setChangedValueOrPercentage(formatChangeValue())}
        onMouseLeave={() =>
          setChangedValueOrPercentage(formatChangePercentage())
        }
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Value In {formatCurrencyName()}
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground cursor-pointer"
            onClick={() => setBtcAsBase(!btcAsBase)}
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTotalValue()}</div>
          <p className="text-xs text-muted-foreground">
            <span className={changePercentageColorClass()}>
              {changedValueOrPercentage}
            </span>{" "}
            from last time
          </p>
          <div className="h-30">
            <Line options={options as any} data={lineData()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
