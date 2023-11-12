import _ from "lodash";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { timestampToDate } from "@/utils/date";
import {
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
} from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";
import { ButtonGroup, ButtonGroupItem } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const prefix = "caaavc";

const App = ({
  currency,
  data,
}: {
  currency: CurrencyRateDetail;
  data: CoinsAmountAndValueChangeData;
}) => {
  const [currentCoinSelected, setCurrentCoinSelected] = useState("");
  const [currentType, setCurrentType] = useState(getWholeKey("amount")); // ['caaavcAmount', 'caaavcValue']
  const size = useWindowSize();

  useEffect(() => {
    if (data.length > 0) {
      setCurrentCoinSelected(data[0].coin);
    }
  }, [data]);

  function getLabel() {
    // set first char to upper case
    const val = _.upperFirst(currentType.replace(prefix, ""));
    if (val !== "Value") {
      return val;
    }

    return `${currency.currency} ${val}`;
  }

  function getWholeKey(key: string) {
    return prefix + _.upperFirst(key);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: false,
        // text is set for resizing
        text: `Trend of Coin ${getLabel()}`,
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
      y: {
        title: {
          display: false,
        },
        offset: true,
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
          label: coin + " " + getLabel(),
          data:
            currentType === getWholeKey("amount")
              ? current.amounts
              : _(current.values)
                  .map((v) => currencyWrapper(currency)(v))
                  .value(),
          borderColor: current.lineColor,
          backgroundColor: current.lineColor,
          borderWidth: 4,
          tension: 0.1,
          pointRadius: 0.2,
          pointStyle: "rotRect",
        },
      ],
    };
  }

  function onCoinSelectChange(coin: string) {
    setCurrentCoinSelected(coin);
  }

  function onTypeSelectChange(type: string) {
    setCurrentType(type);

    const buttons = document.getElementsByClassName("active");

    for (let i = 0; i < buttons.length; i++) {
      if (
        [getWholeKey("amount"), getWholeKey("value")].includes(buttons[i].id)
      ) {
        buttons[i].classList.remove("active");
      }
    }

    document.getElementById(type)?.classList.add("active");
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Trend of Coin {getLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex">
            <ButtonGroup
              defaultValue="amount"
              onValueChange={(val: string) =>
                onTypeSelectChange(getWholeKey(val))
              }
            >
              <ButtonGroupItem value="amount">Amount</ButtonGroupItem>
              <ButtonGroupItem value="value">Value</ButtonGroupItem>
            </ButtonGroup>
            <div className="ml-5">
              <Select
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
              </Select>
            </div>
          </div>
          <div
            style={{
              height: Math.max((size.height || 100) / 2, 350),
            }}
          >
            <Line
              options={options}
              data={chartDataByCoin(currentCoinSelected)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
