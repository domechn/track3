import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { CoinsAmountChangeData } from "../../middlelayers/types";
import Select from "../common/select";

const App = ({ data }: { data: CoinsAmountChangeData }) => {
  const [currentCoinSelected, setCurrentCoinSelected] = useState("");
  const size = useWindowSize();

  useEffect(() => {
    if (data.length > 0) {
      setCurrentCoinSelected(data[0].coin);
    }
  }, [data]);

  const options = {
    maintainAspectRatio: false,
    responsive: false,
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

  function onCoinSelectChange(coin: string) {
    setCurrentCoinSelected(coin);
  }

  return (
    <div>
      <Select
        options={data.map((d) => ({ value: d.coin, label: d.coin }))}
        onSelectChange={onCoinSelectChange}
      />
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
