import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { deleteHistoricalDataByUUID, queryRestoreHistoricalData, restoreHistoricalData } from "./charts-history";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./database", () => ({ getDatabase: vi.fn() }));
vi.mock("./entities/assets", () => ({ ASSET_HANDLER: {
  listAssetsByUUIDs: vi.fn(), listAssetsByIDs: vi.fn(), saveAssets: vi.fn(),
} }));
vi.mock("./entities/transactions", () => ({ TRANSACTION_HANDLER: {
  listTransactionsByUUIDs: vi.fn(), listTransactionsByAssetID: vi.fn(), saveTransactions: vi.fn(),
} }));

it("captures prices and restores a whole deleted snapshot through the atomic import", async () => {
  const asset = { id: 7, uuid: "snapshot-1", symbol: "BTC" };
  const price = { id: 8, uuid: "snapshot-1", assetID: 7, symbol: "BTC", price: 1 };
  const transaction = { id: 9, uuid: "snapshot-1", assetID: 7, symbol: "BTC" };
  vi.mocked(getDatabase).mockResolvedValue({
    select: async (sql: string) => sql.includes("assets_v2") ? [asset] :
      sql.includes("asset_prices") ? [price] : [transaction],
  } as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([asset] as never);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mockResolvedValue([transaction] as never);
  const undo = await queryRestoreHistoricalData("snapshot-1");
  await deleteHistoricalDataByUUID("snapshot-1");
  await restoreHistoricalData(undo);
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ["delete_sync_snapshot", { uuid: "snapshot-1" }],
    ["import_sync_snapshot", { snapshot: {
      uuid: "snapshot-1", assets: [asset], prices: [price], transactions: [transaction],
    } }],
  ]);
});

it("restores transactions whose asset is missing from a deleted snapshot", async () => {
  const asset = { id: 7, uuid: "snapshot-1", symbol: "BTC" };
  const valid = { id: 9, uuid: "snapshot-1", assetID: 7, symbol: "BTC" };
  const orphan = { id: 10, uuid: "snapshot-1", assetID: 99, symbol: "ETH" };
  vi.mocked(getDatabase).mockResolvedValue({
    select: async (sql: string) => sql.includes("assets_v2") ? [asset] :
      sql.includes("asset_prices") ? [] : [valid, orphan],
  } as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([asset] as never);
  vi.mocked(TRANSACTION_HANDLER.listTransactionsByUUIDs).mockResolvedValue([valid, orphan] as never);
  const undo = await queryRestoreHistoricalData("snapshot-1");
  await restoreHistoricalData(undo);
  expect(vi.mocked(invoke)).toHaveBeenCalledWith("import_sync_snapshot", {
    snapshot: { uuid: "snapshot-1", assets: [asset], prices: [], transactions: [valid] },
  });
  expect(vi.mocked(TRANSACTION_HANDLER.saveTransactions)).toHaveBeenCalledWith([orphan]);
});
