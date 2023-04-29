import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from '../../utils/date'

type CoinsAmountChangeData = {
  coin: string;
  lineColor: string;
  amounts: number[];
  timestamps: number[];
}[];

const App = () => {
  const [data, setData] = useState([] as CoinsAmountChangeData);
  const [currentCoinSelected, setCurrentCoinSelected] = useState("");
  const size = useWindowSize();

  useEffect(() => {
    const loadedData = [
      {
        coin: "BTC",
        lineColor: "rgba(80, 10, 71, 1)",
        amounts: [
          55.98759681758725, 55.988746335189, 55.96256739237964,
          56.01501429334957, 55.966802196756, 55.96769667261728,
          55.96769667261728, 55.96828002261728, 55.96828002261728,
          55.96828002261728,
        ],
        timestamps: [
          1640995200000, 1641081600000, 1641168000000, 1641254400000,
          1641340800000, 1641427200000, 1641513600000, 1641600000000,
          1641686400000, 1641772800000,
        ],
      },
    ] as CoinsAmountChangeData;
    setData(loadedData);
    if (loadedData.length > 0) {
      setCurrentCoinSelected(loadedData[0].coin);
    }
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
      }
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
      <div>
        <select name="coins" id="coins" onChange={onCoinSelectChange}>
          {data.map((d) => {
            return (
              <option key={d.coin} value={d.coin}>
                {d.coin}
              </option>
            );
          })}
        </select>
      </div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line options={options} data={chartDataByCoin(currentCoinSelected)} />
      </div>
    </div>
  );
};

export default App;
