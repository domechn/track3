import { afterEach, expect, it, vi } from "vitest";
import skill from "./transaction-list";
import { getTransactions } from "./functions/transactions";
import { WalletAnalyzer } from "../../wallet";

vi.mock("./functions/transactions", () => ({ getTransactions: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

it("shows the current source alias in Assistant transactions without changing wallet identity", async () => {
  vi.mocked(getTransactions).mockResolvedValue([{
    id: 7, symbol: "BTC", assetType: "crypto", wallet: "stable-wallet-id",
    txnType: "buy", amount: 1, price: 100, txnCreatedAt: "2026-09-01T00:00:00.000Z",
  }] as never);
  const lookup = vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases");
  lookup.mockResolvedValueOnce({ "stable-wallet-id": { wallet: "address", alias: "Cold", type: "BTC" } });
  lookup.mockResolvedValueOnce({ "stable-wallet-id": { wallet: "address", alias: "Vault", type: "BTC" } });
  const context = { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } };

  const before = (await skill.run({}, context)).data as any;
  const after = (await skill.run({}, context)).data as any;
  expect(before.transactions[0]).toMatchObject({ wallet: "stable-wallet-id", sourceName: "Cold" });
  expect(after.transactions[0]).toMatchObject({ wallet: "stable-wallet-id", sourceName: "Vault" });
  expect(getTransactions).toHaveBeenCalledTimes(2);
});

it("does not send an unaliased wallet address in Assistant transactions", async () => {
  const address = "0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c";
  vi.mocked(getTransactions).mockResolvedValue([{
    id: 8, symbol: "ETH", assetType: "crypto", wallet: "stable-wallet-id",
    txnType: "buy", amount: 1, price: 100, txnCreatedAt: "2026-09-01T00:00:00.000Z",
  }] as never);
  vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue({
    "stable-wallet-id": { wallet: address, alias: address, type: "ERC20" },
  });

  const result = await skill.run({}, { baseCurrency: { currency: "USD", rate: 1, alias: "USD", symbol: "$" } });
  expect(result.data).toMatchObject({ transactions: [{ wallet: "stable-wallet-id" }] });
  expect(JSON.stringify(result)).not.toContain(address);
  expect((result.data as any).transactions[0]).not.toHaveProperty("sourceName");
});
