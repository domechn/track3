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

  it("accepts BIP173 and BIP350 mainnet vectors, P2PKH and P2SH, but rejects bad checksums", async () => {
    const valid = [
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4",
      "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
      "bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y",
    ];
    await expect(new BTCAnalyzer({ btc: { addresses: valid } }).verifyConfigs()).resolves.toBe(true);
    await expect(new BTCAnalyzer({ btc: { addresses: [
      "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyU",
    ] } }).verifyConfigs()).resolves.toBe(false);
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

  it("finishes a single wallet without the multi-wallet pacing delay", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ final_balance: 100_000_000 });
    const pending = new BTCAnalyzer({ btc: { addresses: ["wallet-a"] } }).loadPortfolio();
    let settled = false;
    pending.then(() => { settled = true; });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(true);
      await expect(pending).resolves.toEqual([
        { amount: 1, wallet: "wallet-a", chain: "bitcoin", assetType: "crypto", symbol: "BTC" },
      ]);
    } finally { await vi.runAllTimersAsync(); }
  });
});
