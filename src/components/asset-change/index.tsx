import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  useWindowSize,
} from "../../utils/hook";
import { timestampToDate } from '../../utils/date'
import { AssetChangeData } from '../../middlelayers/types'
import { queryAssetChange } from '../../middlelayers/charts'

const App = () => {
  const lineColor = "rgba(255, 99, 71, 1)";

  const [data, setData] = useState({
    timestamps: [],
    data: [],
  } as AssetChangeData);

  const size = useWindowSize();

  useEffect(() => {
    queryAssetChange().then(d=>setData(d))
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
