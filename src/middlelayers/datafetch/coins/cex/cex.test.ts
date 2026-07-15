import { describe, expect, it, vi } from "vitest";
import { CexAnalyzer, filterCoinsInPortfolio } from "./cex";

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
      }),
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
        symbol: "BTC",
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
});
