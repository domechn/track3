import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { BTCAnalyzer } from "./btc";

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

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

describe("BTCAnalyzer", () => {
  it("validates active Bitcoin addresses and ignores inactive entries", async () => {
    const valid = new BTCAnalyzer({
      btc: {
        addresses: [
          "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
          { address: "invalid", active: false },
        ],
      },
    });
    const invalid = new BTCAnalyzer({
      btc: { addresses: ["not-a-bitcoin-address"] },
    });

    await expect(valid.verifyConfigs()).resolves.toBe(true);
    await expect(invalid.verifyConfigs()).resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new BTCAnalyzer({ btc: { addresses: [] } });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("falls back to blockchain.info and converts satoshis to BTC", async () => {
    vi.mocked(sendHttpRequest)
      .mockRejectedValueOnce(new Error("BlockCypher unavailable"))
      .mockResolvedValueOnce("123456789");
    const wallet = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";
    const analyzer = new BTCAnalyzer({ btc: { addresses: [wallet] } });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        amount: 1.23456789,
        wallet,
        chain: "bitcoin",
        assetType: "crypto",
        symbol: "BTC",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      1,
      "GET",
      `https://api.blockcypher.com/v1/btc/main/addrs/${wallet}`,
    );
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      2,
      "GET",
      `https://blockchain.info/q/addressbalance/${wallet}`,
    );
  });
});
