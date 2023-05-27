import _ from "lodash";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { CoinsAmountAndValueChangeData } from "../../middlelayers/types";
import Select from "../common/select";
import "./index.css";

const prefix = "caaavc"

const App = ({ data }: { data: CoinsAmountAndValueChangeData }) => {
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
    return _.upperFirst(currentType.replace(prefix, ""));
  }

  function getWholeKey(key: string) {
    return prefix + _.upperFirst(key);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: `Trend of Coin ${getLabel()}`,
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
          text: getLabel(),
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
      labels: current.timestamps.map(timestampToDate),
      datasets: [
        {
          label: coin + " " + getLabel(),
          data: currentType === getWholeKey("amount") ? current.amounts : current.values,
          borderColor: current.lineColor,
          backgroundColor: current.lineColor,
          borderWidth: 5,
          tension: 0.1,
          pointRadius: 1,
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
      if ([getWholeKey("amount"), getWholeKey("value")].includes(buttons[i].id)) {
        buttons[i].classList.remove("active");
      }
    }

    document.getElementById(type)?.classList.add("active");
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
            id={getWholeKey("amount")}
            onClick={() => onTypeSelectChange(getWholeKey("amount"))}
            className="left active"
          >
            Amount
          </button>
          <button
            id={getWholeKey("value")}
            onClick={() => onTypeSelectChange(getWholeKey("value"))}
            className="right"
          >
            Value
          </button>
        </div>
        <div>
          <Select
            height={34}
            options={data.map((d) => ({ value: d.coin, label: d.coin }))}
            onSelectChange={onCoinSelectChange}
            value={currentCoinSelected}
          />
        </div>
      </div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
          marginTop: 35,
        }}
      >
        <Line options={options} data={chartDataByCoin(currentCoinSelected)} />
      </div>
    </>
  );
};

export default App;
