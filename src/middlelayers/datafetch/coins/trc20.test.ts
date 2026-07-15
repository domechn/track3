import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "../utils/http";
import { getMemoryCacheInstance } from "../utils/cache";
import { TRC20ProUserAnalyzer } from "./trc20";

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
}));

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const TRON_ADDRESS = `T${"A".repeat(33)}`;

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

describe("TRC20ProUserAnalyzer", () => {
  it("validates Tron addresses", async () => {
    await expect(
      new TRC20ProUserAnalyzer(
        { trc20: { addresses: [TRON_ADDRESS] } },
        "license",
      ).verifyConfigs(),
    ).resolves.toBe(true);
    await expect(
      new TRC20ProUserAnalyzer(
        { trc20: { addresses: ["invalid"] } },
        "license",
      ).verifyConfigs(),
    ).resolves.toBe(false);
  });

  it("returns an empty portfolio without making a request", async () => {
    const analyzer = new TRC20ProUserAnalyzer(
      { trc20: { addresses: [] } },
      "license",
    );

    await expect(analyzer.loadPortfolioInternal("license")).resolves.toEqual(
      [],
    );
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("sends the Pro request contract and maps returned assets", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [
        {
          wallet: TRON_ADDRESS,
          assets: [
            {
              symbol: "USDT",
              amount: 25,
              tokenAddress: "TToken",
              price: 1,
            },
          ],
        },
      ],
    });
    const analyzer = new TRC20ProUserAnalyzer(
      { trc20: { addresses: [TRON_ADDRESS] } },
      "license-token",
    );

    const portfolio = analyzer.loadPortfolio();
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([
      {
        symbol: "USDT",
        assetType: "crypto",
        amount: 25,
        price: { value: 1, base: "usd" },
        wallet: TRON_ADDRESS,
        chain: "tron",
      },
    ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://track3-pro-api.domc.me/api/trc20/assetsBalances",
      20000,
      {
        "x-track3-client-id": "client-id",
        "x-track3-api-key": "license-token",
      },
      { wallets: [TRON_ADDRESS] },
    );
  });

  it("retries a transient Pro failure and preserves the supplied license", async () => {
    vi.mocked(sendHttpRequest)
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({ data: [] });
    const analyzer = new TRC20ProUserAnalyzer(
      { trc20: { addresses: [TRON_ADDRESS] } },
      "constructor-license",
    );

    const portfolio = analyzer.loadPortfolioWithRetry("retry-license", 2);
    await vi.runAllTimersAsync();

    await expect(portfolio).resolves.toEqual([]);
    expect(sendHttpRequest).toHaveBeenCalledTimes(2);
    expect(sendHttpRequest).toHaveBeenLastCalledWith(
      "POST",
      "https://track3-pro-api.domc.me/api/trc20/assetsBalances",
      20000,
      expect.objectContaining({
        "x-track3-api-key": "retry-license",
      }),
      { wallets: [TRON_ADDRESS] },
    );
  });
});
