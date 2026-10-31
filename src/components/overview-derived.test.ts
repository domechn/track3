import { describe, expect, it } from "vitest";
import { deriveOverviewSeries, deriveContributions, selectContributionSnapshots, unavailableSources } from "./overview-derived";

describe("overview render data", () => {
  it("uses the newest seven snapshots even though the database returns dates descending", () => {
    const dates = Array.from({ length: 12 }, (_, index) => ({ id: String(index), createdAt: `2026-01-${String(index + 1).padStart(2, "0")}` })).reverse();
    expect(selectContributionSnapshots(dates, new Date("2026-01-01"), new Date("2026-01-31"))).toEqual({ fromId: "5", toId: "11", count: 7 });
    expect(selectContributionSnapshots(dates, new Date("2026-01-01"), new Date("2026-01-03"))).toEqual({ fromId: "0", toId: "2", count: 3 });
  });
  it("limits daily changes and best day to the selected range while retaining the all time high", () => {
    const day = (date: string) => Date.parse(`${date}T12:00:00Z`);
    expect(deriveOverviewSeries([
      { timestamp: day("2026-01-01"), totalValue: 100 },
      { timestamp: day("2026-01-02"), totalValue: 150 },
      { timestamp: day("2026-01-03"), totalValue: 90 },
      { timestamp: day("2026-01-04"), totalValue: 110 },
    ], { start: new Date("2026-01-03"), end: new Date("2026-01-04T23:59:59Z") })).toEqual({
      daily: [{ timestamp: day("2026-01-04"), value: 20 }],
      bestDay: { timestamp: day("2026-01-04"), value: 20 },
      ath: { timestamp: day("2026-01-02"), value: 150 },
      distanceFromAth: -40 / 150 * 100,
    });
  });
  it("finds daily changes, the best day, and the all time high from full snapshot totals", () => {
    const day = (date: string) => Date.parse(`${date}T12:00:00Z`);
    expect(deriveOverviewSeries([
      { timestamp: day("2026-01-01"), totalValue: 100 },
      { timestamp: day("2026-01-02"), totalValue: 92 },
      { timestamp: day("2026-01-03"), totalValue: 117 },
      { timestamp: day("2026-01-04"), totalValue: 110 },
    ])).toEqual({
      daily: [
        { timestamp: day("2026-01-02"), value: -8 },
        { timestamp: day("2026-01-03"), value: 25 },
        { timestamp: day("2026-01-04"), value: -7 },
      ],
      bestDay: { timestamp: day("2026-01-03"), value: 25 },
      ath: { timestamp: day("2026-01-03"), value: 117 },
      distanceFromAth: -7 / 117 * 100,
    });
  });

  it("uses the last snapshot of each day for one daily bar", () => {
    const timestamp = (time: string) => Date.parse(time);
    expect(deriveOverviewSeries([
      { timestamp: timestamp("2026-01-01T12:00:00Z"), totalValue: 100 },
      { timestamp: timestamp("2026-01-01T13:00:00Z"), totalValue: 110 },
      { timestamp: timestamp("2026-01-02T12:00:00Z"), totalValue: 105 },
      { timestamp: timestamp("2026-01-02T13:00:00Z"), totalValue: 120 },
    ]).daily).toEqual([{ timestamp: timestamp("2026-01-02T13:00:00Z"), value: 10 }]);
  });

  it("keeps empty and flat histories honest", () => {
    expect(deriveOverviewSeries([])).toEqual({
      daily: [], bestDay: undefined, ath: undefined, distanceFromAth: undefined,
    });
    expect(deriveOverviewSeries([{ timestamp: 1000, totalValue: 0 }])).toEqual({
      daily: [], bestDay: undefined, ath: { timestamp: 1000, value: 0 }, distanceFromAth: undefined,
    });
  });

  it("attributes the change between two snapshots by asset and retains sold positions", () => {
    expect(deriveContributions([
      { uuid: "old", symbol: "BTC", assetType: "crypto", value: 100 },
      { uuid: "old", symbol: "SOL", assetType: "crypto", value: 25 },
      { uuid: "new", symbol: "BTC", assetType: "crypto", value: 115 },
      { uuid: "new", symbol: "ETH", assetType: "crypto", value: 40 },
    ], "old", "new")).toEqual([
      { symbol: "ETH", assetType: "crypto", value: 40 },
      { symbol: "SOL", assetType: "crypto", value: -25 },
      { symbol: "BTC", assetType: "crypto", value: 15 },
    ]);
  });

  it("shows only failed or stale local source statuses with the last good time", () => {
    expect(unavailableSources([
      { sourceId: "cex:0", label: "Binance", status: "ok" },
      { sourceId: "cex:1", label: "OKX", status: "failed", lastSuccessAt: "2026-10-30T21:14:00Z" },
      { sourceId: "btc:0", label: "Ledger", status: "stale" },
    ])).toEqual([
      { name: "OKX", lastSuccessAt: "2026-10-30T21:14:00Z", status: "failed" },
      { name: "Ledger", lastSuccessAt: undefined, status: "stale" },
    ]);
  });
});
