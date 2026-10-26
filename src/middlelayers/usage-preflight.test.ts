import { describe, expect, it } from "vitest";
import { getUsageWarnings } from "./usage-preflight";

const usage = {
  enforced: true,
  usage: {
    erc20: { limit: 300, used: 299, remaining: 1, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
    tron: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
  },
};

describe("Pro refresh preflight", () => {
  it("warns only for resources whose planned wallets exceed remaining uses", () => {
    expect(getUsageWarnings(["erc20:0", "erc20:1", "trc20:0", "btc:0"], usage)).toEqual([
      { resource: "erc20", needed: 2, remaining: 1, stale: 1 },
      { resource: "tron", needed: 1, remaining: 0, stale: 1 },
    ]);
  });

  it("does not warn while the backend is in log mode or usage is unavailable", () => {
    expect(getUsageWarnings(["erc20:0", "erc20:1"], { ...usage, enforced: false })).toEqual([]);
    expect(getUsageWarnings(["erc20:0"], undefined)).toEqual([]);
  });
});
