import { beforeEach, describe, expect, it, vi } from "vitest";
import { setBaseCurrency } from "../pi-agent";
import skill from "./compare-snapshots";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: { listTotalValueRecords: vi.fn(), listAssetsByUUIDs: vi.fn() },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => { vi.clearAllMocks(); setBaseCurrency(baseCurrency); });

describe("compare_snapshots skill", () => {
  it("returns empty when there are no snapshots", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.execute("test", { left: { uuid: "a" }, right: { uuid: "b" } }, undefined, undefined, {} as any);
    expect((result.details.data as any).empty).toBe(true);
  });

  it("resolves snapshots by date and reports deltas", async () => {
    const totals = [
      { uuid: "a", createdAt: new Date("2026-01-01T00:00:00Z"), totalValue: 1000 },
      { uuid: "b", createdAt: new Date("2026-02-01T00:00:00Z"), totalValue: 1500 },
    ];
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(totals as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockImplementation(async (uuids) => {
      if (uuids[0] === "a") return [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 600, price: 600 },
        { id: 2, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 4, value: 400, price: 100 },
      ] as any;
      return [
        { id: 3, uuid: "b", createdAt: "2026-02-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 900, price: 900 },
        { id: 4, uuid: "b", createdAt: "2026-02-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 4, value: 600, price: 150 },
      ] as any;
    });
    const result = await skill.execute("test", { left: { date: "2026-01-01T00:00:00Z" }, right: { date: "2026-02-01T00:00:00Z" } }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.totalDeltaUsd).toBe(500);
    expect(data.totalDeltaPct).toBe(50);
    expect(data.movers).toHaveLength(2);
    expect(data.movers[0].symbol).toBe("BTC");
    expect(result.details.chart?.type).toBe("bar");
  });

  it("detects new and removed positions", async () => {
    const totals = [
      { uuid: "a", createdAt: new Date("2026-01-01T00:00:00Z"), totalValue: 1000 },
      { uuid: "b", createdAt: new Date("2026-02-01T00:00:00Z"), totalValue: 1200 },
    ];
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue(totals as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockImplementation(async (uuids) => {
      if (uuids[0] === "a") return [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
      ] as any;
      return [
        { id: 2, uuid: "b", createdAt: "2026-02-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 700, price: 700 },
        { id: 3, uuid: "b", createdAt: "2026-02-01T00:00:00.000Z", assetType: "crypto", symbol: "SOL", amount: 50, value: 500, price: 10 },
      ] as any;
    });
    const result = await skill.execute("test", { left: { uuid: "a" }, right: { uuid: "b" } }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.newPositions).toHaveLength(1);
    expect(data.newPositions[0].symbol).toBe("SOL");
    expect(data.removedPositions).toHaveLength(0);
  });
});
