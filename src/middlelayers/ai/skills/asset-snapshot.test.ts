import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./asset-snapshot";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
    listAssetsByUUIDs: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("asset_snapshot skill", () => {
  it("lists assets largest-first regardless of DB insertion order", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid: "s", createdAt: "2026-07-20T00:00:00.000Z", totalValue: 1 },
    ] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "s", createdAt: "2026-07-20T00:00:00.000Z", assetType: "crypto", symbol: "FF", amount: 1, value: 254, price: 254 },
      { id: 2, uuid: "s", createdAt: "2026-07-20T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 166069, price: 166069, wallet: "a" },
      { id: 3, uuid: "s", createdAt: "2026-07-20T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1, price: 1, wallet: "b" },
      { id: 4, uuid: "s", createdAt: "2026-07-20T00:00:00.000Z", assetType: "stock", symbol: "SCHD", amount: 1, value: 93369, price: 93369 },
    ] as any);

    const result = await skill.run({}, { baseCurrency });
    const symbols = (result.data as any).assets.map((a: any) => a.symbol);
    expect(symbols).toEqual(["BTC", "SCHD", "FF"]);
    expect((result.data as any).assets[0].valueUsd).toBe(166070);
  });
});
