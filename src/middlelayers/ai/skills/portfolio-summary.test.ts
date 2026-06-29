import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./portfolio-summary";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
    listAssetsByUUIDs: vi.fn(),
  },
}));

const baseCurrency = {
  currency: "USD",
  rate: 1,
  alias: "USD",
  symbol: "$",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("portfolio_summary skill", () => {
  it("returns empty when there are no snapshots", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.run({}, { baseCurrency });
    expect(result.data).toMatchObject({ empty: true });
    expect(result.chart).toBeUndefined();
  });

  it("returns total value, top holdings, and a chart", async () => {
    const uuid = "uuid-1";
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid, createdAt: new Date("2026-06-01T00:00:00Z"), totalValue: 1000 },
    ]);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 0.5, value: 600, price: 1200 },
      { id: 2, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 4, value: 400, price: 100 },
    ]);

    const result = await skill.run({ topN: 5 }, { baseCurrency });
    const data = result.data as any;
    expect(data.totalValueUsd).toBe(1000);
    expect(data.totalValue).toBe(1000);
    expect(data.topHoldings).toHaveLength(2);
    expect(data.topHoldings[0]).toMatchObject({ symbol: "BTC", valueUsd: 600, percentage: 60 });
    expect(data.topHoldings[1]).toMatchObject({ symbol: "ETH", valueUsd: 400, percentage: 40 });
    expect(result.chart?.type).toBe("doughnut");
    expect(result.chart?.labels).toContain("60.00% BTC");
  });

  it("aggregates the same symbol across multiple wallets", async () => {
    const uuid = "uuid-2";
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid, createdAt: new Date("2026-06-01T00:00:00Z"), totalValue: 900 },
    ]);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 0.1, value: 120, price: 1200, wallet: "w1" },
      { id: 2, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 0.2, value: 240, price: 1200, wallet: "w2" },
      { id: 3, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 5, value: 540, price: 108 },
    ]);
    const result = await skill.run({}, { baseCurrency });
    const data = result.data as any;
    expect(data.assetCount).toBe(2);
    const btc = data.topHoldings.find((h: any) => h.symbol === "BTC");
    expect(btc.valueUsd).toBe(360);
  });

  it("converts totals into the base currency", async () => {
    const uuid = "uuid-3";
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid, createdAt: new Date("2026-06-01T00:00:00Z"), totalValue: 1000 },
    ]);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid, createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
    ]);
    const result = await skill.run({}, { baseCurrency: { ...baseCurrency, currency: "EUR", rate: 0.9 } });
    const data = result.data as any;
    expect(data.totalValue).toBe(900);
    expect(data.topHoldings[0].valueInBase).toBe(900);
  });
});
