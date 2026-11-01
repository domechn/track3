import { describe, expect, it } from "vitest";
import { partialFromSourceStatuses } from "./snapshot-partial";

describe("partial snapshot marker", () => {
  it("records only hashed identities from stale sources", () => {
    const secret = "exchange-secret-api-key";
    const marker = partialFromSourceStatuses([
      { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider: "OKX",
        category: "network", lastSuccessAt: "2024-04-15T12:00:00.000Z" },
      { sourceId: "btc:0", label: "BTC", status: "ok", kind: "wallet", provider: "BTC" },
    ], [
      { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider: "OKX",
        walletIdentities: [`okex-${secret}`], coins: [] },
      { sourceId: "btc:0", label: "BTC", status: "ok", kind: "wallet", provider: "BTC",
        walletIdentities: ["btc-address"], coins: [] },
    ], "2024-04-16T13:00:00.000Z");
    expect(marker).toEqual({
      sourcesTotal: 2,
      missing: [{ wallet: "ddf7fe606e048ac89f8a8c62bf23c4be", kind: "exchange",
        provider: "OKX", category: "network", lastSuccessAt: "2024-04-15T12:00:00.000Z" }],
      fill: "last_known",
      createdAt: "2024-04-16T13:00:00.000Z",
    });
    expect(JSON.stringify(marker)).not.toContain(secret);
  });

  it("never carries a raw value from a malformed prefixed identity", () => {
    const marker = partialFromSourceStatuses([
      { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider: "OKX" },
    ], [
      { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider: "OKX",
        walletIdentities: ["md5:raw-api-key"], coins: [] },
    ], "2024-04-16T13:00:00.000Z");
    expect(marker).toBeUndefined();
  });

  it.each(["é".repeat(41), "OKX\u0085desk", "OKX\ud800"])(
    "drops a generated marker whose provider Rust would reject: %s",
    (provider) => {
      const marker = partialFromSourceStatuses([
        { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider },
      ], [
        { sourceId: "cex:0", label: "Account", status: "stale", kind: "exchange", provider,
          walletIdentities: ["wallet-a"], coins: [] },
      ], "2024-04-16T13:00:00.000Z");
      expect(marker).toBeUndefined();
    },
  );

  it.each(["partial", "failed"] as const)(
    "does not mark a %s source as stale",
    (status) => {
      const marker = partialFromSourceStatuses([
        { sourceId: "cex:0", label: "Account", status, kind: "exchange", provider: "OKX" },
      ], [
        { sourceId: "cex:0", label: "Account", status: "partial", kind: "exchange", provider: "OKX",
          walletIdentities: ["wallet-a"], coins: [] },
      ], "2024-04-16T13:00:00.000Z");
      expect(marker).toBeUndefined();
    },
  );
});
