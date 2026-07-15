import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { sendHttpRequest } from "../../utils/http";
import { BinanceExchange } from "./binance";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BinanceExchange", () => {
  it("exposes stable identity metadata without revealing the secret", () => {
    const exchange = new BinanceExchange("public-key", "private-secret", "Main");

    expect(exchange.getExchangeName()).toBe("Binance");
    expect(exchange.getIdentity()).toBe("binance-public-key");
    expect(exchange.getAlias()).toBe("Main");
    expect(exchange.getIdentity()).not.toContain("private-secret");
  });

  it("passes credentials through the Tauri command and validates failures", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ BTC: 1 })
      .mockRejectedValueOnce(new Error("invalid credentials"));
    const exchange = new BinanceExchange("public-key", "private-secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1 });
    expect(invoke).toHaveBeenNthCalledWith(1, "query_binance_balance", {
      apiKey: "public-key",
      apiSecret: "private-secret",
    });
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("maps USDT tickers, normalizes symbols, and drops zero prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { symbol: "BTCUSDT", price: "65000.5" },
      { symbol: "ETHUSDT", price: "0" },
      { symbol: "SOLBTC", price: "0.002" },
    ]);
    const exchange = new BinanceExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({
      BTC: 65000.5,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.binance.com/api/v3/ticker/price",
    );
  });
});
