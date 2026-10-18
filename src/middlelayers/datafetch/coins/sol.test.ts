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

const SOL_ADDRESS = "1".repeat(44);

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
          { id: "TokenMint", name: "Token", symbol: "TOK", usdPrice: 4 },
          {
            id: "UnderlyingMint",
            name: "Underlying",
            symbol: "UNDER",
            usdPrice: 1.5,
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
      if (url.includes("/search?")) return [{ id: "PricedMint", name: "Priced", symbol: "GOOD", usdPrice: 4 }];
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
  });

  it("keeps an unpriced listed mint for snapshot continuity", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/holdings/")) return { uiAmount: 1, tokens: { UnpricedMint: [{ uiAmount: 3 }] } };
      if (url.includes("/search?")) return [{ id: "UnpricedMint", name: "Unpriced", symbol: "DUST", usdPrice: 0 }];
      return [];
    });
    const analyzer = new SOLAnalyzer({ sol: { addresses: [SOL_ADDRESS] } });
    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();
    await expect(portfolio).resolves.toEqual([
      { symbol: "DUST", assetType: "crypto", amount: 3, price: { value: 0, base: "usd" },
        wallet: SOL_ADDRESS, chain: "sol" },
      { symbol: "SOL", assetType: "crypto", amount: 1, wallet: SOL_ADDRESS, chain: "sol" },
    ]);
    expect(takeSourceFailure(analyzer)).toBeUndefined();
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
