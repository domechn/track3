import { describe, expect, it, vi } from "vitest";
import { OtherCexExchanges } from "./others";

describe("OtherCexExchanges", () => {
  it("warns once and exposes an inert adapter contract for unsupported exchanges", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const exchange = new OtherCexExchanges(
      "future-exchange",
      { apiKey: "public-key", secret: "private-secret" },
      "Unsupported",
    );

    expect(exchange.getExchangeName()).toBe("future-exchange");
    expect(exchange.getIdentity()).toBe("future-exchange-public-key");
    expect(exchange.getAlias()).toBe("Unsupported");
    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({});
    await expect(exchange.verifyConfig()).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).not.toContain("private-secret");
  });
});
