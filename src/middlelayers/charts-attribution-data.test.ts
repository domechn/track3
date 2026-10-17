import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryAttribution } from "./charts-attribution-data";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { getBlacklistCoins } from "./configuration";
import { invalidateCacheGroups } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";

const alias = vi.hoisted(() => ({ name: "Main" }));
vi.mock("./entities/assets", () => ({ ASSET_HANDLER: { listAssetsByDateRange: vi.fn() } }));
vi.mock("./entities/transactions", () => ({ TRANSACTION_HANDLER: { listTransactionsByDateRange: vi.fn() } }));
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
    vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([snapshot(2, 2, 240).assets, snapshot(1, 1, 100).assets] as never);
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([[{ id: 1, assetID: 2, uuid: "u2", wallet: "w", symbol: "BTC", assetType: "crypto", amount: 1, price: 120, txnType: "buy", txnCreatedAt: date(2), createdAt: date(2), updatedAt: date(2) }]] as never);
    const result = await queryAttribution(range);
    expect(ASSET_HANDLER.listAssetsByDateRange).toHaveBeenCalledWith(range.start, range.end);
    expect(TRANSACTION_HANDLER.listTransactionsByDateRange).toHaveBeenCalledWith(range.start, range.end);
    expect(result.attribution.totals).toEqual({ priceEffect: 20, flowEffect: 120, residual: 0, totalChange: 140 });
    expect(result.aliases.w).toMatchObject({ alias: "Main", type: "Binance" });
  });

  it("reuses a range result until the data-change epoch advances", async () => {
    const cacheRange = { start: range.start, end: new Date("2024-04-04T23:59:59.000Z") };
    vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([
      snapshot(1, 1, 100).assets, snapshot(2, 2, 240).assets,
    ] as never);
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([] as never);
    const first = await queryAttribution(cacheRange);
    vi.mocked(ASSET_HANDLER.listAssetsByDateRange).mockResolvedValue([
      snapshot(1, 1, 100).assets, snapshot(2, 2, 300).assets,
    ] as never);
    alias.name = "Renamed";
    const cached = await queryAttribution(cacheRange);
    expect(cached.attribution.totals.totalChange).toBe(first.attribution.totals.totalChange);
    expect(cached.aliases.w?.alias).toBe("Renamed");
    expect(ASSET_HANDLER.listAssetsByDateRange).toHaveBeenCalledTimes(1);

    invalidateCacheGroups({ localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY] });
    const fresh = await queryAttribution(cacheRange);
    expect(fresh.attribution.totals.totalChange).toBe(200);
    expect(ASSET_HANDLER.listAssetsByDateRange).toHaveBeenCalledTimes(2);
  });
});
