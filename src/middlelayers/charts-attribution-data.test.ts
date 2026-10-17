import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryAttribution } from "./charts-attribution-data";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { getBlacklistCoins } from "./configuration";
import { invalidateCacheGroups } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";
import { selectFromDatabaseWithSql } from "./database";
import initSqlJs from "sql.js";

const alias = vi.hoisted(() => ({ name: "Main" }));
vi.mock("./entities/assets", () => ({ ASSET_HANDLER: { listAssetsByUUIDs: vi.fn() } }));
vi.mock("./entities/transactions", () => ({ TRANSACTION_HANDLER: { listTransactionsByUUIDs: vi.fn() } }));
vi.mock("./database", () => ({ selectFromDatabaseWithSql: vi.fn() }));
vi.mock("./configuration", () => ({ getBlacklistCoins: vi.fn() }));
vi.mock("./wallet", () => ({ WalletAnalyzer: class { async listWalletAliases() { return { w: { alias: alias.name, type: "Binance", wallet: "address" } }; } } }));

const range = { start: new Date("2024-04-01T00:00:00.000Z"), end: new Date("2024-04-02T23:59:59.000Z") };
const date = (day: number) => `2024-04-0${day}T00:00:00.000Z`;
const snapshot = (day: number, amount: number, value: number, transactions: unknown[] = []) => ({
  id: `u${day}`, createdAt: date(day), total: value, transactions,
  assets: [{ id: day, uuid: `u${day}`, createdAt: date(day), wallet: "w", symbol: "BTC", assetType: "crypto", amount, value, price: value / amount }],
});

beforeEach(() => { vi.clearAllMocks(); alias.name = "Main"; vi.mocked(getBlacklistCoins).mockResolvedValue([]); });

describe("queryAttribution", () => {
  it("loads unsummarized snapshots with their transactions for the selected range", async () => {
    vi.mocked(selectFromDatabaseWithSql).mockResolvedValue([{ uuid: "u1", createdAt: date(1) }, { uuid: "u2", createdAt: date(2) }] as never);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([...snapshot(2, 2, 240).assets, ...snapshot(1, 1, 100).assets] as never);
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mockResolvedValue([{ id: 1, assetID: 2, uuid: "u2", wallet: "w", symbol: "BTC", assetType: "crypto", amount: 1, price: 120, txnType: "buy", txnCreatedAt: date(2), createdAt: date(2), updatedAt: date(2) }] as never);
    const result = await queryAttribution(range);
    expect(ASSET_HANDLER.listAssetsByUUIDs).toHaveBeenCalledWith(["u1", "u2"]);
    expect(TRANSACTION_HANDLER.listTransactionsByUUIDs).toHaveBeenCalledWith(["u1", "u2"]);
    expect(result.attribution.totals).toEqual({ priceEffect: 20, flowEffect: 120, residual: 0, totalChange: 140 });
    expect(result.aliases.w).toMatchObject({ alias: "Main", type: "Binance" });
    expect(Object.keys(localStorage).some((key) => key.includes("attribution-v3"))).toBe(false);
  });

  it("reuses a range result until the data-change epoch advances", async () => {
    const cacheRange = { start: range.start, end: new Date("2024-04-04T23:59:59.000Z") };
    vi.mocked(selectFromDatabaseWithSql).mockResolvedValue([{ uuid: "u1", createdAt: date(1) }, { uuid: "u2", createdAt: date(2) }] as never);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      ...snapshot(1, 1, 100).assets, ...snapshot(2, 2, 240).assets,
    ] as never);
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mockResolvedValue([] as never);
    const first = await queryAttribution(cacheRange);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      ...snapshot(1, 1, 100).assets, ...snapshot(2, 2, 300).assets,
    ] as never);
    alias.name = "Renamed";
    const cached = await queryAttribution(cacheRange);
    expect(cached.attribution.totals.totalChange).toBe(first.attribution.totals.totalChange);
    expect(cached.aliases.w?.alias).toBe("Renamed");
    expect(ASSET_HANDLER.listAssetsByUUIDs).toHaveBeenCalledTimes(1);

    invalidateCacheGroups({ localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY] });
    const fresh = await queryAttribution(cacheRange);
    expect(fresh.attribution.totals.totalChange).toBe(200);
    expect(ASSET_HANDLER.listAssetsByUUIDs).toHaveBeenCalledTimes(2);
  });

  it("processes an all-time range in bounded snapshot batches and joins transactions by UUID", async () => {
    const allTime = { start: new Date("2024-01-01T00:00:00.000Z"), end: new Date("2024-05-01T00:00:00.000Z") };
    const groups = Array.from({ length: 101 }, (_, index) => {
      const createdAt = new Date(Date.UTC(2024, 0, index + 1)).toISOString();
      const amount = index === 100 ? 2 : 1;
      const value = index === 100 ? 400 : 100 + index;
      return [{ id: index + 1, uuid: `snap-${index}`, createdAt, wallet: "w", symbol: "BTC", assetType: "crypto" as const, amount, value, price: value / amount }];
    });
    const transaction = { id: 101, assetID: 101, uuid: "snap-100", wallet: "w", symbol: "BTC", assetType: "crypto" as const,
      amount: 1, price: 200, txnType: "buy" as const, txnCreatedAt: "2025-01-01T00:00:00.000Z",
      createdAt: groups[100][0].createdAt, updatedAt: groups[100][0].createdAt };
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockImplementation(async (ids) => groups.flat().filter((asset) => ids.includes(asset.uuid)));
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mockImplementation(async (ids) => ids.includes(transaction.uuid) ? [transaction] : []);
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE assets_v2 (uuid TEXT, createdAt TEXT)");
    const insert = db.prepare("INSERT INTO assets_v2 (uuid, createdAt) VALUES (?, ?)");
    for (const [asset] of groups) insert.run([asset.uuid, asset.createdAt]);
    insert.free();
    vi.mocked(selectFromDatabaseWithSql).mockImplementation(async (sql, values) => {
      const statement = db.prepare(sql);
      statement.bind(values as (string | number)[]);
      const rows: object[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      statement.free();
      return rows as never;
    });
    const result = await queryAttribution(allTime);
    expect(result.attribution.totals).toEqual({ priceEffect: 100, flowEffect: 200, residual: 0, totalChange: 300 });
    expect(vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mock.calls.map(([ids]) => ids.length)).toEqual([100, 1]);
    expect(vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mock.calls.map(([ids]) => ids.length)).toEqual([100, 1]);
    const [secondSql, secondValues] = vi.mocked(selectFromDatabaseWithSql).mock.calls[1];
    expect(secondSql).toMatch(/WHERE createdAt >= \? AND createdAt <= \? AND createdAt >= \? GROUP BY uuid/);
    expect(secondValues).toEqual([
      allTime.start.toISOString(), allTime.end.toISOString(), groups[99][0].createdAt,
      groups[99][0].createdAt, groups[99][0].createdAt, "snap-99", 100,
    ]);
  });
});
