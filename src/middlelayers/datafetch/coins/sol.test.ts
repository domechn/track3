import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { SOLAnalyzer } from "./sol";
import { takeOptionalSourceFailures, takeSourceFailure } from "../utils/source-failure";

vi.mock("../utils/http", async () => {
  const actual = await vi.importActual<typeof import("../utils/http")>(
    "../utils/http",
  );
  return {
    ...actual,
    sendHttpRequest: vi.fn(),
  };
});

const SOL_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

beforeEach(() => {
  vi.clearAllMocks();
  getMemoryCacheInstance("data-fetch").clearCache();
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SOLAnalyzer", () => {
  it("validates Solana addresses", async () => {
    await expect(
      new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } }).verifyConfigs(),
    ).resolves.toBe(true);
    await expect(
      new SOLAnalyzer({ sol: { addresses: ["0OIl"] } }).verifyConfigs(),
    ).resolves.toBe(false);
  });

  it("accepts 32, 43 and 44 character base58 public keys and rejects malformed keys", async () => {
    await expect(new SOLAnalyzer({ sol: { addresses: [
      "11111111111111111111111111111111",
      "So11111111111111111111111111111111111111112",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ] } }).verifyConfigs()).resolves.toBe(true);
    await expect(new SOLAnalyzer({ sol: { addresses: ["0".repeat(43), "1".repeat(44)] } }).verifyConfigs())
      .resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new SOLAnalyzer({ sol: { addresses: [] } });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("maps holdings and converts earn receipt units to underlying decimals", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith(`/ultra/v1/holdings/${SOL_ADDRESS}`)) {
        return {
          uiAmount: 2,
          tokens: {
            TokenMint: [{ uiAmount: 3 }],
            ReceiptMint: [{ uiAmount: 5 }],
            ZeroMint: [{ uiAmount: 0 }],
          },
        };
      }
      if (url.endsWith(`/lend/v1/earn/positions?users=${SOL_ADDRESS}`)) {
        return [
          {
            token: {
              address: "ReceiptMint",
              asset: {
                address: "UnderlyingMint",
                symbol: "UNDER",
                decimals: 6,
              },
            },
            underlyingAssets: "2500000",
          },
        ];
      }
      if (
        url.endsWith(
          "/ultra/v1/search?query=TokenMint,UnderlyingMint",
        )
      ) {
        return [
          { id: "TokenMint", name: "Token", symbol: "TOK", usdPrice: 4, isVerified: true },
          {
            id: "UnderlyingMint",
            name: "Underlying",
            symbol: "UNDER",
            usdPrice: 1.5,
            isVerified: true,
          },
        ];
      }
      throw new Error(`Unexpected Jupiter URL: ${url}`);
    });
    const analyzer = new SOLAnalyzer({
      sol: { addresses: [SOL_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "TOK",
        assetType: "crypto",
        amount: 3,
        price: { value: 4, base: "usd" },
        wallet: SOL_ADDRESS,
        chain: "sol",
      },
      {
        symbol: "UNDER",
        assetType: "crypto",
        amount: 2.5,
        price: { value: 1.5, base: "usd" },
        wallet: SOL_ADDRESS,
        chain: "sol",
      },
      {
        symbol: "SOL",
        assetType: "crypto",
        amount: 2,
        wallet: SOL_ADDRESS,
        chain: "sol",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `https://lite-api.jup.ag/ultra/v1/search?query=TokenMint,UnderlyingMint`,
      5000,
    );
  });

  it("skips an unknown mint while retaining priced holdings", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 1, tokens: { MissingMint: [{ uiAmount: 3 }], PricedMint: [{ uiAmount: 2 }] } };
      if (url.includes("/search?")) return [{ id: "PricedMint", name: "Priced", symbol: "GOOD", usdPrice: 4, isVerified: true }];
      return [];
    });
    const analyzer = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();
    await expect(portfolio).resolves.toEqual([
      { symbol: "GOOD", assetType: "crypto", amount: 2, price: { value: 4, base: "usd" }, wallet: SOL_ADDRESS, chain: "sol" },
      { symbol: "SOL", assetType: "crypto", amount: 1, wallet: SOL_ADDRESS, chain: "sol" },
    ]);
    expect(takeSourceFailure(analyzer)).toBeUndefined();
    expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Some assets"] });
  });

  it("keeps only a verified priced mint when a spoofed mint copies its symbol", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 0, tokens: {
        RealMint: [{ uiAmount: 100 }], SpoofMint: [{ uiAmount: 1_000_000 }],
      } };
      if (url.includes("/search?")) return [
        { id: "RealMint", name: "USD Coin", symbol: "USDC", usdPrice: 1, isVerified: true },
        { id: "SpoofMint", name: "Fake USD Coin", symbol: "USDC", usdPrice: 1, isVerified: false },
      ];
      return [];
    });
    const analyzer = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } });
    const pending = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual([
      { symbol: "USDC", assetType: "crypto", amount: 100, price: { value: 1, base: "usd" },
        wallet: SOL_ADDRESS, chain: "sol" },
    ]);
    expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Some assets"] });
  });

  it("does not merge even verified mints with the same symbol into one amount", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 0, tokens: {
        FirstMint: [{ uiAmount: 2 }], SecondMint: [{ uiAmount: 3 }],
      } };
      if (url.includes("/search?")) return [
        { id: "FirstMint", name: "First", symbol: "SAME", usdPrice: 4, isVerified: true },
        { id: "SecondMint", name: "Second", symbol: "same", usdPrice: 7, isVerified: true },
      ];
      return [];
    });
    const analyzer = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } });
    const pending = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();
    const coins = await pending;
    expect(coins).toHaveLength(1);
    expect(coins[0]).toMatchObject({ symbol: "SAME", amount: 2, price: { value: 4 } });
    expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Some assets"] });
  });

  it("sums every token account for one mint", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 0, tokens: {
        SameMint: [{ uiAmount: 2 }, { uiAmount: 3 }],
      } };
      if (url.includes("/search?")) return [
        { id: "SameMint", name: "Same", symbol: "SAME", usdPrice: 4, isVerified: true },
      ];
      return [];
    });
    const pending = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } }).loadPortfolio();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual([
      { symbol: "SAME", assetType: "crypto", amount: 5, price: { value: 4, base: "usd" },
        wallet: SOL_ADDRESS, chain: "sol" },
    ]);
  });

  it("skips an unpriced listed mint and reports a partial source", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 1, tokens: { UnpricedMint: [{ uiAmount: 3 }] } };
      if (url.includes("/search?")) return [{ id: "UnpricedMint", name: "Unpriced", symbol: "DUST", usdPrice: 0, isVerified: true }];
      return [];
    });
    const analyzer = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } });
    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();
    await expect(portfolio).resolves.toEqual([
      { symbol: "SOL", assetType: "crypto", amount: 1, wallet: SOL_ADDRESS, chain: "sol" },
    ]);
    expect(takeSourceFailure(analyzer)).toBeUndefined();
    expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Some assets"] });
  });

  it("keeps core holdings when the optional earn endpoint fails", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) {
        return { uiAmount: 1, tokens: {} };
      }
      throw new Error("earn endpoint unavailable");
    });
    const analyzer = new SOLAnalyzer({
      sol: { addresses: [SOL_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "SOL",
        assetType: "crypto",
        amount: 1,
        wallet: SOL_ADDRESS,
        chain: "sol",
      },
    ]);
    expect(takeOptionalSourceFailures(analyzer)).toEqual({
      category: "network", endpoints: ["Solana Earn"],
    });
  });

  it("filters a zero native balance", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) {
        return { uiAmount: 0, tokens: {} };
      }
      return [];
    });
    const analyzer = new SOLAnalyzer({
      sol: { addresses: [SOL_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([]);
  });

  it("retries holdings request when Jupiter returns 429", async () => {
    let holdingsAttempts = 0;

    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith(`/ultra/v1/holdings/${SOL_ADDRESS}`)) {
        holdingsAttempts += 1;
        if (holdingsAttempts < 3) {
          throw new Error(
            `Request failed (GET https://lite-api.jup.ag/ultra/v1/holdings/${SOL_ADDRESS}) with status 429`,
          );
        }
        return { uiAmount: 1, tokens: {} };
      }
      return [];
    });

    const analyzer = new SOLAnalyzer({
      sol: { addresses: [SOL_ADDRESS] },
    });

    const portfolioPromise = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolioPromise).resolves.toEqual([
      {
        symbol: "SOL",
        assetType: "crypto",
        amount: 1,
        wallet: SOL_ADDRESS,
        chain: "sol",
      },
    ]);
    expect(holdingsAttempts).toBe(3);
  });
});
