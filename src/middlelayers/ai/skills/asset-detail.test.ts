import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./asset-detail";
import { ASSET_HANDLER } from "../../entities/assets";
import { WalletAnalyzer } from "../../wallet";

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listTotalValueRecords: vi.fn(),
    listAssetsByUUIDs: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

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

  it("reads the current alias for Assistant detail while keeping the snapshot wallet ID", async () => {
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid: "snapshot", createdAt: "2026-09-01T00:00:00.000Z", totalValue: 200 },
    ] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "snapshot", createdAt: "2026-09-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 200, price: 200, wallet: "stable-wallet-id" },
    ] as any);
    const lookup = vi.mocked(WalletAnalyzer.prototype.listWalletAliases);
    lookup.mockResolvedValueOnce({ "stable-wallet-id": { wallet: "address", alias: "Cold", type: "BTC" } });
    lookup.mockResolvedValueOnce({ "stable-wallet-id": { wallet: "address", alias: "Vault", type: "BTC" } });

    const before = (await skill.run({ symbol: "BTC" }, { baseCurrency })).data as any;
    const after = (await skill.run({ symbol: "BTC" }, { baseCurrency })).data as any;
    expect(before.wallets[0]).toMatchObject({ wallet: "stable-wallet-id", sourceName: "Cold" });
    expect(after.wallets[0]).toMatchObject({ wallet: "stable-wallet-id", sourceName: "Vault" });
    expect(ASSET_HANDLER.listAssetsByUUIDs).toHaveBeenCalledTimes(2);
  });

  it("does not send an unaliased wallet address in Assistant asset detail", async () => {
    const address = "bc1q9zp6g2zaj0sfxgzd7zdglj28hpgaffn8a4q9sd";
    vi.mocked(ASSET_HANDLER.listTotalValueRecords).mockResolvedValue([
      { uuid: "snapshot", createdAt: "2026-09-01T00:00:00.000Z", totalValue: 200 },
    ] as any);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
      { id: 1, uuid: "snapshot", createdAt: "2026-09-01T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 200, price: 200, wallet: "stable-wallet-id" },
    ] as any);
    vi.mocked(WalletAnalyzer.prototype.listWalletAliases).mockResolvedValue({
      "stable-wallet-id": { wallet: address, alias: address, type: "BTC" },
    });

    const result = await skill.run({ symbol: "BTC" }, { baseCurrency });
    expect(result.data).toMatchObject({ wallets: [{ wallet: "stable-wallet-id" }] });
    expect(JSON.stringify(result)).not.toContain(address);
    expect((result.data as any).wallets[0]).not.toHaveProperty("sourceName");
  });
});
