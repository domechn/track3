import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./transaction-stats";
import { TRANSACTION_HANDLER } from "../../entities/transactions";

vi.mock("../../entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactions: vi.fn(),
    listTransactionsByDateRange: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transaction_stats skill", () => {
  it("reports total amount and weighted average price per type", async () => {
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
      { id: 1, uuid: "a", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 1, price: 100, txnCreatedAt: "2026-01-01T00:00:00.000Z", createdAt: "" },
      { id: 2, uuid: "b", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 3, price: 200, txnCreatedAt: "2026-01-02T00:00:00.000Z", createdAt: "" },
      { id: 3, uuid: "c", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "sell", amount: 1, price: 300, txnCreatedAt: "2026-01-03T00:00:00.000Z", createdAt: "" },
    ] as any);

    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    const data = result.data as any;
    expect(data.stats.buy.count).toBe(2);
    expect(data.stats.buy.amount).toBe(4);
    expect(data.stats.buy.volumeUsd).toBe(700);
    expect(data.stats.buy.averagePriceUsd).toBe(175);
    expect(data.stats.sell.averagePriceUsd).toBe(300);
    expect(data.stats.deposit.averagePriceUsd).toBe(0);
    expect(result.text).toContain("175");
  });

  it("aggregates every matching row, not just the newest 1000", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: i, uuid: `u${i}`, assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy",
      // oldest row (i = 0) is a huge cheap buy that dominates the average
      amount: i === 0 ? 1000 : 1,
      price: i === 0 ? 1 : 100,
      txnCreatedAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
      createdAt: "",
    }));
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue(rows as any);

    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    const data = result.data as any;
    expect(data.totalTransactions).toBe(1001);
    expect(data.stats.buy.averagePriceUsd).toBeCloseTo(50.5);
  });
});
