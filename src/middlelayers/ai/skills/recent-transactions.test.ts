import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./recent-transactions";
import { TRANSACTION_HANDLER } from "../../entities/transactions";
import type { AssetType } from "../../datafetch/types";
import type { TransactionType } from "../../types";

vi.mock("../../entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    listTransactions: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

function makeTx(over: Partial<any> = {}) {
  return {
    id: 1,
    assetID: 1,
    uuid: "u",
    assetType: "crypto" as AssetType,
    symbol: "BTC",
    wallet: "w",
    amount: 1,
    price: 100,
    txnType: "buy" as TransactionType,
    txnCreatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recent_transactions skill", () => {
  it("returns empty when nothing matches", async () => {
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([]);
    const result = await skill.run({}, { baseCurrency });
    expect((result.data as any).empty).toBe(true);
  });

  it("sorts by date desc and respects the limit", async () => {
    const txs = [
      makeTx({ id: 1, txnCreatedAt: "2026-01-01T00:00:00.000Z" }),
      makeTx({ id: 2, txnCreatedAt: "2026-02-01T00:00:00.000Z" }),
      makeTx({ id: 3, txnCreatedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue(txs);
    const result = await skill.run({ limit: 2 }, { baseCurrency });
    const data = result.data as any;
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[0].id).toBe(3);
  });

  it("filters by symbol and assetType", async () => {
    const txs = [
      makeTx({ id: 1, symbol: "BTC" }),
      makeTx({ id: 2, symbol: "ETH" }),
      makeTx({ id: 3, symbol: "BTC", assetType: "stock" }),
    ];
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue(txs);
    const result = await skill.run(
      { symbol: "btc", assetType: "crypto" },
      { baseCurrency },
    );
    const data = result.data as any;
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].symbol).toBe("BTC");
  });

  it("computes totals by transaction type", async () => {
    const txs = [
      makeTx({ id: 1, txnType: "buy", amount: 2, price: 100 }),
      makeTx({ id: 2, txnType: "sell", amount: 1, price: 150 }),
      makeTx({ id: 3, txnType: "deposit", amount: 5, price: 10 }),
      makeTx({ id: 4, txnType: "withdraw", amount: 1, price: 200 }),
    ];
    vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue(txs);
    const result = await skill.run({}, { baseCurrency });
    const data = result.data as any;
    expect(data.totals.buy).toBe(200);
    expect(data.totals.sell).toBe(150);
    expect(data.totals.deposit).toBe(50);
    expect(data.totals.withdraw).toBe(200);
  });
});
