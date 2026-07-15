import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { TonAnalyzer } from "./ton";

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const TON_ADDRESS = `U${"A".repeat(47)}`;

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
