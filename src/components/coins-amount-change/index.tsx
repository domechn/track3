import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { CoinsAmountChangeData } from "../../middlelayers/types";
import { queryCoinsAmountChange } from "../../middlelayers/charts";
import "./index.css";

const App = () => {
  const [data, setData] = useState([] as CoinsAmountChangeData);
  const [currentCoinSelected, setCurrentCoinSelected] = useState("");
  const size = useWindowSize();

  useEffect(() => {
    queryCoinsAmountChange().then((d) => {
      setData(d);
      if (d.length > 0) {
        setCurrentCoinSelected(d[0].coin);
      }
    });
  }, []);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Trend of Coin Amount Value",
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
          text: "Amount",
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
          label: coin + " Amount",
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

  function onCoinSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const coin = e.target.value;
    setCurrentCoinSelected(coin);
  }

  return (
    <div>
      <label className="nice-select">
        <select id="slct" name="coins" onChange={onCoinSelectChange}>
          {data.map((d) => {
            return (
              <option key={d.coin} value={d.coin}>
                {d.coin}
              </option>
            );
          })}
        </select>
        <svg>
          <use xlinkHref="#select-arrow-down"></use>
        </svg>
      </label>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line options={options} data={chartDataByCoin(currentCoinSelected)} />
      </div>
      <svg className="sprites">
        <symbol id="select-arrow-down" viewBox="0 0 10 6">
          <polyline points="1 1 5 5 9 1"></polyline>
        </symbol>
      </svg>
    </div>
  );
};

export default App;
