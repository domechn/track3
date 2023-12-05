import _ from "lodash";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timestampToDate } from "@/utils/date";
import {
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
} from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const App = ({
  currency,
  data,
  symbol
}: {
  currency: CurrencyRateDetail;
  data: CoinsAmountAndValueChangeData;
  symbol: string;
}) => {
  const size = useWindowSize();
  const y1Color = "#4F46E5";
  const y2Color = "#F97316";

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
        text: "Trend of Coins",
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
      },
      y1: {
        title: {
          display: false,
        },
        offset: true,
        position: "left",
        ticks: {
          precision: 4,
        },
        grid: {
          display: false,
        },
      },
      y2: {
        title: {
          display: false,
        },
        offset: true,
        position: "right",
        ticks: {
          precision: 4,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function chartDataByCoin(coin: string) {
    const current = data.find((d) => d.coin === coin);
    if (!current) {
      return {
        labels: [],
        datasets: [],
      };
    }
    return {
      labels: current.timestamps.map((x) => timestampToDate(x)),
      datasets: [
        {
          label: `Value(${currency.currency})`,
          data: _(current.values)
            .map((v) => currencyWrapper(currency)(v))
            .value(),
          borderColor: y1Color,
          backgroundColor: y1Color,
          borderWidth: 4,
          tension: 0.1,
          pointRadius: 0.2,
          pointStyle: "rotRect",
          yAxisID: "y1",
        },
        {
          label: "Amount",
          data: current.amounts,
          borderColor: y2Color,
          backgroundColor: y2Color,
          borderWidth: 4,
          tension: 0.1,
          pointRadius: 0.2,
          pointStyle: "rotRect",
          yAxisID: "y2",
        },
      ],
    };
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Trend of Coins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            {/* <Select
              onValueChange={onCoinSelectChange}
              value={currentCoinSelected}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select Coin" />
              </SelectTrigger>
              <SelectContent className="overflow-y-auto max-h-[20rem]">
                <SelectGroup>
                  <SelectLabel>Coins</SelectLabel>
                  {data.map((d) => (
                    <SelectItem key={d.coin} value={d.coin}>
                      {d.coin}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select> */}
          </div>
          <div
            style={{
              height: Math.max((size.height || 100) / 2, 350),
            }}
          >
            <Line
              options={options as any}
              data={chartDataByCoin(symbol)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
