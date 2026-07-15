import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { GateExchange } from "./gate";

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

describe("GateExchange", () => {
  it("signs the spot credential-validation request deterministically", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([]);
    const exchange = new GateExchange("test-key", "test-secret");

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.gateio.ws/api/v4/spot/accounts",
      5000,
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        KEY: "test-key",
        Timestamp: "1700000000",
        SIGN:
          "157d9c6819a76157119f81652d8a85bf29daf2eab3ae6b25aa47902e37b354885e562b94324129c5b958f3edd8889b011b4368eb554a66c27d82d7e99160a7e3",
      },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("keeps normalized spot balances when optional wallet products fail", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce([
        { currency: "btc", available: "1", locked: "0" },
        { currency: "eth", available: "0", locked: "0" },
      ])
      .mockRejectedValueOnce(new Error("earn unavailable"))
      .mockResolvedValueOnce({
        code: 0,
        message: "",
        data: { list: [], total: 0 },
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ user_total_interest_usdt: "0" })
      .mockRejectedValueOnce(new Error("portfolio unavailable"))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("total balance unavailable"));
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1 });
  });

  it("maps only positive USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { currency_pair: "BTC_USDT", last: "65000" },
      { currency_pair: "ETH_USDT", last: "0" },
      { currency_pair: "SOL_BTC", last: "0.002" },
    ]);
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.gateio.ws/api/v4/spot/tickers",
    );
  });
});
