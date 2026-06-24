import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  hierarchy,
  treemap,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  CurrencyRateDetail,
  TDateRange,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import { AssetType } from "@/middlelayers/datafetch/types";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
} from "@/utils/currency";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { insertEllipsis } from "@/utils/string";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WALLET_ANALYZER } from "@/middlelayers/charts";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import AssetLabel from "./common/asset-label";
import { useWindowSize } from "@/utils/hook";
import { WALLET_DETAIL_URLS } from "@/middlelayers/constants";
import { useTranslation } from "@/i18n";
import {
  classifyWalletType,
  pickTileTextColor,
  tileBackground,
  tileContentLevel,
  WALLET_CATEGORY_BASE_COLORS,
  OTHERS_AGGREGATED_KEY,
  type WalletCategory,
} from "@/utils/wallet-treemap";

const chartName = "wallet-assets-percentage";

function getWalletDisplayName(item: {
  wallet: string;
  walletType?: string;
  walletAlias?: string;
}) {
  if (item.walletAlias) {
    return item.walletType
      ? `${item.walletType}-${item.walletAlias}`
      : item.walletAlias;
  }
  return insertEllipsis(item.wallet, 16);
}

type LayoutItem = {
  wallet: WalletAssetsPercentageData[number];
  category: WalletCategory;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_CONTAINER_WIDTH = 800;
const DEFAULT_CONTAINER_HEIGHT = 540;
const MOBILE_BREAKPOINT = 640;
const MOBILE_HEIGHT = 240;
const DESKTOP_HEIGHT = 540;
const PADDING_BETWEEN_TILES = 2;
const MAX_TILES = 5;

type PopoverContentProps = {
  item: LayoutItem;
  name: string;
  aggregatedWallets: WalletAssetsPercentageData | null;
  currency: CurrencyRateDetail;
  displayAmount: boolean | undefined;
  onPointerLeave: () => void;
  t: (key: string) => string;
  style: React.CSSProperties;
};

const PopoverContent = ({
  item,
  name,
  aggregatedWallets,
  currency,
  displayAmount,
  onPointerLeave,
  t,
  style,
}: PopoverContentProps) => {
  const isAggregated =
    item.wallet.wallet === OTHERS_AGGREGATED_KEY && aggregatedWallets;
  const detailUrlFn = item.wallet.walletType
    ? WALLET_DETAIL_URLS[item.wallet.walletType]
    : undefined;

  return (
    <div
      data-testid="treemap-popover"
      onPointerLeave={onPointerLeave}
      className="rounded-lg border border-border bg-popover p-3 shadow-lg max-w-[calc(100vw-16px)]"
      style={style}
    >
      {isAggregated ? (
        <div className="space-y-1.5">
          <div className="font-medium text-sm">
            {t("walletAllocation.aggregatedHeader").replace(
              "{count}",
              String(aggregatedWallets.length),
            )}
          </div>
          <div
            data-testid="aggregated-wallet-list"
            className="max-h-[300px] overflow-y-auto space-y-1 pr-1"
          >
            {aggregatedWallets
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((w) => {
                const wName = getWalletDisplayName(w);
                const wCategory = classifyWalletType(w.walletType);
                return (
                  <div
                    key={`${w.wallet}-${w.walletType ?? "none"}`}
                    data-testid="aggregated-wallet-item"
                    className="flex items-center justify-between gap-2 text-xs py-0.5"
                  >
                    <span className="truncate flex-1">{wName}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-60">
                      {t(WALLET_CATEGORY_BASE_COLORS[wCategory].labelKey)}
                    </span>
                    <span className="mono tabular-nums">
                      {w.percentage.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="font-medium text-sm">{name}</div>
          <div className="text-xs text-muted-foreground">
            {t(WALLET_CATEGORY_BASE_COLORS[item.category].labelKey)}
          </div>
          <div className="mono text-sm tabular-nums">
            {item.wallet.percentage.toFixed(2)}%
          </div>
          <div className="mono text-xs tabular-nums text-muted-foreground">
            {currency.symbol}
            {prettyNumberToLocaleString(
              currencyWrapper(currency)(item.wallet.value),
            )}
          </div>
          {displayAmount && (
            <div className="mono text-[10px] tabular-nums text-muted-foreground">
              {t("walletAllocation.tileAmount")
                .replace(
                  "{amount}",
                  String(
                    prettyNumberKeepNDigitsAfterDecimalPoint(
                      item.wallet.amount,
                      4,
                    ),
                  ),
                )
                .replace("{symbol}", currency.symbol)}
            </div>
          )}
          {detailUrlFn && (
            <div className="pt-1 text-[10px] text-muted-foreground">
              {t("walletAllocation.tileClickHint")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const App = ({
  currency,
  dateRange,
  symbol,
  assetType,
  displayAmount,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  symbol?: string;
  assetType?: AssetType;
  displayAmount?: boolean;
}) => {
  const size = useWindowSize();
  const loadGenRef = useRef(0);
  const { t } = useTranslation();
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);
  const dataChangedVersion = useDataChangedVersion();

  const [containerSize, setContainerSize] = useState({
    width: DEFAULT_CONTAINER_WIDTH,
    height: DEFAULT_CONTAINER_HEIGHT,
  });
  // isReady gates the treemap render until the container's real size is known.
  // Without this gate, the first paint uses the default width (which is wider
  // than typical Card widths) and the right-side tiles get clipped by overflow-hidden.
  const [isReady, setIsReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-driven popover: track which tile is selected + where to position.
  const [selectedTileKey, setSelectedTileKey] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<LayoutItem | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    left: number;
    top: number;
    below: boolean;
  }>({ left: 0, top: 0, below: false });

  // Dismiss popover when clicking outside
  useEffect(() => {
    if (!selectedTileKey) return;
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const popover = document.querySelector(
        '[data-testid="treemap-popover"]',
      );
      const tile = document.querySelector(
        `[data-tile-key="${selectedItem?.wallet.wallet}"]`,
      );
      if (
        popover &&
        !popover.contains(target) &&
        tile &&
        !tile.contains(target)
      ) {
        setSelectedTileKey(null);
        setSelectedItem(null);
      }
    };
    // use a microtask delay so the click that opened the popover doesn't
    // immediately close it
    const id = setTimeout(
      () => document.addEventListener("click", handleDocClick),
      0,
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", handleDocClick);
    };
  }, [selectedTileKey, selectedItem]);

  // measure the container on mount and whenever the window resizes
  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const el = containerRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
        setIsReady(true);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, [size.width, size.height, needResize]);

  // data fetch
  useEffect(() => {
    let mounted = true;
    const gen = ++loadGenRef.current;
    WALLET_ANALYZER.queryWalletAssetsPercentage(symbol, assetType)
      .then((wap) => {
        if (!mounted || gen !== loadGenRef.current) {
          return;
        }
        setWalletAssetsPercentage(wap);
      })
      .finally(() => {
        if (mounted) {
          reportLoaded();
        }
      });
    return () => {
      mounted = false;
    };
  }, [dateRange, reportLoaded, symbol, assetType, dataChangedVersion]);

  const sortedWallets = useMemo(
    () => [...walletAssetsPercentage].sort((a, b) => b.value - a.value),
    [walletAssetsPercentage],
  );

  // Wallets ≥1% get their own tile; the <1% tail is grouped into "Others".
  // When nothing reaches 1% we fall back to MAX_TILES so the treemap stays readable.
  const groupedWallets = useMemo<WalletAssetsPercentageData>(() => {
    const MIN_PCT = 1;
    const above = sortedWallets.filter((w) => w.percentage >= MIN_PCT);
    const below = sortedWallets.filter((w) => w.percentage < MIN_PCT);

    // Everything is below 1% — fall back to the old top-N grouping
    if (above.length === 0) {
      if (sortedWallets.length <= MAX_TILES) return sortedWallets;
      const headCount = MAX_TILES - 1;
      const head = sortedWallets.slice(0, headCount);
      const rest = sortedWallets.slice(headCount);
      const totalVal = sortedWallets.reduce((s, w) => s + w.value, 0);
      const restValue = rest.reduce((sum, w) => sum + w.value, 0);
      const restPercentage = rest.reduce((sum, w) => sum + w.percentage, 0);
      const restAmount = rest.reduce((sum, w) => sum + w.amount, 0);
      // inflate to minimum 1 % of total so the tile stays visible
      const minVisual = totalVal * 0.01;
      return [
        ...head,
        {
          wallet: OTHERS_AGGREGATED_KEY,
          walletType: OTHERS_AGGREGATED_KEY,
          walletAlias: `+${rest.length}`,
          value: Math.max(restValue, minVisual),
          amount: restAmount,
          percentage: restPercentage,
          chartColor: "transparent",
        },
      ];
    }

    // No tail to aggregate — every wallet ≥1%
    if (below.length === 0) return above;

    // Show all ≥1% tiles individually + one "Others" tile for the tail.
    // Inflate the aggregated tile to at least 1 % of total value so it stays
    // visible even when the tail is tiny.
    const totalVal = sortedWallets.reduce((s, w) => s + w.value, 0);
    const restValue = below.reduce((sum, w) => sum + w.value, 0);
    const restPercentage = below.reduce((sum, w) => sum + w.percentage, 0);
    const restAmount = below.reduce((sum, w) => sum + w.amount, 0);
    const minVisual = totalVal * 0.01;
    return [
      ...above,
      {
        wallet: OTHERS_AGGREGATED_KEY,
        walletType: OTHERS_AGGREGATED_KEY,
        walletAlias: `+${below.length}`,
        value: Math.max(restValue, minVisual),
        amount: restAmount,
        percentage: restPercentage,
        chartColor: "transparent",
      },
    ];
  }, [sortedWallets]);

  const isMobile = (size.width ?? 0) < MOBILE_BREAKPOINT;

  const layoutItems: LayoutItem[] = useMemo(() => {
    if (groupedWallets.length === 0) {
      return [];
    }
    const { width, height } = containerSize;
    if (width <= 0 || height <= 0) {
      return [];
    }
    type TreeDatum = { children: WalletAssetsPercentageData };
    const root = hierarchy<TreeDatum>({ children: groupedWallets })
      .sum((d) => (d as unknown as { value: number }).value)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laidOut = treemap<TreeDatum>()
      .size([width, height])
      .paddingInner(PADDING_BETWEEN_TILES)
      .round(true)(root) as HierarchyRectangularNode<TreeDatum>;
    return laidOut.leaves().map((leaf) => {
      // the root has a synthetic { children } wrapper; each leaf's data is the original wallet object
      const walletData = (
        leaf as unknown as { data: WalletAssetsPercentageData[number] }
      ).data;
      return {
        wallet: walletData,
        category: classifyWalletType(walletData.walletType),
        x: leaf.x0,
        y: leaf.y0,
        width: leaf.x1 - leaf.x0,
        height: leaf.y1 - leaf.y0,
      };
    });
  }, [groupedWallets, containerSize]);

  const categorySummary = useMemo(() => {
    const total = sortedWallets.reduce((sum, w) => sum + w.value, 0);
    const groups: Record<WalletCategory, number> = {
      cex: 0,
      onchain: 0,
      broker: 0,
      others: 0,
      aggregated: 0,
    };
    for (const w of sortedWallets) {
      groups[classifyWalletType(w.walletType)] += w.value;
    }
    // only show real category pills — the aggregated bucket is visible
    // as its own tile in the treemap, no need to repeat it as a pill
    return (["cex", "onchain", "broker", "others"] as WalletCategory[]).map(
      (cat) => ({
        category: cat,
        value: groups[cat],
        percentage: total > 0 ? (groups[cat] / total) * 100 : 0,
      }),
    );
  }, [sortedWallets]);

  const aggregatedWallets = useMemo<WalletAssetsPercentageData | null>(() => {
    const MIN_PCT = 1;
    const above = sortedWallets.filter((w) => w.percentage >= MIN_PCT);
    const below = sortedWallets.filter((w) => w.percentage < MIN_PCT);

    if (below.length === 0) return null;
    // fallback: all wallets below 1% and total ≤ MAX_TILES → no aggregation
    if (above.length === 0 && sortedWallets.length <= MAX_TILES) return null;
    // fallback: all below 1% but too many → aggregate the tail after MAX_TILES-1
    if (above.length === 0) return sortedWallets.slice(MAX_TILES - 1);
    return below;
  }, [sortedWallets]);

  // rank within category so we can compute the per-tile opacity gradient
  const rankByCategory = useMemo(() => {
    const grouped: Record<WalletCategory, WalletAssetsPercentageData> = {
      cex: [],
      onchain: [],
      broker: [],
      others: [],
      aggregated: [],
    };
    for (const w of groupedWallets) {
      grouped[classifyWalletType(w.walletType)].push(w);
    }
    const ranks = new Map<string, { rank: number; total: number }>();
    for (const cat of Object.keys(grouped) as WalletCategory[]) {
      const items = grouped[cat].sort((a, b) => b.value - a.value);
      items.forEach((w, i) => {
        ranks.set(w.wallet, { rank: i, total: items.length });
      });
    }
    return ranks;
  }, [groupedWallets]);

  const totalValue = useMemo(
    () => sortedWallets.reduce((sum, w) => sum + w.value, 0),
    [sortedWallets],
  );

  const top3Percentage = useMemo(() => {
    if (sortedWallets.length === 0) {
      return 0;
    }
    return sortedWallets.slice(0, 3).reduce((sum, w) => sum + w.percentage, 0);
  }, [sortedWallets]);

  const topWallet = sortedWallets[0];
  const chartHasData = layoutItems.length > 0;

  const handleTileClick = (wallet: WalletAssetsPercentageData[number]) => {
    const urlFn = wallet.walletType
      ? WALLET_DETAIL_URLS[wallet.walletType]
      : undefined;
    if (urlFn) {
      void openUrl(urlFn(wallet.wallet));
    }
  };

  const formatTileLabel = (item: LayoutItem, name: string) =>
    t("walletAllocation.tileLabel")
      .replace("{name}", name)
      .replace("{type}", t(WALLET_CATEGORY_BASE_COLORS[item.category].labelKey))
      .replace("{percentage}", `${item.wallet.percentage.toFixed(2)}%`)
      .replace(
        "{value}",
        `${currency.symbol}${prettyNumberToLocaleString(
          currencyWrapper(currency)(item.wallet.value),
        )}`,
      );

  return (
    <Card data-card-boundary="true">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3">
        <CardTitle className="flex flex-wrap items-center gap-1 text-sm font-medium text-muted-foreground">
          {symbol ? (
            <>
              <AssetLabel asset={{ symbol, assetType }} />
              <span>{t("walletAllocation.title")}</span>
            </>
          ) : (
            t("walletAllocation.title")
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <div>
            {t("walletAllocation.wallets")}:{" "}
            <span className="text-foreground mono">{sortedWallets.length}</span>
          </div>
          <div data-testid="stat-top">
            {t("walletAllocation.top")}:{" "}
            <span className="text-foreground mono">
              {topWallet
                ? `${topWallet.percentage.toFixed(2)}%`
                : t("common.dash")}
            </span>
          </div>
          <div data-testid="stat-top3">
            {t("walletAllocation.top3")}:{" "}
            <span className="text-foreground mono">
              {top3Percentage.toFixed(2)}%
            </span>
          </div>
          <div data-testid="stat-total-value">
            {t("walletAllocation.totalValue")}:{" "}
            <span className="text-foreground mono">
              {currency.symbol}
              {prettyNumberToLocaleString(
                currencyWrapper(currency)(totalValue),
              )}
            </span>
          </div>
        </div>

        <div
          ref={containerRef}
          role="group"
          aria-label={t("walletAllocation.title")}
          data-testid="wallet-treemap-container"
          className="relative w-full overflow-hidden"
          style={{ height: isMobile ? MOBILE_HEIGHT : DESKTOP_HEIGHT }}
        >
          {chartHasData && !isReady ? (
            <div
              data-testid="wallet-treemap-placeholder"
              className="absolute inset-0 flex items-center justify-center text-muted-foreground"
            >
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
            </div>
          ) : null}
          {chartHasData && isReady ? (
            <>
              <div className="absolute inset-0">
                {layoutItems.map((item) => {
                  const ranks = rankByCategory.get(item.wallet.wallet);
                  const rank = ranks?.rank ?? 0;
                  const total = ranks?.total ?? 1;
                  const contentLevel = tileContentLevel(item.height, isMobile);
                  const textTone = pickTileTextColor(item.height, isMobile);
                  const isAggregatedTile =
                    item.wallet.wallet === OTHERS_AGGREGATED_KEY;
                  const name = isAggregatedTile
                    ? `${t("walletAllocation.type.aggregated")} ${item.wallet.walletAlias ?? ""}`
                    : getWalletDisplayName(item.wallet);
                  const detailUrlFn = item.wallet.walletType
                    ? WALLET_DETAIL_URLS[item.wallet.walletType]
                    : undefined;
                  const ariaLabel = formatTileLabel(item, name);
                  const tileKey = `${item.wallet.wallet}-${item.wallet.walletType ?? "none"}`;

                  const handleClick = (
                    e: React.MouseEvent<HTMLDivElement>,
                  ) => {
                    // clicking the same tile again closes the popover
                    if (selectedTileKey === tileKey) {
                      setSelectedTileKey(null);
                      setSelectedItem(null);
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const below = rect.top < 200;
                    const viewportW = window.innerWidth;
                    const halfMax = 160;
                    const rawCenter = rect.left + rect.width / 2;
                    const clampedCenter = Math.max(
                      halfMax + 8,
                      Math.min(viewportW - halfMax - 8, rawCenter),
                    );
                    setSelectedTileKey(tileKey);
                    setSelectedItem(item);
                    setPopoverPos({
                      left: clampedCenter,
                      top: below ? rect.bottom + 6 : rect.top - 6,
                      below,
                    });
                  };

                  return (
                    <div
                      key={tileKey}
                      style={{
                        position: "absolute",
                        left: item.x,
                        top: item.y,
                        width: item.width,
                        height: item.height,
                      }}
                      onClick={handleClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                        }
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleTileClick(item.wallet)}
                        data-testid="wallet-treemap-tile"
                        data-tile-key={item.wallet.wallet}
                        data-tile-category={item.category}
                        aria-label={ariaLabel}
                        className={
                          "absolute inset-0 overflow-hidden text-left rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card animate-in fade-in duration-200 " +
                          (textTone === "foreground"
                            ? "text-white"
                            : "text-white/60") +
                          " " +
                          (detailUrlFn ? "cursor-pointer" : "cursor-default")
                        }
                        style={{
                          background: tileBackground(
                            item.category,
                            rank,
                            total,
                          ),
                          padding: "6px 8px",
                        }}
                      >
                        {contentLevel === "full" && (
                          <div className="flex h-full flex-col justify-between">
                            <div className="text-[11px] font-medium leading-tight line-clamp-2">
                              {name}
                            </div>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="mono text-[11px] tabular-nums">
                                {item.wallet.percentage.toFixed(2)}%
                              </span>
                              <span className="text-[9px] uppercase tracking-wider opacity-80">
                                {t(
                                  WALLET_CATEGORY_BASE_COLORS[item.category]
                                    .labelKey,
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                        {contentLevel === "name-pct" && (
                          <div className="flex h-full flex-col justify-end">
                            <div className="text-[11px] font-medium leading-tight line-clamp-2">
                              {name}
                            </div>
                            <div className="mono text-[10px] tabular-nums">
                              {item.wallet.percentage.toFixed(2)}%
                            </div>
                          </div>
                        )}
                        {contentLevel === "name" && (
                          <div className="text-[10px] font-medium leading-tight line-clamp-2">
                            {name}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              {isReady &&
                selectedTileKey &&
                selectedItem &&
                createPortal(
                  <PopoverContent
                    item={selectedItem}
                    name={
                      selectedItem.wallet.wallet === OTHERS_AGGREGATED_KEY
                        ? `${t("walletAllocation.type.aggregated")} ${selectedItem.wallet.walletAlias ?? ""}`
                        : getWalletDisplayName(selectedItem.wallet)
                    }
                    aggregatedWallets={aggregatedWallets}
                    currency={currency}
                    displayAmount={displayAmount}
                    t={t}
                    style={{
                      position: "fixed",
                      left: popoverPos.left,
                      top: popoverPos.top,
                      transform: popoverPos.below
                        ? "translate(-50%, 0)"
                        : "translate(-50%, -100%)",
                      zIndex: 9999,
                    }}
                  />,
                  document.body,
                )}
            </>
          ) : (
            <div
              data-testid="wallet-treemap-empty"
              className="absolute inset-0 flex items-center justify-center text-lg text-muted-foreground"
            >
              {t("walletAllocation.noData")}
            </div>
          )}
        </div>

        {chartHasData && (
          <div
            className="flex flex-wrap items-center gap-2 text-xs"
            data-testid="type-summary"
          >
            <span className="text-muted-foreground">
              {t("walletAllocation.typeSummary")}:
            </span>
            {categorySummary
              .filter((s) => s.value > 0)
              .map((s) => (
                <span
                  key={s.category}
                  data-testid={`type-pill-${s.category}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-2 py-0.5"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{
                      background: tileBackground(s.category, 0, 1),
                    }}
                  />
                  <span className="text-foreground">
                    {t(WALLET_CATEGORY_BASE_COLORS[s.category].labelKey)}
                  </span>
                  <span className="text-muted-foreground mono">
                    {s.percentage.toFixed(2)}%
                  </span>
                </span>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default App;
