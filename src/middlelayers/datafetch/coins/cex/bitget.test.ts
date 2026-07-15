import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { BitgetExchange } from "./bitget";

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

describe("BitgetExchange", () => {
  it("signs the credential-validation request with deterministic headers", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: [] });
    const exchange = new BitgetExchange(
      "test-key",
      "test-secret",
      "test-passphrase",
    );

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bitget.com/api/v2/spot/account/assets",
      5000,
      {
        "Content-Type": "application/json",
        "ACCESS-KEY": "test-key",
        "ACCESS-SIGN": "NWgiyXfUwDZ1wyMDarowE42SSc2pILk98Lup40soRJY=",
        "ACCESS-TIMESTAMP": "1700000000000",
        "ACCESS-PASSPHRASE": "test-passphrase",
      },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("keeps spot and earn balances when futures fail, normalizing and filtering rows", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: [
          { coin: "btc", available: "1", locked: "0.5", frozen: "0.5" },
          { coin: "eth", available: "0", locked: "0", frozen: "0" },
        ],
      })
      .mockRejectedValueOnce(new Error("futures disabled"))
      .mockResolvedValueOnce({
        data: [
          { coin: "btc", amount: "2" },
          { coin: "sol", amount: "0" },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            coin: "usdt",
            totalAmount: "3",
            available: "3",
            frozen: "0",
            borrow: "0",
            interest: "0",
            net: "3",
          },
        ],
      });
    const exchange = new BitgetExchange("test-key", "test-secret", "pass");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 4,
      USDT: 3,
    });
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      2,
      "GET",
      "https://api.bitget.com/api/v2/mix/account/account?marginCoin=usdt&productType=USDT-FUTURES",
      5000,
      expect.objectContaining({
        "ACCESS-SIGN": "CI/BapdoDGyBOD6QRqkX0YZ8tq4LWBjLZLDCtP0R4vU=",
      }),
    );
  });

  it("maps only positive USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [
        { symbol: "BTCUSDT", lastPr: "65000" },
        { symbol: "ETHUSDT", lastPr: "0" },
        { symbol: "SOLBTC", lastPr: "0.002" },
      ],
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bitget.com/api/v2/spot/market/tickers",
    );
  });
});
