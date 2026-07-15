import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { HtxExchange } from "./htx";

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

describe("HtxExchange", () => {
  it("signs the credential-validation query deterministically", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ status: "ok", data: [] });
    const exchange = new HtxExchange("test-key", "test-secret");

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.huobi.pro/v1/account/accounts?AccessKeyId=test-key&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=2023-11-14T22%3A13%3A20&Signature=DoJ3%2FZnS5gnJ6fJ9Dh55EqDaYMQ4x45jm9iaPCq5tkA%3D",
      5000,
      { "Content-Type": "application/json" },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("keeps normalized spot balances when every futures endpoint fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        status: "ok",
        data: [{ id: 1, type: "spot", subtype: "", state: "working" }],
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          id: 1,
          type: "spot",
          state: "working",
          list: [
            { currency: "btc", type: "trade", balance: "1" },
            { currency: "eth", type: "trade", balance: "0" },
          ],
        },
      })
      .mockRejectedValueOnce(new Error("isolated disabled"))
      .mockRejectedValueOnce(new Error("cross disabled"))
      .mockRejectedValueOnce(new Error("coin swap disabled"));
    const exchange = new HtxExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1 });
  });

  it("normalizes market symbols and filters zero prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      status: "ok",
      data: [
        { symbol: "btcusdt", close: 65000 },
        { symbol: "ethusdt", close: 0 },
        { symbol: "solbtc", close: 0.002 },
      ],
    });
    const exchange = new HtxExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.huobi.pro/market/tickers",
    );
  });
});
