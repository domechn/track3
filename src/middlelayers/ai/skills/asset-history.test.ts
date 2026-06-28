import { beforeEach, describe, expect, it, vi } from "vitest";
import { setBaseCurrency } from "../pi-agent";
import skill from "./asset-history";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: { listAssetsBySymbolByDateRange: vi.fn() },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => { vi.clearAllMocks(); setBaseCurrency(baseCurrency); });

describe("asset_history skill", () => {
  it("rejects when symbol is missing", async () => {
    const result = await skill.execute("test", {}, undefined, undefined, {} as any);
    expect((result.details.data as any).error).toBe("symbol is required");
  });

  it("returns empty when no history", async () => {
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue([]);
    const result = await skill.execute("test", { symbol: "BTC" }, undefined, undefined, {} as any);
    expect((result.details.data as any).empty).toBe(true);
  });

  it("returns series and PnL for a symbol", async () => {
    const groups = [[
      { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1000, price: 1000 },
      { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1100, price: 1100 },
      { id: 3, uuid: "a", createdAt: "2026-01-03T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1200, price: 1200 },
    ]];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);
    const result = await skill.execute("test", { symbol: "btc" }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.series).toHaveLength(3);
    expect(data.pnl.absoluteUsd).toBe(200);
    expect(data.pnl.percentage).toBe(20);
    expect(data.firstAmount).toBe(1);
    expect(data.lastAmount).toBe(1);
    expect(result.details.chart?.type).toBe("line");
  });

  it("converts values into the base currency", async () => {
    const groups = [[
      { id: 1, uuid: "a", createdAt: "2026-01-01T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 1, value: 100, price: 100 },
      { id: 2, uuid: "a", createdAt: "2026-01-02T00:00:00.000Z", assetType: "crypto", symbol: "ETH", amount: 1, value: 200, price: 200 },
    ]];
    vi.mocked(ASSET_HANDLER.listAssetsBySymbolByDateRange).mockResolvedValue(groups as any);
    setBaseCurrency({ currency: "EUR", rate: 0.5, alias: "EUR", symbol: "€" });
    const result = await skill.execute("test", { symbol: "ETH" }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.series[1].value).toBe(100);
  });
});
