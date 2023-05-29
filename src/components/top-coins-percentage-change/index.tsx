import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { TopCoinsPercentageChangeData } from "../../middlelayers/types";
import { useState } from "react";
import _ from "lodash";

const prefix = "tcpc";

const App = ({ data }: { data: TopCoinsPercentageChangeData }) => {
  const size = useWindowSize();
  const [currentType, setCurrentType] = useState(getWholeKey("value")); // ['tcpcValue', 'tcpcPrice']

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: `Change of Top Coins ${getLabel()} Percentage`,
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Date",
        },
      },
      y: {
        title: {
          display: true,
          text: "Percentage",
        },
        offset: true,
        ticks: {
          precision: 2,
          callback: function (value: number) {
            return value + "%";
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function getLabel() {
    return _.upperFirst(currentType.replace(prefix, ""));
  }

  function coinPercentageData(
    timestamps: number[],
    coinPercentageData: { value: number; price: number; timestamp: number }[]
  ) {
    const coinRankDataMap = new Map<number, number>();
    coinPercentageData.forEach((percentageData) => {
      coinRankDataMap.set(
        percentageData.timestamp,
        currentType === getWholeKey("value")
          ? percentageData.value
          : percentageData.price
      );
    });
    return timestamps.map((date) => coinRankDataMap.get(date) || null);
  }

  function lineData() {
    return {
      labels: data.timestamps.map((x) => timestampToDate(x)),
      datasets: data.coins.map((coin) => ({
        label: coin.coin,
        data: coinPercentageData(data.timestamps, coin.percentageData),
        borderColor: coin.lineColor,
        backgroundColor: coin.lineColor,
        borderWidth: 5,
        tension: 0.1,
        pointRadius: 1,
        pointStyle: "rotRect",
      })),
    };
  }

  function onTypeSelectChange(type: string) {
    setCurrentType(type);

    const buttons = document.getElementsByClassName("active");

    for (let i = 0; i < buttons.length; i++) {
      if (
        [getWholeKey("value"), getWholeKey("price")].includes(buttons[i].id)
      ) {
        buttons[i].classList.remove("active");
      }
    }

    document.getElementById(type)?.classList.add("active");
  }

  function getWholeKey(key: string): string {
    return prefix + _(key).upperFirst();
  }

  return (
    <>
      <div
        style={{
          height: 34,
        }}
      >
        <div className="button-group">
          <button
            id={getWholeKey("value")}
            onClick={() => onTypeSelectChange(getWholeKey("value"))}
            className="left active"
          >
            Value
          </button>
          <button
            id={getWholeKey("price")}
            onClick={() => onTypeSelectChange(getWholeKey("price"))}
            className="right"
          >
            Price
          </button>
        </div>
      </div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line options={options as any} data={lineData()} />
      </div>
    </>
  );
};

export default App;
