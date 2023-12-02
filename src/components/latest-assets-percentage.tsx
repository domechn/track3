import { Doughnut } from "react-chartjs-2";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
} from "@/middlelayers/types";
import { Card, CardContent } from "./ui/card";
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
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import bluebird from "bluebird";

const App = ({
  currency,
  data,
}: {
  currency: CurrencyRateDetail;
  data: LatestAssetsPercentageData;
}) => {
  const [dataPage, setDataPage] = useState<number>(0);
  const [maxDataPage, setMaxDataPage] = useState<number>(0);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const pageSize = 5;

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
    downloadCoinLogos(
      _(data)
        .map((d) => ({
          symbol: d.coin,
          price: d.value / (d.amount || 1),
        }))
        .value()
    );

    // set max data page
    setMaxDataPage(Math.floor(data.length / pageSize));

    // set logo map
    getLogoMap(data).then((m) => setLogoMap(m));
  }, [data]);

  async function getLogoMap(d: LatestAssetsPercentageData) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(d, async (coin) => {
      const path = await getImageApiPath(acd, coin.coin);
      return { [coin.coin]: path };
    });

    return _.assign({}, ...kvs);
  }

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
          size: 13,
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

  function renderDoughnut() {
    return <Doughnut options={options as any} data={lineData()} />;
  }

  function renderTokenHoldingList() {
    return (
      <>
        <div className="flex w-[100%] h-[50px] justify-between items-center">
          <div className="font-bold text-muted-foreground ml-2">
            Token holding
          </div>
          <div className="flex space-x-2 py-4 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
              disabled={dataPage <= 0}
            >
              <ChevronLeftIcon />
            </Button>
            <div className="text-muted-foreground text-sm">
              {dataPage + 1} {"/"} {maxDataPage + 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDataPage(Math.min(dataPage + 1, maxDataPage))}
              disabled={dataPage >= maxDataPage}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <Separator />
        <Table>
          <TableBody>
            {data
              .slice(dataPage * pageSize, (dataPage + 1) * pageSize)
              .map((d) => (
                <TableRow key={d.coin} className="h-[55px]">
                  <TableCell>
                    <div className="flex flex-row items-center">
                      <img
                        className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                        src={logoMap[d.coin] || UnknownLogo}
                        alt={d.coin}
                      />
                      <div className="mr-1 font-bold text-base" title={""+d.amount}>
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
      </>
    );
  }

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5 h-[330px]">
            <div className="col-span-2 md:col-span-3">{renderDoughnut()}</div>
            <div className="col-span-2 md:col-span-2 flex flex-col items-start justify-top">
              {renderTokenHoldingList()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
