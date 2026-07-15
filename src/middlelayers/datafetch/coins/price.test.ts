import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "../utils/http";
import { CoinPriceQuery, ProCoinPriceQuery } from "./price";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
}));

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClientID).mockResolvedValue("client-id");
});

describe("coin price queries", () => {
  it("returns an empty Pro result without a request", async () => {
    const query = new ProCoinPriceQuery("license");

    await expect(query.listAllCoinPrices([])).resolves.toEqual({});
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("sends the Pro request contract and maps its data", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: { BTC: 65000, ETH: 3500 },
    });
    const query = new ProCoinPriceQuery("license-token");

    await expect(query.listAllCoinPrices(["BTC", "ETH"])).resolves.toEqual({
      BTC: 65000,
      ETH: 3500,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://track3-pro-api.domc.me/api/coins/price",
      10000,
      {
        "x-track3-client-id": "client-id",
        "x-track3-api-key": "license-token",
      },
      { coins: ["BTC", "ETH"] },
    );
  });

  it("rejects an empty Pro response", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: {} });

    await expect(
      new ProCoinPriceQuery("license").listAllCoinPrices(["BTC"]),
    ).rejects.toThrow("failed to fetch coin prices");
  });

  it("passes the requested symbols to the Rust price command", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 65000 });
    const query = new CoinPriceQuery();

    await expect(query.listAllCoinPrices(["BTC"])).resolves.toEqual({
      BTC: 65000,
    });
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", {
      symbols: ["BTC"],
    });
  });
});
