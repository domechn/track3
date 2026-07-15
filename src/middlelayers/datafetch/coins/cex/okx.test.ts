import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { OkxExchange } from "./okx";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OkxExchange", () => {
  it("signs private paths and merges normalized non-zero balances", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: [
          {
            details: [
              { ccy: "btc", eq: "1" },
              { ccy: "eth", eq: "0" },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          { ccy: "btc", amt: "2" },
          { ccy: "sol", amt: "0" },
        ],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    const exchange = new OkxExchange(
      "test-key",
      "test-secret",
      "test-passphrase",
    );

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 3 });
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      1,
      "GET",
      "https://www.okx.com/api/v5/account/balance",
      5000,
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        "OK-ACCESS-SIGN": "R/Lhks5ByWxJgdTcfdhiv8GUcmIM43DuLsoJqM7j73k=",
        "OK-ACCESS-TIMESTAMP": "1700000000",
        "OK-ACCESS-KEY": "test-key",
        "OK-ACCESS-PASSPHRASE": "test-passphrase",
      },
    );
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://www.okx.com/api/v5/finance/sfp/dcd/order-history?state=live&limit=100",
      5000,
      expect.objectContaining({
        "OK-ACCESS-SIGN": "e1aSXGH6v2UY1dQNube04v4a4gMXxfSt8BfGp2/BcBk=",
      }),
    );
  });

  it("validates only the required spot endpoint when optional products fail", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: [{ details: [{ ccy: "btc", eq: "1" }] }],
      })
      .mockRejectedValueOnce(new Error("savings unavailable"))
      .mockRejectedValueOnce(new Error("funding unavailable"))
      .mockRejectedValueOnce(new Error("staking unavailable"))
      .mockRejectedValueOnce(new Error("defi unavailable"))
      .mockRejectedValueOnce(new Error("dual unavailable"));
    const exchange = new OkxExchange("key", "secret", "passphrase");

    await expect(exchange.verifyConfig()).resolves.toBe(true);

    vi.mocked(sendHttpRequest).mockReset();
    vi.mocked(sendHttpRequest).mockRejectedValue(new Error("invalid key"));
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("maps only positive spot USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [
        { instId: "BTC-USDT", last: "65000" },
        { instId: "ETH-USDT", last: "0" },
        { instId: "SOL-BTC", last: "0.002" },
      ],
    });
    const exchange = new OkxExchange("key", "secret", "passphrase");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
    );
  });
});
