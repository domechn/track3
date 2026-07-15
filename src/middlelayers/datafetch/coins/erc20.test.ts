import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { ERC20NormalAnalyzer, ERC20ProAnalyzer } from "./erc20";

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
}));

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const ADDRESS_A = `0x${"1".repeat(40)}`;
const ADDRESS_B = `0x${"2".repeat(40)}`;

beforeEach(() => {
  vi.clearAllMocks();
  getMemoryCacheInstance("data-fetch").clearCache();
  vi.mocked(getClientID).mockResolvedValue("client-id");
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ERC20 analyzers", () => {
  it("validates EVM addresses and ignores inactive entries", async () => {
    const valid = new ERC20NormalAnalyzer({
      erc20: {
        addresses: [
          ADDRESS_A,
          { address: "invalid", active: false },
        ],
      },
    });
    const invalid = new ERC20NormalAnalyzer({
      erc20: { addresses: ["0x1234"] },
    });

    await expect(valid.verifyConfigs()).resolves.toBe(true);
    await expect(invalid.verifyConfigs()).resolves.toBe(false);
  });

  it("returns an empty normal portfolio without making a request", async () => {
    const analyzer = new ERC20NormalAnalyzer({
      erc20: { addresses: [] },
    });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("matches out-of-order JSON-RPC results by id and converts wei", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url === "https://bsc-dataseed.bnbchain.org") {
        return [
          { id: 1, jsonrpc: "2.0", result: "0x1bc16d674ec80000" },
          { id: 0, jsonrpc: "2.0", result: "0xde0b6b3a7640000" },
        ];
      }
      if (url === "https://ethereum-rpc.publicnode.com") {
        return [
          { id: 1, jsonrpc: "2.0", result: "0x3782dace9d900000" },
          { id: 0, jsonrpc: "2.0", result: "0x29a2241af62c0000" },
        ];
      }
      throw new Error(`Unexpected RPC URL: ${url}`);
    });
    const analyzer = new ERC20NormalAnalyzer({
      erc20: { addresses: [ADDRESS_A, ADDRESS_B] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        wallet: ADDRESS_A,
        symbol: "BNB",
        assetType: "crypto",
        amount: 1,
        chain: "bsc",
      },
      {
        wallet: ADDRESS_B,
        symbol: "BNB",
        assetType: "crypto",
        amount: 2,
        chain: "bsc",
      },
      {
        wallet: ADDRESS_A,
        symbol: "ETH",
        assetType: "crypto",
        amount: 3,
        chain: "ethereum",
      },
      {
        wallet: ADDRESS_B,
        symbol: "ETH",
        assetType: "crypto",
        amount: 4,
        chain: "ethereum",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://bsc-dataseed.bnbchain.org",
      5000,
      undefined,
      [
        {
          id: 0,
          jsonrpc: "2.0",
          params: [ADDRESS_A, "latest"],
          method: "eth_getBalance",
        },
        {
          id: 1,
          jsonrpc: "2.0",
          params: [ADDRESS_B, "latest"],
          method: "eth_getBalance",
        },
      ],
    );
  });

  it("retries a rate-limited normal RPC batch", async () => {
    let bscAttempts = 0;
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (
        url === "https://bsc-dataseed.bnbchain.org" &&
        bscAttempts++ === 0
      ) {
        throw new Error("429 Too Many Requests");
      }
      return [{ id: 0, jsonrpc: "2.0", result: "0xde0b6b3a7640000" }];
    });
    const analyzer = new ERC20NormalAnalyzer({
      erc20: { addresses: [ADDRESS_A] },
    });

    const portfolio = analyzer.loadPortfolioWithRetry(2);
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toHaveLength(2);
    expect(bscAttempts).toBe(2);
  });

  it("sends the Pro request contract and maps returned assets", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [
        {
          wallet: ADDRESS_A,
          assets: [
            {
              symbol: "USDC",
              amount: 12.5,
              chain: "ethereum",
              tokenAddress: "0xtoken",
              price: 1,
            },
          ],
        },
      ],
    });
    const analyzer = new ERC20ProAnalyzer(
      { erc20: { addresses: [ADDRESS_A] } },
      "license-token",
    );

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "USDC",
        assetType: "crypto",
        amount: 12.5,
        price: { value: 1, base: "usd" },
        wallet: ADDRESS_A,
        chain: "ethereum",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://track3-pro-api.domc.me/api/erc20/assetsBalances",
      30000,
      {
        "x-track3-client-id": "client-id",
        "x-track3-api-key": "license-token",
      },
      { wallets: [ADDRESS_A] },
    );
  });
});
