import { beforeEach, describe, expect, it, vi } from "vitest";
import { setBaseCurrency } from "../pi-agent";
import skill from "./market-price";
import { invoke } from "@tauri-apps/api/core";
import { fetchStockPrices } from "../../datafetch/utils/price";
import { listAllCurrencyRates } from "../../configuration";
import { ASSET_HANDLER } from "../../entities/assets";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../datafetch/utils/price", () => ({ fetchStockPrices: vi.fn() }));
vi.mock("../../configuration", () => ({ listAllCurrencyRates: vi.fn() }));
vi.mock("../../entities/assets", () => ({
  ASSET_HANDLER: { listAllSymbols: vi.fn(), listAssetsAfterCreatedAt: vi.fn() },
}));

const baseCurrency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

beforeEach(() => {
  vi.clearAllMocks();
  setBaseCurrency(baseCurrency);
  vi.mocked(listAllCurrencyRates).mockResolvedValue([{ currency: "USD", rate: 1, alias: "USD", symbol: "$" }]);
  vi.mocked(ASSET_HANDLER.listAllSymbols).mockResolvedValue([]);
  vi.mocked(ASSET_HANDLER.listAssetsAfterCreatedAt).mockResolvedValue([]);
});

describe("market_price skill", () => {
  it("rejects when no symbols are provided", async () => {
    const result = await skill.execute("test", { symbols: [] }, undefined, undefined, {} as any);
    expect((result.details.data as any).prices).toEqual({});
  });

  it("queries crypto prices via invoke when type=crypto", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 60000, ETH: 3000 });
    const result = await skill.execute("test", { symbols: ["BTC", "ETH"], type: "crypto" }, undefined, undefined, {} as any);
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", { symbols: ["BTC", "ETH"] });
    expect((result.details.data as any).prices.BTC).toMatchObject({ priceUsd: 60000, type: "crypto" });
  });

  it("queries stock prices via fetchStockPrices when type=stock", async () => {
    vi.mocked(fetchStockPrices).mockResolvedValue({ AAPL: 200 });
    const result = await skill.execute("test", { symbols: ["AAPL"], type: "stock" }, undefined, undefined, {} as any);
    expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL"]);
    expect((result.details.data as any).prices.AAPL).toMatchObject({ priceUsd: 200, type: "stock" });
  });

  it("infers asset type per symbol in auto mode", async () => {
    vi.mocked(ASSET_HANDLER.listAllSymbols).mockResolvedValue(["BTC", "ETH"]);
    vi.mocked(ASSET_HANDLER.listAssetsAfterCreatedAt).mockResolvedValue([
      { id: 1, uuid: "u", createdAt: "2026-01-01T00:00:00.000Z", assetType: "stock", symbol: "AAPL", amount: 1, value: 200, price: 200 },
    ] as any);
    vi.mocked(invoke).mockResolvedValue({ BTC: 60000 });
    vi.mocked(fetchStockPrices).mockResolvedValue({ AAPL: 200 });
    const result = await skill.execute("test", { symbols: ["BTC", "AAPL", "MSFT"], type: "auto" }, undefined, undefined, {} as any);
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", { symbols: ["BTC", "MSFT"] });
    expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL"]);
    expect((result.details.data as any).prices.BTC.type).toBe("crypto");
    expect((result.details.data as any).prices.AAPL.type).toBe("stock");
  });

  it("converts USD prices into the base currency", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 1000 });
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", rate: 1, alias: "USD", symbol: "$" },
      { currency: "EUR", rate: 0.5, alias: "EUR", symbol: "€" },
    ]);
    setBaseCurrency({ currency: "EUR", rate: 0.5, alias: "EUR", symbol: "€" });
    const result = await skill.execute("test", { symbols: ["BTC"], type: "crypto" }, undefined, undefined, {} as any);
    const data = result.details.data as any;
    expect(data.prices.BTC.priceUsd).toBe(1000);
    expect(data.prices.BTC.price).toBe(500);
  });
});
