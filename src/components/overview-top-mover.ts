import { useEffect, useRef, useState } from "react";
import { queryAllDataDates, queryAssetsByUUIDs } from "@/middlelayers/charts";
import { deriveContributions, selectBestDayContributionSnapshots } from "./overview-derived";

export function useOverviewTopMover(timestamp: number | undefined, rangeStart: number | undefined) {
  const date = timestamp === undefined ? undefined : new Date(timestamp);
  const dayEnd = date && new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
  const key = dayEnd === undefined || rangeStart === undefined ? "" : `${rangeStart}:${dayEnd}`;
  const dates = useRef<ReturnType<typeof queryAllDataDates>>();
  const cache = useRef(new Map<string, { symbol: string; value: number } | null>());
  const [result, setResult] = useState<{ key: string; mover: { symbol: string; value: number } | null }>();
  useEffect(() => {
    if (!key || dayEnd === undefined || rangeStart === undefined) return;
    let active = true;
    void (async () => {
      if (cache.current.has(key)) {
        setResult({ key, mover: cache.current.get(key) ?? null });
        return;
      }
      let mover: { symbol: string; value: number } | null = null;
      try {
        const pair = selectBestDayContributionSnapshots(
          await (dates.current ??= queryAllDataDates()), dayEnd, new Date(rangeStart));
        if (pair) {
          const assets = await queryAssetsByUUIDs([pair.fromId, pair.toId]);
          const top = deriveContributions(assets, pair.fromId, pair.toId)
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
          if (top?.value) mover = { symbol: top.symbol, value: top.value };
        }
      } catch { /* A missing daily mover must not hide the value tooltip. */ }
      cache.current.set(key, mover);
      if (active) setResult({ key, mover });
    })();
    return () => { active = false; };
  }, [key]);
  return result?.key === key ? result.mover ?? undefined : undefined;
}
