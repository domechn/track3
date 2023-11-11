import { Doughnut } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import { LatestAssetsPercentageData } from "@/middlelayers/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const App = ({ data }: { data: LatestAssetsPercentageData }) => {
  const size = useWindowSize();

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      // text is set for resizing
      title: { display: false, text: "Percentage of Assets" },
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Percentage of Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{
              height: Math.max((size.height || 100) / 2, 400),
            }}
          >
            <Doughnut options={options as any} data={lineData()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
