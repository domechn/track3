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
    warn.mockRestore();
  });

  it("does not print a secret embedded in an exchange name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      new OtherCexExchanges("sk-abcdefghijklmnop1234567890", { apiKey: "key", secret: "secret" });
      expect(JSON.stringify(warn.mock.calls)).not.toContain("sk-abcdefghijklmnop1234567890");
    } finally {
      warn.mockRestore();
    }
  });
});
