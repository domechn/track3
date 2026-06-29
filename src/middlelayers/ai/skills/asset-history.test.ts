import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./asset-history";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listAssetsBySymbolByDateRange: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("asset_history skill", () => {
  it("rejects when symbol is missing", async () => {
    const result = await skill.run({}, { baseCurrency });
    expect((result.data as any).error).toBe("symbol is required");
  });

  it("returns empty when no history", async () => {
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([]);
    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    expect((result.data as any).empty).toBe(true);
  });

  it("returns series and PnL for a symbol", async () => {
    const groups = [
      [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
        { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1100, price: 1100 },
        { id: 3, uuid: "a", createdAt: "2026-01-03T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1200, price: 1200 },
      ],
    ];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);

    const result = await skill.run({ symbol: "btc" }, { baseCurrency });
    const data = result.data as any;
    expect(data.points).toHaveLength(3);
    expect(data.pnl.absoluteUsd).toBe(200);
    expect(data.pnl.percentage).toBe(20);
    expect(data.firstAmount).toBe(1);
    expect(data.lastAmount).toBe(1);
  });

  it("converts values into the base currency", async () => {
    const groups = [
      [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 1, value: 100, price: 100 },
        { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 1, value: 200, price: 200 },
      ],
    ];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);
    const result = await skill.run(
      { symbol: "ETH" },
      { baseCurrency: { ...baseCurrency, currency: "EUR", rate: 0.5 } },
    );
    const data = result.data as any;
    expect(data.points[1].value).toBe(100);
  });
  it("filters by assetType stock", async () => {
    const groups = [
      [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "stock", symbol: "AAPL", amount: 10, value: 1500, price: 150 },
        { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "stock", symbol: "AAPL", amount: 10, value: 1600, price: 160 },
      ],
    ];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);

    const result = await skill.run({ symbol: "AAPL", assetType: "stock" }, { baseCurrency });
    const data = result.data as any;
    expect(data.assetType).toBe("stock");
    expect(data.points).toHaveLength(2);
    expect(data.points[0].valueUsd).toBe(1500);
    expect(data.pnl.percentage).toBeCloseTo(6.67, 1);
  });

  it("defaults to crypto when assetType is omitted", async () => {
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([]);
    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    expect((result.data as any).assetType).toBe("crypto");
  });

  it("handles equal first/last value gracefully (zero PnL)", async () => {
    const groups = [
      [
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "USDC", amount: 100, value: 100, price: 1 },
        { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "USDC", amount: 100, value: 100, price: 1 },
      ],
    ];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);

    const result = await skill.run({ symbol: "USDC" }, { baseCurrency });
    const data = result.data as any;
    expect(data.pnl.absoluteUsd).toBe(0);
    expect(data.pnl.percentage).toBe(0);
  });

  it("correctly sorts data chronologically", async () => {
    const groups = [
      [
        { id: 3, uuid: "a", createdAt: "2026-01-03T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1300, price: 1300 },
        { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
        { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1100, price: 1100 },
      ],
    ];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);

    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    const data = result.data as any;
    expect(data.points[0].valueUsd).toBe(1000);
    expect(data.points[1].valueUsd).toBe(1100);
    expect(data.points[2].valueUsd).toBe(1300);
  });

});
