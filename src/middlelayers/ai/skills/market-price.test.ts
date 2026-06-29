import { beforeEach, describe, expect, it, vi } from "vitest";
import skill from "./market-price";
import { invoke } from "@tauri-apps/api/core";
import { fetchStockPrices } from "../../datafetch/utils/price";
import { listAllCurrencyRates } from "../../configuration";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../datafetch/utils/price", () => ({
  fetchStockPrices: vi.fn(),
}));

vi.mock("../../configuration", () => ({
  listAllCurrencyRates: vi.fn(),
}));

vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: {
    listAllSymbols: vi.fn(),
    listAssetsAfterCreatedAt: vi.fn(),
  },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAllCurrencyRates).mockResolvedValue([
    { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
  ]);
  vi.mocked(ASSET_HANDLER.listAllSymbols).mockResolvedValue([]);
  vi.mocked(ASSET_HANDLER.listAssetsAfterCreatedAt).mockResolvedValue([]);
});

describe("market_price skill", () => {
  it("rejects when no symbols are provided", async () => {
    const result = await skill.run({ symbols: [] }, { baseCurrency });
    expect((result.data as any).prices).toEqual({});
  });

  it("queries crypto prices via invoke when type=crypto", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 60000, ETH: 3000 });
    const result = await skill.run(
      { symbols: ["BTC", "ETH"], type: "crypto" },
      { baseCurrency },
    );
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", {
      symbols: ["BTC", "ETH"],
    });
    const data = result.data as any;
    expect(data.prices.BTC).toMatchObject({ priceUsd: 60000, type: "crypto" });
    expect(data.prices.ETH.priceUsd).toBe(3000);
  });

  it("queries stock prices via fetchStockPrices when type=stock", async () => {
    vi.mocked(fetchStockPrices).mockResolvedValue({ AAPL: 200 });
    const result = await skill.run(
      { symbols: ["AAPL"], type: "stock" },
      { baseCurrency },
    );
    expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL"]);
    expect((result.data as any).prices.AAPL).toMatchObject({ priceUsd: 200, type: "stock" });
  });

  it("infers asset type per symbol in auto mode", async () => {
    vi.mocked(ASSET_HANDLER.listAllSymbols).mockResolvedValue(["BTC", "ETH"]);
    vi.mocked(ASSET_HANDLER.listAssetsAfterCreatedAt).mockResolvedValue([
      { id: 1, uuid: "u", createdAt: "2026-01-01T00:00:00.000Z", assetType: "stock", symbol: "AAPL", amount: 1, value: 200, price: 200 },
    ] as any);
    vi.mocked(invoke).mockResolvedValue({ BTC: 60000 });
    vi.mocked(fetchStockPrices).mockResolvedValue({ AAPL: 200 });

    const result = await skill.run(
      { symbols: ["BTC", "AAPL", "MSFT"], type: "auto" },
      { baseCurrency },
    );
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", {
      symbols: ["BTC", "MSFT"],
    });
    expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL", "MSFT"]);
    const data = result.data as any;
    expect(data.prices.BTC.type).toBe("crypto");
    expect(data.prices.AAPL.type).toBe("stock");
  });

  it("converts USD prices into the base currency", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 1000 });
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
      { currency: "EUR", rate: 0.5, alias: "EUR", symbol: "€" },
    ]);
    const result = await skill.run(
      { symbols: ["BTC"], type: "crypto" },
      { baseCurrency: { ...baseCurrency, currency: "EUR", rate: 0.5 } },
    );
    const data = result.data as any;
    expect(data.prices.BTC.priceUsd).toBe(1000);
    expect(data.prices.BTC.price).toBe(500);
  });
  it("deduplicates symbols and normalizes them to uppercase", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 60000 });
    const result = await skill.run(
      { symbols: ["btc", "BTC", "Btc"], type: "crypto" },
      { baseCurrency },
    );
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", {
      symbols: ["BTC"],
    });
    expect(Object.keys((result.data as any).prices)).toHaveLength(1);
  });

  it("handles empty symbol list gracefully", async () => {
    const result = await skill.run({ symbols: [], type: "crypto" }, { baseCurrency });
    expect((result.data as any).prices).toEqual({});
  });

  it("gracefully handles API failure for crypto", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("API down"));
    const result = await skill.run(
      { symbols: ["BTC"], type: "crypto" },
      { baseCurrency },
    );
    expect((result.data as any).prices).toEqual({});
  });

  it("returns priceUsd and price with base currency conversion for mixed types", async () => {
    vi.mocked(ASSET_HANDLER.listAllSymbols).mockResolvedValue(["BTC"]);
    vi.mocked(ASSET_HANDLER.listAssetsAfterCreatedAt).mockResolvedValue([
      { id: 1, uuid: "u", createdAt: "2026-01-01T00:00:00.000Z", assetType: "stock", symbol: "AAPL", amount: 1, value: 200, price: 200 },
    ] as any);
    vi.mocked(invoke).mockResolvedValue({ BTC: 50000 });
    vi.mocked(fetchStockPrices).mockResolvedValue({ AAPL: 200 });

    const result = await skill.run(
      { symbols: ["BTC", "AAPL"], type: "auto" },
      { baseCurrency: { ...baseCurrency, currency: "EUR", rate: 0.92 } },
    );
    const data = result.data as any;
    expect(data.prices.BTC.priceUsd).toBe(50000);
    expect(data.prices.BTC.price).toBe(46000);
    expect(data.prices.AAPL.priceUsd).toBe(200);
    expect(data.prices.AAPL.price).toBe(184);
  });

});
