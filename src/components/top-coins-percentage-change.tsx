import { useContext, useEffect, useMemo, useRef, useState } from "react";
import bluebird from "bluebird";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { TDateRange, TopCoinsPercentageChangeData } from "@/middlelayers/types";
import type { AssetType } from "@/middlelayers/datafetch/types";
import { queryTopCoinsPercentageChangeData } from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { downloadCoinLogos } from "@/middlelayers/data";
import { getImageApiPath } from "@/utils/app";
import {
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";

type SortBy = "value" | "price";

type RowData = {
  coin: string;
  assetType: AssetType;
  valueEnd: number;
  priceEnd: number;
  valuePath: number[];
  pricePath: number[];
  valueMin: number;
  valueMax: number;
  priceMin: number;
  priceMax: number;
};

function formatRange(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  const abs = Math.abs(value);
  const body = abs >= 10 ? value.toFixed(1) : String(Math.round(value));
  return sign + body + "%";
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function Sparkline({
  data,
  color,
  width = 96,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <svg
        data-testid="tcpc-sparkline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      />
    );
  }
  const lo = Math.min(...data, 0);
  const hi = Math.max(...data, 0);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - ((v - lo) / span) * height;
  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const lastX = x(data.length - 1);
  const lastY = y(data[data.length - 1]);
  const zCross = lo < 0 && hi > 0;
  return (
    <svg
      data-testid="tcpc-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {zCross ? (
        <line
          x1={0}
          y1={y(0)}
          x2={width}
          y2={y(0)}
          stroke="rgba(113,113,122,0.35)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={color} />
    </svg>
  );
}

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const { t } = useTranslation();
  // Subscribe so the parent can ping on layout change; no resize needed without Chart.js.
  useContext(ChartResizeContext);
  const [data, setData] = useState<TopCoinsPercentageChangeData>({
    timestamps: [],
    coins: [],
  });
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [sortBy, setSortBy] = useState<SortBy>("value");

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();

  const loadGenRef = useRef(0);
  useEffect(() => {
    const gen = ++loadGenRef.current;
    loadData(dateRange, gen);
  }, [rangeKey, dataChangedVersion]);

  async function loadData(dr: TDateRange, gen: number) {
    const tcpcd = await queryTopCoinsPercentageChangeData(dr);
    if (gen !== loadGenRef.current) {
      return;
    }
    setData(tcpcd);
  }

  useEffect(() => {
    if (data.coins.length === 0) return;
    downloadCoinLogos(
      data.coins
        .filter((coin) => shouldDownloadCryptoLogo(coin))
        .map((c) => ({ symbol: c.coin, price: 0 })),
    );
    getLogoMap(data.coins).then((m) => setLogoMap(m));
  }, [data]);

  async function getLogoMap(
    coins: { coin: string; assetType: "crypto" | "stock" }[],
  ) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(coins, async (c) => {
      if (!shouldDownloadCryptoLogo(c)) {
        return {
          [getAssetLogoKey({ symbol: c.coin, assetType: c.assetType })]: "",
        };
      }
      const path = await getImageApiPath(acd, c.coin);
      return {
        [getAssetLogoKey({ symbol: c.coin, assetType: c.assetType })]: path,
      };
    });
    return Object.assign({}, ...kvs);
  }

  const rows = useMemo<RowData[]>(() => {
    const mapped = data.coins
      .map<RowData | null>((coin) => {
        if (coin.percentageData.length === 0) return null;
        const valuePath = coin.percentageData.map((p) => p.value);
        const pricePath = coin.percentageData.map((p) => p.price);
        return {
          coin: coin.coin,
          assetType: coin.assetType,
          valueEnd: valuePath[valuePath.length - 1] ?? 0,
          priceEnd: pricePath[pricePath.length - 1] ?? 0,
          valuePath,
          pricePath,
          valueMin: Math.min(...valuePath) ?? 0,
          valueMax: Math.max(...valuePath) ?? 0,
          priceMin: Math.min(...pricePath) ?? 0,
          priceMax: Math.max(...pricePath) ?? 0,
        };
      })
      .filter((r): r is RowData => r !== null);
    const key = sortBy === "value" ? "valueEnd" : "priceEnd";
    return mapped.sort((a, b) => b[key] - a[key]);
  }, [data, sortBy]);

  const isValueActive = sortBy === "value";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("topCoinsPercentage.title")}
          </CardTitle>
          <div className="text-xs text-muted-foreground/70">
            {t("topCoinsPercentage.subhead")}
          </div>
        </div>
        <ButtonGroup
          value={sortBy}
          onValueChange={(v) => setSortBy(v as SortBy)}
          className="h-7 p-0.5"
        >
          <ButtonGroupItem
            value="value"
            data-testid="tcpc-sort-value"
            className="px-2 py-0.5 text-xs"
          >
            {t("topCoinsPercentage.valueLabel")}
          </ButtonGroupItem>
          <ButtonGroupItem
            value="price"
            data-testid="tcpc-sort-price"
            className="px-2 py-0.5 text-xs"
          >
            {t("topCoinsPercentage.priceLabel")}
          </ButtonGroupItem>
        </ButtonGroup>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {rows.length === 0 ? (
          <div
            data-testid="tcpc-empty"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            {t("topCoinsPercentage.empty")}
          </div>
        ) : (
          <>
            {/* Column header — labels track the active sort. */}
            <div
              data-testid="tcpc-header"
              className="grid grid-cols-[20px_minmax(0,1fr)_72px_64px_80px_96px] items-center gap-2 px-2 pb-1"
            >
              <div></div>
              <div></div>
              <div
                data-testid="tcpc-header-value"
                data-active={isValueActive}
                className={`text-right text-[8px] font-medium uppercase tracking-wider leading-none ${
                  isValueActive
                    ? "text-muted-foreground"
                    : "text-muted-foreground/30"
                }`}
              >
                {t("topCoinsPercentage.valueLabel")}
              </div>
              <div
                data-testid="tcpc-header-price"
                data-active={!isValueActive}
                className={`text-right text-[8px] font-medium uppercase tracking-wider leading-none ${
                  !isValueActive
                    ? "text-muted-foreground"
                    : "text-muted-foreground/30"
                }`}
              >
                {t("topCoinsPercentage.priceLabel")}
              </div>
              <div className="hidden sm:block"></div>
              <div className="hidden sm:block"></div>
            </div>

            {rows.map((row, idx) => {
              const isTop = idx === 0;
              const isBot = idx === rows.length - 1;
              const showBadges = rows.length >= 2;
              const valueIsActive = isValueActive;
              const priceIsActive = !isValueActive;
              // Sparkline + min/max follow the active sort.
              const activePath = valueIsActive ? row.valuePath : row.pricePath;
              const activeMin = valueIsActive ? row.valueMin : row.priceMin;
              const activeMax = valueIsActive ? row.valueMax : row.priceMax;
              const activeEnd = valueIsActive ? row.valueEnd : row.priceEnd;
              const isGain = activeEnd >= 0;
              const sparkColor = isGain ? "#10b981" : "#f43f5e";
              const valueClass = row.valueEnd >= 0
                ? "text-emerald-500"
                : "text-rose-500";
              const priceClass = row.priceEnd >= 0
                ? "text-emerald-500/70"
                : "text-rose-500/70";
              const logoKey = getAssetLogoKey({
                symbol: row.coin,
                assetType: row.assetType,
              });
              return (
                <div
                  key={logoKey}
                  data-testid="tcpc-row"
                  className={[
                    "grid grid-cols-[20px_minmax(0,1fr)_72px_64px_80px_96px] items-center gap-2 rounded-md px-2 py-1.5",
                    isTop && showBadges ? "bg-emerald-500/[0.04]" : "",
                    isBot && showBadges ? "bg-rose-500/[0.04]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <img
                    data-testid="tcpc-logo"
                    className="h-5 w-5 shrink-0 rounded-full bg-muted"
                    src={resolveAssetLogoSrc(
                      { symbol: row.coin, assetType: row.assetType },
                      logoMap[logoKey],
                    )}
                    alt={formatAssetLabel({
                      symbol: row.coin,
                      assetType: row.assetType,
                    })}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        data-testid="tcpc-symbol"
                        className="truncate text-sm font-semibold"
                      >
                        {row.coin}
                      </span>
                      {isTop && showBadges ? (
                        <span
                          data-testid="tcpc-badge"
                          className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500"
                        >
                          {t("topCoinsPercentage.topGainer")}
                        </span>
                      ) : null}
                      {isBot && showBadges ? (
                        <span
                          data-testid="tcpc-badge"
                          className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-500"
                        >
                          {t("topCoinsPercentage.topLoser")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    data-testid="tcpc-value"
                    data-active={valueIsActive}
                    className={`font-mono tabular-nums text-right ${
                      valueIsActive
                        ? `text-base font-bold ${valueClass}`
                        : "text-[10px] text-muted-foreground/60"
                    }`}
                  >
                    {formatPercent(row.valueEnd)}
                  </div>
                  <div
                    data-testid="tcpc-price"
                    data-active={priceIsActive}
                    className={`font-mono tabular-nums text-right ${
                      priceIsActive
                        ? `text-base font-bold ${priceClass}`
                        : "text-[10px] text-muted-foreground/60"
                    }`}
                  >
                    {formatPercent(row.priceEnd)}
                  </div>
                  <div className="hidden font-mono text-[10px] leading-tight tabular-nums text-muted-foreground sm:block">
                    <div
                      data-testid="tcpc-max"
                      className="grid grid-cols-[28px_1fr] items-center gap-1 whitespace-nowrap"
                    >
                      <span className="text-left">
                        {t("topCoinsPercentage.maxLabel")}
                      </span>
                      <span className="text-right">
                        {formatRange(activeMax)}
                      </span>
                    </div>
                    <div
                      data-testid="tcpc-min"
                      className="grid grid-cols-[28px_1fr] items-center gap-1 whitespace-nowrap"
                    >
                      <span className="text-left">
                        {t("topCoinsPercentage.minLabel")}
                      </span>
                      <span className="text-right">
                        {formatRange(activeMin)}
                      </span>
                    </div>
                  </div>
                  <div className="hidden justify-end sm:flex">
                    <Sparkline data={activePath} color={sparkColor} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
