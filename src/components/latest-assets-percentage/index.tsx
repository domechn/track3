import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import type { ChartOptions } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

type LatestAssetsPercentageData = {
  coin: string;
  percentage: number;
  chartColor: string;
}[];

const App = () => {
  const [data, setData] = useState([] as LatestAssetsPercentageData);
  const size = useWindowSize();

  useEffect(() => {
    const loadedData = [
      {
        coin: "BTC",
        percentage: 29.8,
        chartColor: "#f7931a",
      },
      {
        coin: "ETH",
        percentage: 15.2,
        chartColor: "#627eea",
      },
      {
        coin: "ADA",
        percentage: 8.2,
        chartColor: "#3ccfcf",
      },
      {
        coin: "BNB",
        percentage: 4.9,
        chartColor: "#f3ba2f",
      },
      {
        coin: "OTHERS",
        percentage: 41.9,
        chartColor: "#a1a1e8",
      },
    ] as LatestAssetsPercentageData;
    setData(loadedData);
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
          return `${label}: ${value}%`;
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
        <Doughnut options={options as ChartOptions} data={lineData()} />
      </div>
    </div>
  );
};

export default App;
