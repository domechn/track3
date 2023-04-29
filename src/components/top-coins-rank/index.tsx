import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";

type TopCoinsRankData = {
  timestamps: number[];
  coins: {
    coin: string;
    lineColor: string;
    rankData: {
      rank: number;
      timestamp: number;
    }[];
  }[];
};

const App = () => {
  const [data, setData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const size = useWindowSize();

  useEffect(() => {
    const loadedData = {
      timestamps: [
        1640995200000, 1641081600000, 1641168000000, 1641254400000,
        1641340800000, 1641427200000, 1641513600000, 1641600000000,
        1641686400000, 1641772800000,
      ],
      coins: [
        {
          coin: "BTC",
          lineColor: "rgba(80, 10, 71, 1)",
          rankData: [
            {
              rank: 1,
              timestamp: 1640995200000,
            },
            {
              rank: 1,
              timestamp: 1641081600000,
            },
            {
              rank: 1,
              timestamp: 1641168000000,
            },
            {
              rank: 1,
              timestamp: 1641254400000,
            },
            {
              rank: 1,
              timestamp: 1641340800000,
            },
            {
              rank: 1,
              timestamp: 1641427200000,
            },
            {
              rank: 1,
              timestamp: 1641513600000,
            },
            {
              rank: 1,
              timestamp: 1641600000000,
            },
            {
              rank: 1,
              timestamp: 1641686400000,
            },
            {
              rank: 1,
              timestamp: 1641772800000,
            },
          ],
        },
        {
          coin: "ETH",
          lineColor: "rgba(255, 110, 31, 1)",
          rankData: [
            {
              rank: 2,
              timestamp: 1640995200000,
            },
            {
              rank: 2,
              timestamp: 1641081600000,
            },
            {
              rank: 2,
              timestamp: 1641168000000,
            },
            {
              rank: 2,
              timestamp: 1641254400000,
            },
            {
              rank: 2,
              timestamp: 1641340800000,
            },
            {
              rank: 2,
              timestamp: 1641427200000,
            },
            {
              rank: 2,
              timestamp: 1641513600000,
            },
            {
              rank: 2,
              timestamp: 1641600000000,
            },
            {
              rank: 2,
              timestamp: 1641686400000,
            },
            {
              rank: 2,
              timestamp: 1641772800000,
            },
          ],
        },
        {
          coin: "BNB",
          lineColor: "rgba(12, 50, 31, 1)",
          rankData: [
            {
              rank: 3,
              timestamp: 1640995200000,
            },
            {
              rank: 3,

              timestamp: 1641081600000,
            },
          ],
        },
      ],
    } as TopCoinsRankData;
    setData(loadedData);
  }, []);

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Trend of Top Coins Rank",
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
          text: "Rank",
        },
        offset: true,
        reverse: true,
        ticks: {
          precision: 0,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  function coinRankData(
    timestamps: number[],
    coinRankData: { rank: number; timestamp: number }[]
  ) {
    const coinRankDataMap = new Map<number, number>();
    coinRankData.forEach((rankData) => {
      coinRankDataMap.set(rankData.timestamp, rankData.rank);
    });
    return timestamps.map((date) => coinRankDataMap.get(date) || null);
  }

  function lineData() {
    return {
      labels: data.timestamps.map(timestampToDate),
      datasets: data.coins.map((coin) => ({
        label: coin.coin,
        data: coinRankData(data.timestamps, coin.rankData),
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
