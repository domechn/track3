import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { KrakenExchange } from "./kraken";

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

describe("KrakenExchange", () => {
  it("signs the nonce and normalizes Kraken asset and earn suffixes", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: [],
      result: {
        "XXBT.F": { balance: "1", hold_trade: "0.5" },
        XETH: { balance: "0", hold_trade: "0" },
        "SOL.M": { balance: "2", hold_trade: "0" },
      },
    });
    const exchange = new KrakenExchange(
      "test-key",
      "dGVzdC1zZWNyZXQ=",
    );

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 1.5,
      SOL: 2,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://api.kraken.com/0/private/BalanceEx",
      5000,
      {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "API-Key": "test-key",
        "API-Sign":
          "P8hMtwVeeWXVRcGP9ekmzH70F3TMmUn+yzChY/rgcZISweFeJ9F5jkYv6On5Srk5AbvktYnJfmpHk63TEAYHUw==",
      },
      undefined,
      { nonce: "17000000000000001" },
    );
  });

  it("maps XBT ticker symbols and filters zero mid-prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: [],
      result: {
        XBTUSDT: { a: ["65001", "1", "1"], b: ["64999", "1", "1"] },
        ETHUSDT: { a: ["0", "1", "1"], b: ["0", "1", "1"] },
        SOLBTC: { a: ["0.002", "1", "1"], b: ["0.001", "1", "1"] },
      },
    });
    const exchange = new KrakenExchange("key", "c2VjcmV0");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.kraken.com/0/public/Ticker",
    );
  });

  it("returns false when private credential validation fails", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      error: ["EAPI:Invalid key"],
      result: {},
    });
    const exchange = new KrakenExchange("bad-key", "c2VjcmV0");

    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });
});
