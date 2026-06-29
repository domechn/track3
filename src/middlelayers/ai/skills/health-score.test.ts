import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./health-score";
import { ASSET_HANDLER } from "../../entities/assets";
import { TRANSACTION_HANDLER } from "../../entities/transactions";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
    listAssetsByUUIDs: vi.fn(),
  },
}));

vi.mock("../../entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactionsByDateRange: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("health_score skill", () => {
  it("returns empty when no snapshots exist", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([]);
    const result = await skill.run({}, { baseCurrency });
    expect((result.data as any).empty).toBe(true);
    expect(result.chart).toBeUndefined();
  });

  it("computes HHI, top-3 weight, and emits a radar chart", async () => {
    const latest = {
      uuid: "u",
      createdAt: new Date("2026-06-01T00:00:00Z"),
      totalValue: 1000,
    };
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([latest] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "u", createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 0.5, value: 500, price: 1000 },
      { id: 2, uuid: "u", createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 2, value: 300, price: 150 },
      { id: 3, uuid: "u", createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "SOL", amount: 100, value: 200, price: 2 },
    ] as any);
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue([]);

    const result = await skill.run({}, { baseCurrency });
    const data = result.data as any;
    // HHI: 0.5^2 + 0.3^2 + 0.2^2 = 0.38; diversification = 1 - 0.38 = 0.62
    expect(data.factors.diversification).toBeCloseTo(0.62, 2);
    // Top-3 = 100% of total -> concentration = 0
    expect(data.factors.concentration).toBe(0);
    expect(data.overall).toBeGreaterThan(0);
    expect(result.chart?.type).toBe("radar");
    expect(result.chart?.labels).toHaveLength(5);
  });

  it("rewards cash positions and recent activity", async () => {
    const latest = {
      uuid: "u",
      createdAt: new Date("2026-06-01T00:00:00Z"),
      totalValue: 1000,
    };
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([latest] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "u", createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "USD", amount: 500, value: 500, price: 1 },
      { id: 2, uuid: "u", createdAt: "2026-06-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 0.5, value: 500, price: 1000 },
    ] as any);
    const txs = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      assetID: 1,
      uuid: "t",
      assetType: "crypto",
      symbol: "BTC",
      wallet: "w",
      amount: 0.01,
      price: 100,
      txnType: "buy",
      txnCreatedAt: new Date(`2026-05-${String(i + 1).padStart(2, "0")}T00:00:00Z`).toISOString(),
    }));
    vi.mocked(TRANSACTION_HANDLER.listTransactionsByDateRange).mockResolvedValue(txs as any);

    const result = await skill.run({}, { baseCurrency });
    const data = result.data as any;
    // 50% cash ratio
    expect(data.factors.cashRatio).toBeCloseTo(0.5, 2);
    // 12 transactions => activity saturates at 1
    expect(data.factors.activity).toBe(1);
  });
});
