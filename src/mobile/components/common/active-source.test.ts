import { describe, expect, it } from "vitest";
import type { GlobalConfig } from "@/middlelayers/datafetch/types";
import { hasActiveSource } from "./active-source";

describe("hasActiveSource", () => {
  it("ignores inactive accounts and addresses", () => {
    const config = {
      exchanges: [{ active: false }],
      stockConfig: { brokers: [{ active: false }] },
      btc: { addresses: [{ address: "btc-address", active: false }] },
    } as GlobalConfig;
    expect(hasActiveSource(config)).toBe(false);
  });

  it("accepts active accounts and legacy string addresses", () => {
    expect(hasActiveSource({ exchanges: [{ active: true }] } as GlobalConfig)).toBe(true);
    expect(hasActiveSource({ btc: { addresses: ["btc-address"] } } as GlobalConfig)).toBe(true);
  });
});
