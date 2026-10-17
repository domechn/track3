import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hourlyHistory } from "@/test/history-fixtures";

const sqlSelect = vi.hoisted(() => vi.fn());
const readCount = vi.hoisted(() => ({ rows: 0 }));
vi.mock("./database", () => ({ selectFromDatabaseWithSql: sqlSelect }));
vi.mock("./configuration", () => ({ getBlacklistCoins: vi.fn().mockResolvedValue([]) }));

import {
  queryAssetChange,
  queryAssetsPercentageChange,
  queryCoinsAmountChange,
  queryPNLChartValue,
  queryTopCoinsRank,
  queryTopCoinsPercentageChangeData,
  queryTopNAssets,
} from "./charts-timeseries";
import { queryLatestAssetsPercentage } from "./charts-assets";

const range = {
  start: new Date("2022-01-01T00:00:00.000Z"),
  end: new Date("2022-01-02T23:00:00.000Z"),
};

describe("large time-series queries", () => {
  let addRows: (sql: string) => void;
  beforeEach(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(`CREATE TABLE assets_v2 (
      id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT, wallet TEXT,
      asset_type TEXT, symbol TEXT, amount REAL, value REAL, price REAL
    )`);
    const insert = db.prepare(
      "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const snapshot of hourlyHistory(43, 200)) {
      for (const asset of snapshot.assets) {
        insert.run([
          snapshot.id, snapshot.createdAt, "wallet", "crypto",
          asset.symbol, asset.amount, asset.value, asset.price,
        ]);
      }
    }
    insert.free();
    addRows = (sql) => db.run(sql);
    sqlSelect.mockReset();
    readCount.rows = 0;
    sqlSelect.mockImplementation(async (sql: string, values: unknown[]) => {
      const stmt = db.prepare(sql);
      stmt.bind(values as (string | number)[]);
      const rows: object[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      readCount.rows += rows.length;
      return rows;
    });
  });

  it("gets full-resolution PNL and portfolio totals with one aggregate query each", async () => {
    const pnl = await queryPNLChartValue(range);
    const change = await queryAssetChange(range);
    expect(pnl).toHaveLength(43);
    expect(pnl[0].totalValue).toBe(20100);
    expect(pnl.at(-1)?.totalValue).toBe(28500);
    expect(change.data).toHaveLength(43);
    expect(change.data.at(-1)?.usdValue).toBe(28500);
    expect(sqlSelect).toHaveBeenCalledTimes(2);
    expect(readCount.rows).toBeLessThanOrEqual(86);
  });
  it("excludes blacklisted symbols from every goal portfolio value", async () => {
    const values = await queryPNLChartValue(range, 80, ["asset0"]);
    expect(values).toHaveLength(43);
    expect(values[0].totalValue).toBe(20099);
    expect(values.at(-1)?.totalValue).toBe(28457);
    expect(sqlSelect).toHaveBeenCalledTimes(1);
    expect(readCount.rows).toBeLessThanOrEqual(43);
  });
  it("uses the evaluator's exact symbol matching for blacklist filtering", async () => {
    addRows("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ('snapshot-000000', '2022-01-01T00:00:00.000Z', 'wallet', 'crypto', ' ASSET0 ', 1, 100, 100)");
    const values = await queryPNLChartValue(range, 80, ["asset0"]);
    expect(values[0].totalValue).toBe(20199);
  });

  it("gets a full-resolution coin series without reading every matching asset model", async () => {
    const coin = await queryCoinsAmountChange("ASSET0", range);
    expect(coin?.values).toHaveLength(43);
    expect(coin?.values.at(-1)).toBe(43);
    expect(coin?.amounts.at(-1)).toBe(1);
    expect(sqlSelect).toHaveBeenCalledTimes(1);
    expect(readCount.rows).toBeLessThanOrEqual(43);
  });

  it("returns bounded composition rows with exact per-snapshot percentages", async () => {
    const top = await queryTopNAssets(range, 6);
    const composition = await queryAssetsPercentageChange(range, 6);
    expect(top).toHaveLength(6);
    expect(composition).toHaveLength(43);
    expect(composition[0].percentages).toHaveLength(7);
    expect(composition[0].percentages.reduce((sum, asset) => sum + asset.percentage, 0)).toBeCloseTo(100);
    expect(composition.at(-1)?.percentages.reduce((sum, asset) => sum + asset.percentage, 0)).toBeCloseTo(100);
    expect(sqlSelect).toHaveBeenCalledTimes(2);
    expect(readCount.rows).toBeLessThanOrEqual(43 * 8);
  });

  it("uses the requested top-N size for the composition series", async () => {
    const composition = await queryAssetsPercentageChange(range, 2);
    expect(composition).toHaveLength(43);
    expect(composition[0].percentages).toHaveLength(3);
    expect(composition[0].percentages.at(-1)?.symbol).toBe("__other__");
  });

  it("reads snapshot totals and only sampled top assets for Overview rank and change", async () => {
    const rank = await queryTopCoinsRank(range, 6);
    const change = await queryTopCoinsPercentageChangeData(range, 6);
    expect(rank.timestamps[0]).toBe(range.start.getTime());
    expect(rank.timestamps.at(-1)).toBe(new Date("2022-01-02T18:00:00.000Z").getTime());
    expect(rank.timestamps.length).toBeLessThanOrEqual(6);
    expect(change.timestamps).toEqual(rank.timestamps);
    expect(rank.coins.find((coin) => coin.coin === "ASSET199")?.rankData).toHaveLength(rank.timestamps.length);
    expect(change.coins.find((coin) => coin.coin === "ASSET199")?.percentageData.at(-1)?.value).toBeCloseTo(21);
    expect(sqlSelect).toHaveBeenCalledTimes(4);
    expect(readCount.rows).toBeLessThanOrEqual(43 * 2 + 6 * 10 * 2);
  });

  it("loads only the latest snapshot's assets for its percentage card", async () => {
    const latest = await queryLatestAssetsPercentage(range);
    expect(latest).toHaveLength(200);
    expect(latest[0].coin).toBe("ASSET199");
    expect(sqlSelect).toHaveBeenCalledTimes(1);
    expect(readCount.rows).toBeLessThanOrEqual(200);
  });

  it("keeps sampled values after a previously top coin falls out of the top ten", async () => {
    addRows("UPDATE assets_v2 SET value = 0 WHERE uuid = 'snapshot-000042' AND symbol = 'ASSET199'");
    const change = await queryTopCoinsPercentageChangeData(range, 6);
    const coin = change.coins.find((item) => item.coin === "ASSET199");
    expect(coin?.percentageData.at(-1)).toMatchObject({
      timestamp: new Date("2022-01-02T18:00:00.000Z").getTime(),
      value: -100,
    });
  });

  it("uses the snapshot timestamp for ranked assets with mixed row timestamps", async () => {
    addRows("UPDATE assets_v2 SET createdAt = '2022-01-02T18:01:00.000Z' WHERE uuid = 'snapshot-000042' AND symbol = 'ASSET199'");
    const rank = await queryTopCoinsRank(range, 6);
    const coin = rank.coins.find((item) => item.coin === "ASSET198");
    expect(coin?.rankData.at(-1)).toEqual({
      timestamp: new Date("2022-01-02T18:01:00.000Z").getTime(),
      rank: 2,
    });
  });

  it("combines case and whitespace variants in top assets, composition, and coin series", async () => {
    addRows(`INSERT INTO assets_v2
      (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES
      ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-a', 'crypto', 'btc', 2, 500000, 250000),
      ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-b', 'crypto', ' BTC ', 3, 500000, 166666.67),
      ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet-a', 'crypto', 'ETH', 1, 700000, 700000)`);
    const top = await queryTopNAssets(range, 1);
    expect(top).toEqual([{ symbol: "BTC", assetType: "crypto" }]);
    const composition = await queryAssetsPercentageChange(range, 1);
    expect(composition.at(-1)?.percentages).toHaveLength(2);
    expect(composition.at(-1)?.percentages[0]).toMatchObject({
      symbol: "BTC", percentage: 1000000 / 1728500 * 100,
    });
    const coin = await queryCoinsAmountChange("BTC", range);
    expect(coin?.values).toBeUndefined();
    const exact = await queryCoinsAmountChange("btc", range);
    expect(exact?.values).toEqual([500000]);
    expect(exact?.amounts).toEqual([2]);
  });

  it("preserves the stored display case for a top asset", async () => {
    addRows(`INSERT INTO assets_v2
      (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES ('snapshot-000042', '2022-01-02T18:00:00.000Z', 'wallet', 'crypto', 'stETH', 1, 1000000, 1000000)`);
    expect(await queryTopNAssets(range, 1)).toEqual([{ symbol: "stETH", assetType: "crypto" }]);
    expect((await queryAssetsPercentageChange(range, 1)).at(-1)?.percentages[0].symbol).toBe("stETH");
  });
});
