import { CurrencyRateDetail, LatestAssetsPercentageData, TDateRange, TopCoinsRankData } from "@/middlelayers/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { queryLatestAssetsPercentage, queryTopCoinsRank } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { getImageApiPath } from "@/utils/app";
import { downloadCoinLogos } from "@/middlelayers/data";
import bluebird from "bluebird";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import AssetLabel from "@/components/common/asset-label";
import {
  buildAssetDetailsPath,
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import { useTranslation } from "@/mobile/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { ListRow, useIsMobile } from "@/mobile/components/mobile";

const PAGE_SIZE = 20;

const App = ({ dateRange, currency }: { dateRange: TDateRange; currency?: CurrencyRateDetail }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [latest, setLatest] = useState<LatestAssetsPercentageData>([]);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();

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
    const [tcr, holdings] = await Promise.all([
      queryTopCoinsRank(dr), queryLatestAssetsPercentage(dr).catch(() => [] as LatestAssetsPercentageData),
    ]);
    if (gen !== loadGenRef.current) {
      return;
    }
    setTopCoinsRankData(tcr);
    setLatest(holdings);
  }

  useEffect(() => {
    if (topCoinsRankData.coins.length === 0) return;
    downloadCoinLogos(
      topCoinsRankData.coins
        .filter((coin) => shouldDownloadCryptoLogo(coin))
        .map((c) => ({ symbol: c.coin, price: 0 })),
    );
    getLogoMap(topCoinsRankData.coins).then((m) => setLogoMap(m));
  }, [topCoinsRankData]);

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

  const rankRows = useMemo(() => {
    return topCoinsRankData.coins
      .map((coin) => {
        const ranks = coin.rankData
          .filter((r) => r.rank !== undefined)
          .sort((a, b) => a.timestamp - b.timestamp);
        if (ranks.length === 0) return null;
        const firstRank = ranks[0].rank!;
        const lastRank = ranks[ranks.length - 1].rank!;
        const change = firstRank - lastRank; // positive = improved (lower rank number)
        return {
          coin: coin.coin,
          assetType: coin.assetType,
          rank: lastRank,
          change,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.rank - b!.rank) as {
      coin: string;
      assetType: "crypto" | "stock";
      rank: number;
      change: number;
    }[];
  }, [topCoinsRankData]);
  const latestByAsset = useMemo(() => new Map(latest.map((asset) =>
    [getAssetLogoKey({ symbol: asset.coin, assetType: asset.assetType }), asset])), [latest]);

  const maxPage = useMemo(
    () => Math.max(Math.ceil(rankRows.length / PAGE_SIZE) - 1, 0),
    [rankRows.length],
  );

  useEffect(() => {
    setPage(0);
  }, [rangeKey, dataChangedVersion]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, maxPage));
  }, [maxPage]);

  const pagedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rankRows.slice(start, start + PAGE_SIZE);
  }, [rankRows, page]);

  function renderChangeBadge(change: number) {
    if (change > 0) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-500">
          ↑{change}
        </span>
      );
    }
    if (change < 0) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-500">
          ↓{Math.abs(change)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        —
      </span>
    );
  }

  return (
    <div>
      <Card className="top-coins-rank-card">
        <CardHeader className="top-coins-rank-header flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("topCoinsRank.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="top-coins-rank-content">
          {isMobile && <div className="top-coins-rank-mobile mobile-record-list">
            {pagedRows.map((row) => {
              const asset = { symbol: row.coin, assetType: row.assetType };
              const logoKey = getAssetLogoKey(asset);
              const holding = latestByAsset.get(logoKey);
              return <ListRow key={logoKey} href={`#${buildAssetDetailsPath(asset)}`}
                value={<span className="top-coins-rank-value">
                  <strong>{holding ? `${currency?.symbol ?? "$"}${prettyNumberToLocaleString(currency ? currencyWrapper(currency)(holding.value) : holding.value)}` : "—"}</strong>
                  <small>{holding ? `${holding.percentage.toFixed(1)}%` : "—"} · {renderChangeBadge(row.change)}</small>
                </span>}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">#{row.rank}</span>
                  <img className="h-6 w-6 shrink-0 rounded-full"
                    src={resolveAssetLogoSrc(asset, logoMap[logoKey])}
                    alt={formatAssetLabel(asset)} />
                  <AssetLabel asset={asset} labelClassName="truncate text-sm font-medium" />
                </span>
              </ListRow>;
            })}
          </div>}
          {!isMobile && <Table>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow
                  key={getAssetLogoKey({
                    symbol: row.coin,
                    assetType: row.assetType,
                  })}
                  className="h-[42px] cursor-pointer group"
                  onClick={() =>
                    navigate(
                      buildAssetDetailsPath({
                        symbol: row.coin,
                        assetType: row.assetType,
                      }),
                    )
                  }
                >
                  <TableCell className="w-[40px] text-muted-foreground font-mono text-xs py-1.5">
                    #{row.rank}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      <img
                        className="w-[18px] h-[18px] rounded-full"
                        src={resolveAssetLogoSrc(
                          { symbol: row.coin, assetType: row.assetType },
                          logoMap[
                            getAssetLogoKey({
                              symbol: row.coin,
                              assetType: row.assetType,
                            })
                          ],
                        )}
                        alt={formatAssetLabel({
                          symbol: row.coin,
                          assetType: row.assetType,
                        })}
                      />
                      <AssetLabel
                        asset={{
                          symbol: row.coin,
                          assetType: row.assetType,
                        }}
                        labelClassName="font-medium text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-1.5">
                    {renderChangeBadge(row.change)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>}
          {rankRows.length > PAGE_SIZE ? (
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page <= 0}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {maxPage + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(prev + 1, maxPage))}
                disabled={page >= maxPage}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
