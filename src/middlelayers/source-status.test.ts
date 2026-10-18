import { expect, it } from "vitest";
import { normalizeSourceStatuses, sourceIdentity, sortSourceStatuses } from "./source-status";

it("loads old saved statuses with their original label", () => {
  expect(normalizeSourceStatuses([{ sourceId: "btc:0", label: "Main", status: "failed" }]))
    .toEqual([{ sourceId: "btc:0", label: "Main", status: "failed" }]);
  expect(sourceIdentity({ sourceId: "btc:0", label: "Main", status: "failed" })).toBe("Main");
});

it("rejects unmasked hints and upstream error text at the storage boundary", () => {
  const statuses = normalizeSourceStatuses([{
    sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance",
    hint: "full-api-key-secret", status: "failed", detail: "secret-token", category: "auth",
  }]);
  expect(JSON.stringify(statuses)).not.toContain("full-api-key-secret");
  expect(JSON.stringify(statuses)).not.toContain("secret-token");
});

it("loads older prefixed API key hints as masked values without English copy", () => {
  expect(normalizeSourceStatuses([{
    sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance",
    hint: "API key ab12…9xyz", status: "failed",
  }])).toEqual([{
    sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance",
    hint: "ab12…9xyz", status: "failed",
  }]);
});

it("orders failed sources before stale and current sources", () => {
  const statuses = [
    { sourceId: "a", label: "A", status: "ok" as const },
    { sourceId: "b", label: "B", status: "stale" as const },
    { sourceId: "c", label: "C", status: "failed" as const },
  ];
  expect(sortSourceStatuses(statuses).map((source) => source.sourceId)).toEqual(["c", "b", "a"]);
});

it("preserves only safe partial endpoint names from persisted statuses", () => {
  expect(normalizeSourceStatuses([
    { sourceId: "cex:0", label: "Gate", status: "partial", partial: {
      category: "network", endpoints: ["Earn", "https://secret.test/key", "Portfolio INTX"], lowerThanPrevious: true,
    } },
  ])).toEqual([
    { sourceId: "cex:0", label: "Gate", status: "partial", partial: {
      category: "network", endpoints: ["Earn", "Portfolio INTX"], lowerThanPrevious: true,
    } },
  ]);
});

it("drops a DEFAULT portfolio warning from saved partial status", () => {
  expect(normalizeSourceStatuses([{ sourceId: "cex:0", label: "Coinbase", status: "partial",
    partial: { category: "auth", endpoints: ["Portfolio DEFAULT", "Portfolio INTX"] } }])[0].partial?.endpoints)
    .toEqual(["Portfolio INTX"]);
});
