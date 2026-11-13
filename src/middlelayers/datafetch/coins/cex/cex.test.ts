import { describe, expect, it, vi } from "vitest";
import { CexAnalyzer, filterCoinsInPortfolio } from "./cex";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { BinanceExchange } from "./binance";

describe("CexAnalyzer", () => {
  it("filters non-positive and liquid-staking rows while normalizing symbols", () => {
    expect(
      filterCoinsInPortfolio("exchange-key", {
        btc: 1,
        ETH: 0,
        SOL: -1,
        LDBTC: 3,
        BETH: 2,
        ETH2: 4,
        BGBTC: 5,
      }, "Binance"),
    ).toEqual([
      {
        symbol: "BTC",
        assetType: "crypto",
        amount: 1,
        wallet: "exchange-key",
      },
      {
        symbol: "ETH",
        assetType: "crypto",
        amount: 2,
        wallet: "exchange-key",
      },
      {
        symbol: "ETH",
        assetType: "crypto",
        amount: 4,
        wallet: "exchange-key",
      },
      {
        symbol: "BGBTC",
        assetType: "crypto",
        amount: 5,
        wallet: "exchange-key",
      },
    ]);
  });

  it("rejects adapters whose required secondary credential is missing", () => {
    expect(
      () =>
        new CexAnalyzer({
          exchanges: [
            {
              name: "okx",
              initParams: { apiKey: "key", secret: "secret" },
            },
          ],
        }),
    ).toThrow("okex password is required");

    expect(
      () =>
        new CexAnalyzer({
          exchanges: [
            {
              name: "bitget",
              initParams: { apiKey: "key", secret: "secret" },
            },
          ],
        }),
    ).toThrow("bitget passphrase is required");
  });

  it("skips inactive and unsupported exchanges without retaining a broken adapter", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const analyzer = new CexAnalyzer({
      exchanges: [
        {
          name: "binance",
          initParams: { apiKey: "inactive", secret: "secret" },
          active: false,
        },
        {
          name: "future-exchange",
          initParams: { apiKey: "key", secret: "secret" },
          alias: "unsupported",
        },
      ],
    });

    expect(analyzer.listExchangeIdentities()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown exchange "future-exchange"'),
    );
  });

  it("marks an exchange with omitted net debt partial and does not cache it", async () => {
    const exchange = {
      getIdentity: () => "negative-net-regression",
      fetchTotalBalance: vi.fn().mockResolvedValue({ SOL: 10, USDC: -5000 }),
    };
    const analyzer = new CexAnalyzer({ exchanges: [] });
    await expect(analyzer.fetchTotalBalance(exchange as never)).resolves.toEqual({ SOL: 10, USDC: -5000 });
    expect(filterCoinsInPortfolio("negative-net-regression", { SOL: 10, USDC: -5000 }, "OKX"))
      .toEqual([{ symbol: "SOL", assetType: "crypto", amount: 10, wallet: "negative-net-regression" }]);
    expect(takeOptionalSourceFailures(analyzer)).toEqual({
      category: "other", endpoints: ["Some assets"],
    });
    await analyzer.fetchTotalBalance(exchange as never);
    expect(exchange.fetchTotalBalance).toHaveBeenCalledTimes(2);
  });

  it("loads balances when the optional public ticker request fails", async () => {
    const price = vi.spyOn(BinanceExchange.prototype, "fetchCoinsPrice").mockRejectedValue(new Error("ticker unavailable"));
    const balance = vi.spyOn(BinanceExchange.prototype, "fetchTotalBalance").mockResolvedValue({ BTC: 2 });
    try {
      const analyzer = new CexAnalyzer({ exchanges: [{
        name: "binance", initParams: { apiKey: "ticker-failure", secret: "secret" },
      }] });
      await expect(analyzer.loadPortfolio()).resolves.toEqual([
        { symbol: "BTC", assetType: "crypto", amount: 2, wallet: "binance-ticker-failure", price: undefined },
      ]);
      expect(takeOptionalSourceFailures(analyzer)).toEqual({
        category: "network", endpoints: ["Some assets"],
      });
    } finally {
      price.mockRestore();
      balance.mockRestore();
    }
  });

  it("flags an unauthorized public ticker read without discarding balances", async () => {
    const price = vi.spyOn(BinanceExchange.prototype, "fetchCoinsPrice")
      .mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    const balance = vi.spyOn(BinanceExchange.prototype, "fetchTotalBalance").mockResolvedValue({ BTC: 2 });
    try {
      const analyzer = new CexAnalyzer({ exchanges: [{
        name: "binance", initParams: { apiKey: "ticker-auth-failure", secret: "secret" },
      }] });
      await expect(analyzer.loadPortfolio()).resolves.toHaveLength(1);
      expect(takeOptionalSourceFailures(analyzer)).toEqual({
        category: "auth", endpoints: ["Some assets"],
      });
    } finally {
      price.mockRestore();
      balance.mockRestore();
    }
  });

  it("does not apply Binance or Bitget symbol rules to other exchanges", () => {
    expect(filterCoinsInPortfolio("okx-key", { LDBTC: 1, BETH: 2, ETH2: 3, BGBTC: 4 }, "OKX"))
      .toEqual([
        { symbol: "LDBTC", assetType: "crypto", amount: 1, wallet: "okx-key" },
        { symbol: "BETH", assetType: "crypto", amount: 2, wallet: "okx-key" },
        { symbol: "ETH2", assetType: "crypto", amount: 3, wallet: "okx-key" },
        { symbol: "BGBTC", assetType: "crypto", amount: 4, wallet: "okx-key" },
      ]);
    expect(filterCoinsInPortfolio("bitget-key", { BGBTC: 5 }, "Bitget"))
      .toEqual([{ symbol: "BTC", assetType: "crypto", amount: 5, wallet: "bitget-key" }]);
  });
});
