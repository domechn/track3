import { vi } from "vitest";
import type { HistoricalData } from "@/middlelayers/types";

// Retains the fixtures in older History UI tests while exercising the paged UI API.
export function mockHistoricalQueries() {
  let lastRows: HistoricalData[] = [];
  const queryHistoricalData = vi.fn<() => Promise<HistoricalData[]>>();
  const queryHistoricalPage = vi.fn(async (_range: unknown, pageSize: number, page: number) => {
    lastRows = await queryHistoricalData();
    return {
      totalCount: lastRows.length,
      latest: lastRows[0] ? {
        id: lastRows[0].id,
        createdAt: lastRows[0].createdAt,
        total: lastRows[0].total,
      } : null,
      rows: lastRows.slice(page * pageSize, (page + 1) * pageSize).map((row, index) => ({
        id: row.id,
        createdAt: row.createdAt,
        total: row.total,
        change: lastRows[page * pageSize + index + 1]
          ? row.total - lastRows[page * pageSize + index + 1].total : null,
        assetCount: row.assets.length,
        topAssets: row.assets.slice(0, 7),
      })),
    };
  });
  const queryHistoricalDetail = vi.fn(async (id: string) =>
    lastRows.find((row) => row.id === id) ?? {
      id, createdAt: "", total: 0, assets: [], transactions: [],
    },
  );
  return { queryHistoricalData, queryHistoricalPage, queryHistoricalDetail };
}
