import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { BybitExchange } from "./bybit";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BybitExchange", () => {
  it("signs the sorted ticker query and maps only positive USDT prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      retCode: 0,
      retMsg: "OK",
      result: {
        list: [
          { symbol: "BTCUSDT", lastPrice: "65000" },
          { symbol: "ETHUSDT", lastPrice: "0" },
          { symbol: "SOLBTC", lastPrice: "0.002" },
        ],
      },
    });
    const exchange = new BybitExchange("test-key", "test-secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bybit.com/v5/market/tickers?category=spot",
      5000,
      {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": "test-key",
        "X-BAPI-TIMESTAMP": "1700000000000",
        "X-BAPI-RECV-WINDOW": "5000",
        "X-BAPI-SIGN":
          "5c2e2c53d2cd33c764b4b39765fb2e14c86ba63ccb67afe0a8c3a060e7398a3f",
      },
    );
  });

  it("keeps wallet and on-chain balances when optional earn products fail", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        retCode: 0,
        retMsg: "OK",
        result: {
          list: [
            {
              coin: [
                { coin: "btc", equity: "1", walletBalance: "1" },
                { coin: "eth", equity: "0", walletBalance: "0" },
              ],
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error("flexible unavailable"))
      .mockResolvedValueOnce({
        retCode: 0,
        retMsg: "OK",
        result: { list: [{ coin: "btc", productId: "p", amount: "2" }] },
      })
      .mockRejectedValueOnce(new Error("advance unavailable"));
    const exchange = new BybitExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 3 });
  });

  it("returns false when the required wallet credential check fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        retCode: 10003,
        retMsg: "API key is invalid",
        result: { list: [] },
      })
      .mockResolvedValue({
        retCode: 0,
        retMsg: "OK",
        result: { list: [] },
      });
    const exchange = new BybitExchange("bad-key", "secret");

    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });
});
