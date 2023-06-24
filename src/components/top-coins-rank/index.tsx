import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { TopCoinsRankData } from "../../middlelayers/types";
import { useRef } from 'react'
import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types'
import { BubbleDataPoint, Point } from 'chart.js'
import _ from 'lodash'

const App = ({ data }: { data: TopCoinsRankData }) => {
  const size = useWindowSize();
  const chartRef =
    useRef<
      ChartJSOrUndefined<
        "line",
        (number | [number, number] | Point | BubbleDataPoint | null)[],
        unknown
      >
    >(null);

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: "Trend of Top Coins Rank",
      },
      datalabels: {
        display: false,
      },
      legend: {
        onClick: function (e: any, legendItem: { datasetIndex: number }, legend: any) {
          const idx = legendItem.datasetIndex;
          const chart = chartRef.current;
          if (!chart) {
            return;
          }
          const arc = chart.getDatasetMeta(idx);
          // always set arc shown if user clicks on it
          arc.hidden = false;

          const maxLegend = _(data.coins).size();

          const currentHidden = _(_.range(maxLegend))
            .filter((i) => i !== idx)
            .map((i) => chart.getDatasetMeta(i))
            .map((m) => m.hidden)
            .every((h) => !!h)

          for (let i = 0; i < maxLegend; i++) {
            const other = chart.getDatasetMeta(i);
            if (i !== idx) {
              other.hidden = !currentHidden;
            }
          }
          chart.update();
        },
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
      labels: data.timestamps.map((x) => timestampToDate(x)),
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
    <>
      <div
        style={{
          height: Math.max((size.height || 100) / 2, 350),
        }}
      >
        <Line ref={chartRef} options={options} data={lineData()} />
      </div>
    </>
  );
};

export default App;
