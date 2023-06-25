import { Line } from "react-chartjs-2";
import { useWindowSize } from "../../utils/hook";
import { timestampToDate } from "../../utils/date";
import { AssetChangeData, CurrencyRateDetail } from "../../middlelayers/types";
import _ from 'lodash'
import { currencyWrapper } from '../../utils/currency'

const App = ({
  data,
  currency,
}: {
  data: AssetChangeData;
  currency: CurrencyRateDetail;
}) => {
  const lineColor = "rgba(255, 99, 71, 1)";

  const size = useWindowSize();

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      title: {
        display: true,
        text: `Trend of Asset ${currency.currency} Value`,
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
          data: _(data.data).map(d => currencyWrapper(currency)(d)).value(),
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
