import {
  AssetReference,
  AssetsPercentageChangeData,
  TDateRange,
} from "@/middlelayers/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useWindowSize } from "@/utils/hook";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import { ChartResizeContext } from "@/App";
import {
  queryAssetsPercentageChange,
  queryTopNAssets,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { timeToDateStr } from "@/utils/date";
import {
  chartColors,
  glassScaleOptions,
  glassTooltip,
} from "@/utils/chart-theme";
import { formatAssetLabel, getAssetLogoKey } from "@/utils/assets";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";

const chartName = "Coins Percentage Overview";

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const { t } = useTranslation();
  const wsize = useWindowSize();
  const [topN, setTopN] = useState<AssetReference[]>([]);
  const { needResize } = useContext(ChartResizeContext);
  const [assetsPercentageChangeData, setAssetsPercentageChangeData] = useState(
    [] as AssetsPercentageChangeData
  );

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const dataChangedVersion = useDataChangedVersion();

  const loadGenRef = useRef(0);
  useEffect(() => {
    const gen = ++loadGenRef.current;
    loadData(dateRange, gen).then(() => {
      if (gen !== loadGenRef.current) {
        return;
      }
      resizeChartWithDelay(chartName);
    });
  }, [rangeKey, dataChangedVersion]);
  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadData(dr: TDateRange, gen: number) {
    const topN = await queryTopNAssets(dr, 6);
    const data = await queryAssetsPercentageChange(dr);
    if (gen !== loadGenRef.current) {
      return;
    }

    setTopN(topN);
    setAssetsPercentageChangeData(data);
  }

  // Current share per asset + "Other", sorted desc, for the legend strip.
  // Computed off the most recent entry; falls back to [] if the series is empty.
  const legendRows = useMemo(() => {
    const lastEntry =
      assetsPercentageChangeData[assetsPercentageChangeData.length - 1];
    if (!lastEntry) {
      return [] as {
        label: string;
        current: number;
        color: string;
        key: string;
      }[];
    }
    const topNSet = new Set(topN.map((a) => getAssetLogoKey(a)));
    const topNCurrent: {
      label: string;
      current: number;
      color: string;
      key: string;
    }[] = [];
    let othersCurrent = 0;
    lastEntry.percentages.forEach((item) => {
      const key = getAssetLogoKey(item);
      if (topNSet.has(key)) {
        const idx = topN.findIndex((a) => getAssetLogoKey(a) === key);
        const color = chartColors[idx % chartColors.length].main;
        topNCurrent.push({
          label: formatAssetLabel(item),
          current: item.percentage,
          color,
          key,
        });
      } else {
        othersCurrent += item.percentage;
      }
    });
    const othersRow = {
      label: t("common.others"),
      current: othersCurrent,
      color: "rgba(148,163,184,0.5)",
      key: "others",
    };
    return [...topNCurrent, othersRow].sort((a, b) => b.current - a.current);
  }, [assetsPercentageChangeData, topN, t]);

  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      hover: {
        mode: "index" as const,
        intersect: false,
      },
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        // text is set for resizing
        title: { display: false, text: chartName },
        datalabels: { display: false },
        legend: { display: false },
        tooltip: {
          ...glassTooltip,
          itemSort: (a: any, b: any) => b.parsed.y - a.parsed.y,
          callbacks: {
            title: (items: { label: string }[]) => {
              const label = items[0]?.label;
              return label ? label : "";
            },
            label: (context: {
              dataset: { label: string };
              parsed: { y: number };
            }) => {
              return (
                " " +
                context.dataset.label +
                ": " +
                context.parsed.y.toFixed(1) +
                "%"
              );
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: false },
          ticks: {
            ...glassScaleOptions.ticks,
            autoSkip: true,
            maxTicksLimit: 6,
          },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          min: 0,
          max: 100,
          title: { display: false },
          ticks: {
            ...glassScaleOptions.ticks,
            precision: 0,
            stepSize: 25,
            callback: (value: number) => value + "%",
          },
          grid: {
            ...glassScaleOptions.grid,
          },
        },
      },
    }),
    []
  );

  const preparedData = useMemo(() => {
    const topNSet = new Set(topN.map((asset) => getAssetLogoKey(asset)));
    const labels: string[] = [];
    const othersData: number[] = [];
    const topNData = topN.map(() => [] as number[]);

    assetsPercentageChangeData.forEach((entry) => {
      labels.push(timeToDateStr(entry.timestamp));

      const percentageByAsset = new Map<string, number>();
      let others = 0;

      entry.percentages.forEach((item) => {
        const assetKey = getAssetLogoKey(item);
        if (topNSet.has(assetKey)) {
          percentageByAsset.set(assetKey, item.percentage);
          return;
        }
        others += item.percentage;
      });

      topN.forEach((asset, idx) => {
        topNData[idx].push(
          percentageByAsset.get(getAssetLogoKey(asset)) ?? 0
        );
      });
      othersData.push(others);
    });

    return { labels, topNData, othersData };
  }, [assetsPercentageChangeData, topN]);

  const barDataMemo = useMemo(() => {
    const datasetOpts = {
      stack: "composition",
      categoryPercentage: 0.9,
      barPercentage: 0.95,
      borderColor: "rgba(9,9,11,0.6)",
      borderWidth: 0.5,
    };
    const topNDatasets = topN.map((asset, idx) => {
      const color = chartColors[idx % chartColors.length];
      return {
        ...datasetOpts,
        label: formatAssetLabel(asset),
        data: preparedData.topNData[idx],
        backgroundColor: color.main,
      };
    });
    const othersDataset = {
      ...datasetOpts,
      label: t("common.others"),
      data: preparedData.othersData,
      backgroundColor: "rgba(148,163,184,0.5)",
    };

    return {
      labels: preparedData.labels,
      datasets: [...topNDatasets, othersDataset],
    };
  }, [preparedData, topN, t]);

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("assetsPercentage.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            data-testid="assets-percentage-legend"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
          >
            {legendRows.map((row) => (
              <div
                key={row.key}
                data-testid="assets-percentage-legend-item"
                data-asset={row.label}
                className="flex items-center gap-1.5"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: row.color }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground/80">
                  {row.current.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex items-center justify-center"
            style={{
              height: Math.max((wsize.height || 100) / 2, 350),
            }}
          >
            <Bar options={options as any} data={barDataMemo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
