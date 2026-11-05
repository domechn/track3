import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { MexcExchange } from "./mexc";
import { HttpRequestError } from "../../utils/http";
import { takeOptionalSourceFailures } from "../../utils/source-failure";

vi.mock("../../utils/http", async () => ({
  ...await vi.importActual<typeof import("../../utils/http")>("../../utils/http"),
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

describe("MexcExchange", () => {
  it("reports code 700011 and non-404 margin failures while preserving spot holdings", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/api/v3/account?")) return { balances: [{ asset: "BTC", free: "2", locked: "0" }] } as never;
      if (url.includes("/margin/account?")) throw new HttpRequestError('{"code":700011}', 400);
      if (url.includes("/margin/isolated/account?")) throw new HttpRequestError("service unavailable", 503);
      return { success: true, code: 0, data: [] } as never;
    });
    const exchange = new MexcExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "network", endpoints: ["Cross margin", "Isolated margin"],
    });
  });

  it("treats 404 on the two unverified margin paths as unavailable but reports a futures 404", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/api/v3/account?")) return { balances: [] } as never;
      throw new HttpRequestError("not found", 404);
    });
    const exchange = new MexcExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "other", endpoints: ["Futures"],
    });
  });

  it("signs the sorted spot credential query deterministically", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ balances: [] });
    const exchange = new MexcExchange("test-key", "test-secret");

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.mexc.com/api/v3/account?recvWindow=5000&timestamp=1700000000000&signature=e80444d3300edcb80b05d266439eb51c0f9551b00a09836c26b05dea9af0eba3",
      5000,
      { "X-MEXC-APIKEY": "test-key" },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("maps spot, margin, and futures fallback balances while ignoring optional failure", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        balances: [
          { asset: "btc", free: "1", locked: "0" },
          { asset: "eth", free: "0", locked: "0" },
        ],
      })
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            baseAsset: { asset: "eth", netAsset: "2" },
            quoteAsset: { asset: "usdt", netAsset: "0" },
          },
        ],
      })
      .mockRejectedValueOnce(new Error("isolated disabled"))
      .mockResolvedValueOnce({
        success: true,
        code: 0,
        data: [
          {
            currency: "usdt",
            availableBalance: "3",
            frozenBalance: "1",
            unrealized: "-0.5",
          },
          {
            currency: "sol",
            equity: "0",
            availableBalance: "10",
            frozenBalance: "0",
            unrealized: "0",
          },
        ],
      });
    const exchange = new MexcExchange("test-key", "test-secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      BTC: 1,
      ETH: 2,
      USDT: 3.5,
    });
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      4,
      "GET",
      "https://api.mexc.com/api/v1/private/account/assets",
      5000,
      {
        ApiKey: "test-key",
        "Request-Time": "1700000000000",
        Signature:
          "0153051eb5d50f207dbb5b671528fb50a941add7851e6ba6d8a4f49ba7d521b2",
        "Recv-Window": "5000",
      },
    );
  });

  it("maps only positive USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { symbol: "BTCUSDT", price: "65000" },
      { symbol: "ETHUSDT", price: "0" },
      { symbol: "SOLBTC", price: "0.002" },
    ]);
    const exchange = new MexcExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.mexc.com/api/v3/ticker/price",
    );
  });
});
