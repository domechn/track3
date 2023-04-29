import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { LatestAssetsPercentageData } from '../../middlelayers/types'
import { queryLatestAssetsPercentage } from '../../middlelayers/charts'


const App = () => {
  const [data, setData] = useState([] as LatestAssetsPercentageData);
  const size = useWindowSize();

  useEffect(() => {
    queryLatestAssetsPercentage().then(d=>setData(d))
  }, []);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: { display: true, text: "Percentage of Assets" },
      legend: { labels: { font: {} } },
      datalabels: {
        color: "white",
        font: {
          weight: "bold",
        },
        display: "auto",
        formatter: (
          value: number,
          context: {
            chart: { data: { labels: { [x: string]: any } } };
            dataIndex: string | number;
          }
        ) => {
          const label = context.chart.data.labels[context.dataIndex];
          return `${label}: ${value.toLocaleString()}%`;
        },
      },
    },
  };

  function lineData() {
    return {
      labels: data.map((coin) => coin.coin),
      datasets: [
        {
          data: data.map((coin) => coin.percentage),
          borderColor: data.map((coin) => coin.chartColor),
          backgroundColor: data.map((coin) => coin.chartColor),
          borderWidth: 1,
        },
      ],
    };
  }

  return (
    <div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 400),
        }}
      >
        <Doughnut options={options as any} data={lineData()} />
      </div>
    </div>
  );
};

export default App;
