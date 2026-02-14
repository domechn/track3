import { TDateRange, TopCoinsRankData } from "@/middlelayers/types";
import { useEffect, useMemo, useRef, useState } from "react";
import _ from "lodash";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import { queryTopCoinsRank } from "@/middlelayers/charts";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { getImageApiPath } from "@/utils/app";
import { downloadCoinLogos } from "@/middlelayers/data";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import bluebird from "bluebird";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

const PAGE_SIZE = 20;

const App = ({ dateRange }: { dateRange: TDateRange }) => {
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [page, setPage] = useState(0);
  const navigate = useNavigate();

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadData(dateRange);
  }, [rangeKey]);

  async function loadData(dr: TDateRange) {
    const tcr = await queryTopCoinsRank(dr);
    setTopCoinsRankData(tcr);
  }

  useEffect(() => {
    if (topCoinsRankData.coins.length === 0) return;
    downloadCoinLogos(
      topCoinsRankData.coins.map((c) => ({ symbol: c.coin, price: 0 }))
    );
    getLogoMap(topCoinsRankData.coins).then((m) => setLogoMap(m));
  }, [topCoinsRankData]);

  async function getLogoMap(coins: { coin: string }[]) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(coins, async (c) => {
      const path = await getImageApiPath(acd, c.coin);
      return { [c.coin]: path };
    });
    return _.assign({}, ...kvs);
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
          rank: lastRank,
          change,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.rank - b!.rank) as {
      coin: string;
      rank: number;
      change: number;
    }[];
  }, [topCoinsRankData]);

  const maxPage = useMemo(
    () => Math.max(Math.ceil(rankRows.length / PAGE_SIZE) - 1, 0),
    [rankRows.length]
  );

  useEffect(() => {
    setPage(0);
  }, [rangeKey]);

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Coins Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow
                  key={row.coin}
                  className="h-[42px] cursor-pointer group"
                  onClick={() => navigate(`/coins/${row.coin}`)}
                >
                  <TableCell className="w-[40px] text-muted-foreground font-mono text-xs py-1.5">
                    #{row.rank}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      <img
                        className="w-[18px] h-[18px] rounded-full"
                        src={logoMap[row.coin] || UnknownLogo}
                        alt={row.coin}
                      />
                      <span className="font-medium text-sm">{row.coin}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-1.5">
                    {renderChangeBadge(row.change)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
