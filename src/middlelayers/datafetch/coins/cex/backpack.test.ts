import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { BackpackExchange } from "./backpack";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

// base64 of the 32 bytes [1, 2, ..., 32] used as the ED25519 seed.
const TEST_SECRET = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=";

// Deterministic (RFC 8032) signatures for the fixed timestamp/window below.
const BALANCE_SIGNATURE =
  "NUwGpfoyZN5IZ49PIv7j4PJiTs5E8rxw42myDXszA+60mNIQOCA423SyLvHbk4o6aj5oyCJsOGkiJ/zAkkzTAg==";
const LENDING_SIGNATURE =
  "jFZCA1nZH3nw9hHk/ksvHKtNZyvn9mIbhSM0Rq3yJq3zZfeX7y/pI7VE/ueaNhWjQZxBIPXP5Ynqrga4+xaOBQ==";
const POSITION_SIGNATURE =
  "iukdwaQqsTZOjdDCUN0a+VhZXnLzqTNRZ6mopI8brQ/Dpue38G6BE1d5XapbB//BtTHs4vRZM24u/2XB3KoPCQ==";

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

describe("BackpackExchange", () => {
  it("exposes name, identity, and alias", () => {
    const exchange = new BackpackExchange("test-key", TEST_SECRET, "my-bp");
    expect(exchange.getExchangeName()).toBe("Backpack");
    expect(exchange.getIdentity()).toBe("backpack-test-key");
    expect(exchange.getAlias()).toBe("my-bp");
    expect(new BackpackExchange("k", TEST_SECRET).getAlias()).toBeUndefined();
  });

  it("signs the balance query with a deterministic ED25519 signature", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({});
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.backpack.exchange/api/v1/capital",
      5000,
      {
        "X-API-Key": "test-key",
        "X-Signature": BALANCE_SIGNATURE,
        "X-Timestamp": "1700000000000",
        "X-Window": "5000",
      },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("merges spot, lending, and futures pnl balances with signed requests", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        SOL: { available: "10.5", locked: "0.5", staked: "2" },
        USDC: { available: "100", locked: "0", staked: "0" },
        BTC: { available: "0", locked: "0", staked: "0" },
      })
      .mockResolvedValueOnce([
        { symbol: "SOL", netQuantity: "5" },
        { symbol: "USDC", netQuantity: "-20" },
      ])
      .mockResolvedValueOnce([
        { symbol: "SOL_USDC_PERP", netQuantity: "1.2", pnlUnrealized: "15.5" },
        { symbol: "ETH_USDC_PERP", netQuantity: "-0.3", pnlUnrealized: "-5" },
      ]);
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({
      SOL: 18,
      USDC: 90.5,
    });

    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      1,
      "GET",
      "https://api.backpack.exchange/api/v1/capital",
      5000,
      {
        "X-API-Key": "test-key",
        "X-Signature": BALANCE_SIGNATURE,
        "X-Timestamp": "1700000000000",
        "X-Window": "5000",
      },
    );
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      2,
      "GET",
      "https://api.backpack.exchange/api/v1/borrowLend/positions",
      5000,
      {
        "X-API-Key": "test-key",
        "X-Signature": LENDING_SIGNATURE,
        "X-Timestamp": "1700000000000",
        "X-Window": "5000",
      },
    );
    expect(sendHttpRequest).toHaveBeenNthCalledWith(
      3,
      "GET",
      "https://api.backpack.exchange/api/v1/position",
      5000,
      {
        "X-API-Key": "test-key",
        "X-Signature": POSITION_SIGNATURE,
        "X-Timestamp": "1700000000000",
        "X-Window": "5000",
      },
    );
  });

  it("keeps the spot balance when optional lending and futures endpoints fail", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        SOL: { available: "3", locked: "0", staked: "0" },
      })
      .mockRejectedValueOnce(new Error("lending disabled"))
      .mockRejectedValueOnce(new Error("futures disabled"));
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ SOL: 3 });
  });

  it("tolerates malformed entries and non-array optional responses", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        SOL: { available: "1" },
        JUNK: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ not: "an array" });
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ SOL: 1 });
  });

  it("rejects when the spot balance response is not an object map", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([]);
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.fetchTotalBalance()).rejects.toThrow(
      "Backpack spot balance response is invalid",
    );
  });

  it("rejects when the required spot balance request fails", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new Error("bad signature"));
    const exchange = new BackpackExchange("test-key", TEST_SECRET);

    await expect(exchange.fetchTotalBalance()).rejects.toThrow("bad signature");
  });

  it("maps only positive spot _USDC ticker prices and excludes perps", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { symbol: "SOL_USDC", lastPrice: "150.5" },
      { symbol: "BTC_USDC", lastPrice: "60000" },
      { symbol: "ETH_USDC_PERP", lastPrice: "3000" },
      { symbol: "WEIRD_USDT", lastPrice: "1" },
      { symbol: "ZERO_USDC", lastPrice: "0" },
    ]);
    const exchange = new BackpackExchange("key", TEST_SECRET);

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({
      SOL: 150.5,
      BTC: 60000,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.backpack.exchange/api/v1/tickers",
    );
  });
});
