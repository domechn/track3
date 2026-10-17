import { beforeEach, describe, expect, it, vi } from "vitest";
import statusSkill from "./rebalance-status";
import suggestSkill from "./rebalance-suggest";
import { getRebalanceProfile, loadRebalanceHoldings } from "../../rebalance";

vi.mock("../../rebalance", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../rebalance")>(),
  getRebalanceProfile: vi.fn(),
  loadRebalanceHoldings: vi.fn(),
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRebalanceProfile).mockResolvedValue({
    targets: [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
    ],
    tolerancePercent: 0,
  });
  vi.mocked(loadRebalanceHoldings).mockResolvedValue({
    holdings: [
      { symbol: "BTC", assetType: "crypto", amount: 2, value: 60, price: 30 },
      { symbol: "ETH", assetType: "crypto", amount: 1, value: 20, price: 20 },
    ],
    stablecoinSymbols: [],
  });
});

describe("rebalance assistant skills", () => {
  it("reports target deviations from saved targets", async () => {
    const result = await statusSkill.run({}, { baseCurrency });
    expect(result.data).toMatchObject({
      baseCurrency: "USD",
      currentTotal: 80,
      rows: [
        { symbol: "BTC", currentPercent: 75, targetPercent: 50, deviationPercent: 25 },
        { symbol: "ETH", currentPercent: 25, targetPercent: 50, deviationPercent: -25 },
      ],
    });
  });

  it("returns read-only buys-only suggestions with exact cash flow", async () => {
    const result = await suggestSkill.run(
      { mode: "buys", injectedCash: 20 }, { baseCurrency },
    );
    expect(result.data).toMatchObject({
      baseCurrency: "USD", injectedCash: 20,
      rows: [
        { symbol: "BTC", tradeValue: 0 },
        { symbol: "ETH", tradeValue: 20, tradeQuantity: 1 },
      ],
    });
  });

  it("reports when targets have not been saved", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue(undefined);
    expect((await suggestSkill.run({}, { baseCurrency })).data).toEqual({ empty: true, reason: "no-targets" });
  });
});
