import { Line } from "react-chartjs-2";
import { timestampToDate } from "@/utils/date";
import { AssetChangeData, CurrencyRateDetail } from "@/middlelayers/types";
import _ from "lodash";
import { currencyWrapper } from "@/utils/currency";

const App = ({
  data,
  currency,
}: {
  data: AssetChangeData;
  currency: CurrencyRateDetail;
}) => {
  const lineColor = "rgba(255, 99, 71, 1)";

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        title: {
          display: false,
          text: "Date",
        },
        ticks: {
          maxTicksLimit: 2,
          autoSkip: false,
          labelOffset: -5,
          callback: function (val: number, index: number) {
            const total = _(data.timestamps).size() - 1;

            // only show start and end date
            return index === 0 || index === total - 1
              ? timestampToDate(data.timestamps[index])
              : "";
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        title: {
          display: false,
          text: currency.currency,
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
      labels: data.timestamps.map((x) => timestampToDate(x)),
      datasets: [
        {
          label: "Value",
          data: _(data.data)
            .map((d) => currencyWrapper(currency)(d))
            .value(),
          borderColor: lineColor,
          backgroundColor: lineColor,
          borderWidth: data.data.length > 20 ? 2 : 4,
          tension: 0.1,
          pointRadius: data.data.length > 20 ? 0 : 0.3,
          pointStyle: "rotRect",
        },
      ],
    };
  }

  return (
    <div className='h-30'>
      <Line options={options as any} data={lineData()} />
    </div>
  );
};

export default App;
