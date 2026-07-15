import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { SUIAnalyzer } from "./sui";

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const SUI_ADDRESS = `0x${"a".repeat(64)}`;

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

describe("SUIAnalyzer", () => {
  it("validates Sui addresses", async () => {
    await expect(
      new SUIAnalyzer({ sui: { addresses: [SUI_ADDRESS] } }).verifyConfigs(),
    ).resolves.toBe(true);
    await expect(
      new SUIAnalyzer({ sui: { addresses: ["0x1234"] } }).verifyConfigs(),
    ).resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new SUIAnalyzer({ sui: { addresses: [] } });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("maps holdings and DeFi positions while filtering spam and zero rows", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith(`/address/${SUI_ADDRESS}/holding`)) {
        return {
          data: [
            {
              contractAddress: "0xsui",
              name: "Sui",
              symbol: "SUI",
              amount: "1.5",
              rate: 2,
              last_24h_price: { price: 2 },
              is_spam: false,
            },
            {
              contractAddress: "0xspam",
              name: "Spam",
              symbol: "SPAM",
              amount: "100",
              rate: 1,
              last_24h_price: { price: 1 },
              is_spam: true,
            },
          ],
        };
      }
      if (url.endsWith(`/address/${SUI_ADDRESS}/positions`)) {
        return {
          data: [
            {
              current: {
                tokens: [
                  {
                    amount: 3,
                    token: {
                      contract_address: "0xusdc",
                      symbol: "USDC",
                      price: 1,
                    },
                  },
                  {
                    amount: 0,
                    token: {
                      contract_address: "0xzero",
                      symbol: "ZERO",
                      price: 1,
                    },
                  },
                ],
              },
            },
          ],
        };
      }
      throw new Error(`Unexpected Sui URL: ${url}`);
    });
    const analyzer = new SUIAnalyzer({
      sui: { addresses: [SUI_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "SUI",
        assetType: "crypto",
        amount: 1.5,
        price: { value: 2, base: "usd" },
        wallet: SUI_ADDRESS,
        chain: "sui",
      },
      {
        symbol: "USDC",
        assetType: "crypto",
        amount: 3,
        price: { value: 1, base: "usd" },
        wallet: SUI_ADDRESS,
        chain: "sui",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `https://api.getnimbus.io/v2/address/${SUI_ADDRESS}/holding`,
      20000,
    );
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `https://api.getnimbus.io/v2/address/${SUI_ADDRESS}/positions`,
      20000,
    );
  });

  it("keeps core holdings when the optional DeFi endpoint fails", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/holding")) {
        return {
          data: [
            {
              contractAddress: "0xsui",
              name: "Sui",
              symbol: "SUI",
              amount: "1",
              rate: 2,
              last_24h_price: { price: 2 },
              is_spam: false,
            },
          ],
        };
      }
      throw new Error("DeFi endpoint unavailable");
    });
    const analyzer = new SUIAnalyzer({
      sui: { addresses: [SUI_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "SUI",
        assetType: "crypto",
        amount: 1,
        price: { value: 2, base: "usd" },
        wallet: SUI_ADDRESS,
        chain: "sui",
      },
    ]);
  });
});
