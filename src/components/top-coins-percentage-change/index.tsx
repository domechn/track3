import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { TopCoinsPercentageChangeData } from "../../middlelayers/types";

const App = ({ data }: { data: TopCoinsPercentageChangeData }) => {
  const size = useWindowSize();

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: "Change of Top Coins Percentage",
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

  function coinPercentageData(
    timestamps: number[],
    coinPercentageData: { percentage: number; timestamp: number }[]
  ) {
    const coinRankDataMap = new Map<number, number>();
    coinPercentageData.forEach((percentageData) => {
      coinRankDataMap.set(percentageData.timestamp, percentageData.percentage);
    });
    return timestamps.map((date) => coinRankDataMap.get(date) || null);
  }

  function lineData() {
    return {
      labels: data.timestamps.map(timestampToDate),
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

  return (
    <>
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
