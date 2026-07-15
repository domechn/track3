import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { DOGEAnalyzer } from "./doge";

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const DOGE_ADDRESS = `DA${"1".repeat(32)}`;

beforeEach(() => {
  vi.clearAllMocks();
  getMemoryCacheInstance("data-fetch").clearCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DOGEAnalyzer", () => {
  it("validates Dogecoin addresses", async () => {
    await expect(
      new DOGEAnalyzer({
        doge: { addresses: [DOGE_ADDRESS] },
      }).verifyConfigs(),
    ).resolves.toBe(true);
    await expect(
      new DOGEAnalyzer({
        doge: { addresses: ["invalid"] },
      }).verifyConfigs(),
    ).resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new DOGEAnalyzer({ doge: { addresses: [] } });

    await expect(analyzer.loadPortfolio()).resolves.toEqual([]);
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("converts koinu and maps wallet metadata", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      final_balance: 123456789,
    });
    const analyzer = new DOGEAnalyzer({
      doge: { addresses: [DOGE_ADDRESS] },
    });

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        amount: 1.23456789,
        wallet: DOGE_ADDRESS,
        chain: "dogecoin",
        assetType: "crypto",
        symbol: "DOGE",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `https://api.blockcypher.com/v1/doge/main/addrs/${DOGE_ADDRESS}`,
    );
  });
});
