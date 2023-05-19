import _ from "lodash";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { CoinsAmountChangeData } from "../../middlelayers/types";
import Select from "../common/select";
import "./index.css";

const App = ({ data }: { data: CoinsAmountChangeData }) => {
  const [currentCoinSelected, setCurrentCoinSelected] = useState("");
  const [currentType, setCurrentType] = useState("amount"); // ['amount', 'value'
  const size = useWindowSize();

  useEffect(() => {
    if (data.length > 0) {
      setCurrentCoinSelected(data[0].coin);
    }
  }, [data]);

  function getLabel() {
    // set first char to upper case
    return _.upperFirst(currentType);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: `Trend of Coin ${getLabel()} Value`,
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
          data: current.amounts,
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
      buttons[i].classList.remove("active");
    }

    document.getElementById(type)?.classList.add("active");
  }

  return (
    <>
      <div style={{
        height: 34,
      }}>
        <div className="type-updater button-group">
          <button
            id="amount"
            onClick={() => onTypeSelectChange("amount")}
            className="left active"
          >
            Amount
          </button>
          <button
            id="value"
            onClick={() => onTypeSelectChange("value")}
            className="right"
          >
            Value
          </button>
        </div>
        <div className="type-updater">
          <Select
            options={data.map((d) => ({ value: d.coin, label: d.coin }))}
            onSelectChange={onCoinSelectChange}
            value={currentCoinSelected}
          />
        </div>
      </div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line options={options} data={chartDataByCoin(currentCoinSelected)} />
      </div>
    </>
  );
};

export default App;
