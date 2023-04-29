import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  useWindowSize,
} from "../../utils/hook";
import { timestampToDate } from '../../utils/date'

type AssetChangeData = {
  timestamps: number[];
  data: number[];
};

const App = () => {
  const lineColor = "rgba(255, 99, 71, 1)";

  const [data, setData] = useState({
    timestamps: [],
    data: [],
  } as AssetChangeData);

  const size = useWindowSize();

  useEffect(() => {
    setData({
      timestamps: [
        1640995200000, 1641081600000, 1641168000000, 1641254400000,
        1641340800000, 1641427200000, 1641513600000, 1641600000000,
        1641686400000, 1641772800000,
      ],
      data: [
        22544.8211354334, 19650.42, 22006.24999999997, 21419.01,
        21246.53000000006, 31684.81, 29099.96, 40718.17999999996,
        39184.47000000003, 39085.53,
      ],
    });
  }, []);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Trend of Asset USD Value",
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
          text: "USD",
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
      labels: data.timestamps.map(timestampToDate),
      datasets: [
        {
          label: "USD Value",
          data: data.data,
          borderColor: lineColor,
          backgroundColor: lineColor,
          borderWidth: 5,
          tension: 0.1,
          pointRadius: 1,
          pointStyle: "rotRect",
        },
      ],
    };
  }

  return (
    <div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line options={options} data={lineData()} />
      </div>
    </div>
  );
};

export default App;
