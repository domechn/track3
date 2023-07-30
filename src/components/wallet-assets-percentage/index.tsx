import { Bar } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import {
  CurrencyRateDetail,
  WalletAssetsPercentageData,
} from "../../middlelayers/types";
import { currencyWrapper } from '../../utils/currency'

const App = ({
  data,
  currency,
}: {
  data: WalletAssetsPercentageData;
  currency: CurrencyRateDetail;
}) => {
  const size = useWindowSize();

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    indexAxis: "y",
    barPercentage: 0.9,
    // categoryPercentage: 0.7,
    plugins: {
      title: { display: true, text: "Percentage of Wallet" },
      legend: {
        display: false,
      },
      datalabels: {
        display: "auto",
        align: "top",
        offset: 6,
        formatter: (
          value: number,
          context: {
            chart: { data: { labels: { [x: string]: any } } };
            dataIndex: string | number;
          }
        ) => {
          // const label = context.chart.data.labels[context.dataIndex];
          return `${currency.symbol}${value.toFixed(2)}`;
        },
      },
    },
  };

  function lineData() {
    return {
      labels: data.map((d) => d.walletAlias || d.wallet),
      datasets: [
        {
          alias: "y",
          fill: false,
          data: data.map((d) => currencyWrapper(currency)(d.value)),
          borderColor: data.map((d) => d.chartColor),
          backgroundColor: data.map((d) => d.chartColor),
          borderWidth: 1,
        },
      ],
    };
  }
  // const options = {
  //   maintainAspectRatio: false,
  //   responsive: false,
  //   plugins: {
  //     title: { display: true, text: "Percentage of Wallet" },
  //     legend: { labels: { font: {} } },
  //     datalabels: {
  //       color: "white",
  //       font: {
  //         weight: "bold",
  //       },
  //       display: "auto",
  //       formatter: (
  //         value: number,
  //         context: {
  //           chart: { data: { labels: { [x: string]: any } } };
  //           dataIndex: string | number;
  //         }
  //       ) => {
  //         const label = context.chart.data.labels[context.dataIndex];
  //         return `${label}: ${value.toLocaleString()}%`;
  //       },
  //     },
  //   },
  // };

  // function lineData() {
  //   return {
  //     labels: data.map((d) => d.walletAlias || d.wallet),
  //     datasets: [
  //       {
  //         data: data.map((d) => d.percentage),
  //         borderColor: data.map((d) => d.chartColor),
  //         backgroundColor: data.map((d) => d.chartColor),
  //         borderWidth: 1,
  //       },
  //     ],
  //   };
  // }

  return (
    <div>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 400),
        }}
      >
        {/* <Pie options={options as any} data={lineData()} /> */}
        <Bar options={options as any} data={lineData()} />
      </div>
    </div>
  );
};

export default App;
