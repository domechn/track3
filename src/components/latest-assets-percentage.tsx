import { Doughnut } from "react-chartjs-2";
import { useWindowSize } from "@/utils/hook";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
} from "@/middlelayers/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import _ from "lodash";
import { useEffect, useState } from "react";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import { getImageApiPath } from "@/utils/app";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { downloadCoinLogos } from "@/middlelayers/data";

const App = ({
  currency,
  data,
}: {
  currency: CurrencyRateDetail;
  data: LatestAssetsPercentageData;
}) => {
  const size = useWindowSize();

  const [appCacheDir, setAppCacheDir] = useState<string>("");

  useEffect(() => {
    getAppCacheDir().then((dir) => {
      setAppCacheDir(dir);
    });
  }, []);

  const [percentageData, setPercentageData] = useState<
    {
      coin: string;
      percentage: number;
      chartColor: string;
    }[]
  >(data);

  useEffect(() => {
    setPercentageData(splitTopAndOtherData(data));

    // download coin logos
    downloadCoinLogos(_(data).map("coin").value());
  }, [data]);

  const options = {
    maintainAspectRatio: false,
    responsive: false,
    plugins: {
      // text is set for resizing
      title: { display: false, text: "Percentage of Assets" },
      legend: {
        display: true,
        position: "right",
        font: {
          size: 14,
        },
        labels: { font: {} },
      },
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

  function splitTopAndOtherData(d: LatestAssetsPercentageData) {
    const count = 5;
    if (d.length <= count) {
      return d;
    }
    const top = _(d).sortBy("percentage").reverse().take(count).value();
    console.log(top);
    const other = _(d).sortBy("percentage").reverse().drop(count).value();

    return _([
      ...top,
      other
        ? {
            coin: "Other",
            percentage: _(other).map("percentage").sum(),
            chartColor: other[0]?.chartColor ?? "#4B5563",
          }
        : null,
    ])
      .compact()
      .value();
  }

  function lineData() {
    const d = percentageData;
    return {
      labels: d.map((coin) => coin.coin),
      datasets: [
        {
          data: d.map((coin) => coin.percentage),
          borderColor: d.map((coin) => coin.chartColor),
          backgroundColor: d.map((coin) => coin.chartColor),
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
            {size.width}
            Percentage of Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            <div
              className="sm:col-span-2 md:col-span-3"
              style={{
                height: Math.max((size.height || 100) / 2, 400),
              }}
            >
              <Doughnut options={options as any} data={lineData()} />
            </div>
            <div className="sm:col-span-2 md:col-span-2">
              <Table>
                <TableBody>
                  {/* todo: paginate */}
                  {data.map((d) => (
                    <TableRow key={d.coin}>
                      <TableCell>
                        <div className="flex flex-row items-center">
                          <img
                            className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                            src={getImageApiPath(appCacheDir, d.coin)}
                            alt={d.coin}
                          />
                          <div className="mr-1 font-bold">
                            {prettyPriceNumberToLocaleString(d.amount)}
                          </div>
                          <div className="text-gray-600">{d.coin}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-gray-400">
                          {currency.symbol +
                            prettyNumberToLocaleString(
                              currencyWrapper(currency)(d.value)
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
