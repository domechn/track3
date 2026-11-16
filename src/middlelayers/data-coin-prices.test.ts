import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { queryCoinPrices } from "./data";
import { sendHttpRequest } from "./datafetch/utils/http";
import { classifySourceError } from "./datafetch/utils/source-failure";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./datafetch/utils/http", async (original) => ({
  ...await original<typeof import("./datafetch/utils/http")>(), sendHttpRequest: vi.fn(),
}));
vi.mock("@/utils/app", async (original) => ({
  ...await original<typeof import("@/utils/app")>(), getClientID: vi.fn(async () => "client"),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("queryCoinPrices", () => {
  it("returns the price map unchanged for a free user", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 60_000, ETH: 3_000 });
    await expect(queryCoinPrices(["BTC", "ETH"], { isPro: false })).resolves.toEqual({ BTC: 60_000, ETH: 3_000 });
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", { symbols: ["BTC", "ETH"] });
  });

  it("returns the price map unchanged for a Pro user", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: { BTC: 60_000 } });
    await expect(queryCoinPrices(["BTC"], { isPro: true, license: "license" })).resolves.toEqual({ BTC: 60_000 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fails after 60 seconds when the price service never answers", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    let failure: unknown;
    let settled = false;
    void queryCoinPrices(["BTC"], { isPro: false }).catch((error: unknown) => { failure = error; })
      .finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(failure).toEqual(new Error("Price query timed out"));
    expect(classifySourceError(failure)).toBe("network");
  });
});
