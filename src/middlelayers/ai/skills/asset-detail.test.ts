import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./asset-detail";
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

describe("asset_detail skill", () => {
  it("only sums records from the latest snapshot, not across history", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid: "old", createdAt: "2026-07-01T00:00:00.000Z", totalValue: 100 },
      { uuid: "new", createdAt: "2026-09-01T00:00:00.000Z", totalValue: 200 },
    ] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "new", createdAt: "2026-09-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 2, value: 120000, price: 60000, wallet: "w1" },
      { id: 2, uuid: "new", createdAt: "2026-09-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 2, value: 120000, price: 60000, wallet: "w2" },
      { id: 3, uuid: "new", createdAt: "2026-09-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 1, value: 3000, price: 3000, wallet: "w1" },
    ] as any);

    const result = await skill.run({ symbol: "btc" }, { baseCurrency });
    const data = result.data as any;

    expect(ASSET_HANDLER.listAssetsByUUIDs).toHaveBeenCalledWith(["new"]);
    expect(data.totalAmount).toBe(4);
    expect(data.totalValueUsd).toBe(240000);
    expect(data.walletCount).toBe(2);
    expect(data.asOf).toBe("2026-09-01T00:00:00.000Z");
  });

  it("returns empty when the symbol is not in the latest snapshot", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid: "new", createdAt: "2026-09-01T00:00:00.000Z", totalValue: 200 },
    ] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([] as any);

    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    expect((result.data as any).empty).toBe(true);
  });
});
