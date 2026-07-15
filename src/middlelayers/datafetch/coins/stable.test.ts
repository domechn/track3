import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "../utils/http";
import { RemoteStableCoinsQuery, StableCoinsQuery } from "./stable";

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

describe("stable coin queries", () => {
  it("returns the deterministic local stable coin catalog", async () => {
    const symbols = await new StableCoinsQuery().listAllStableCoins();

    expect(symbols).toContain("USDT");
    expect(symbols).toContain("USDC");
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("maps the remote catalog through the shared HTTP boundary", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [{ symbol: "USDT" }, { symbol: "USDC" }],
    });

    await expect(
      new RemoteStableCoinsQuery().listAllStableCoins(),
    ).resolves.toEqual(["USDT", "USDC"]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://track3-pro-api.domc.me/api/coins/listStableCoins",
      10000,
      { "x-track3-client-id": "client-id" },
    );
  });
});
