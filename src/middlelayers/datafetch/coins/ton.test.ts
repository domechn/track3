import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { TonAnalyzer } from "./ton";

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const TON_ADDRESS = "UQDKbjIcfM6ezt8KjKJJLshZJJSqX7XOA4ff-W72r5gqPuwA";

beforeEach(() => {
  vi.clearAllMocks();
  getMemoryCacheInstance("data-fetch").clearCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TonAnalyzer", () => {
  it("validates TON addresses", async () => {
    await expect(
      new TonAnalyzer({ ton: { addresses: [TON_ADDRESS] } }).verifyConfigs(),
    ).resolves.toBe(true);
    await expect(
      new TonAnalyzer({ ton: { addresses: ["invalid"] } }).verifyConfigs(),
    ).resolves.toBe(false);
  });

  it("accepts official raw, bounceable and non-bounceable TON forms and rejects a bad checksum", async () => {
    const raw = "0:ca6e321c7cce9ecedf0a8ca2492ec8592494aa5fb5ce0387dff96ef6af982a3e";
    const bounceable = "EQDKbjIcfM6ezt8KjKJJLshZJJSqX7XOA4ff-W72r5gqPrHF";
    const nonBounceable = "UQDKbjIcfM6ezt8KjKJJLshZJJSqX7XOA4ff-W72r5gqPuwA";
    const urlAlphabet = "EQAGBwoPFh8qN0ZXan-Wr8rnBidKb5a_6hdGd6rfFk-KxxK2";
    await expect(new TonAnalyzer({ ton: { addresses: [raw, bounceable, nonBounceable, urlAlphabet] } }).verifyConfigs())
      .resolves.toBe(true);
    await expect(new TonAnalyzer({ ton: { addresses: [bounceable.slice(0, -1) + "G"] } }).verifyConfigs())
      .resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new TonAnalyzer({ ton: { addresses: [] } });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("converts nanotons and maps wallet metadata", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ balance: "2500000000" });
    const analyzer = new TonAnalyzer({
      ton: { addresses: [TON_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        amount: 2.5,
        wallet: TON_ADDRESS,
        chain: "ton",
        assetType: "crypto",
        symbol: "TON",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `https://toncenter.com/api/v3/account?address=${TON_ADDRESS}`,
      5000,
    );
  });
});
