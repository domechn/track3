import { afterEach, expect, it, vi } from "vitest";
import { buildCostBasisReport, serializeRealizedGains } from "./cost-basis-report";
import type { CostBasisEvent } from "./cost-basis";

const events: CostBasisEvent[] = [
  { id: "buy", date: "2024-12-01T00:00:00Z", type: "buy", assetType: "crypto", symbol: "BTC", wallet: "w", amount: 2, price: 100 },
  { id: "old", date: "2024-12-15T00:00:00Z", type: "sell", assetType: "crypto", symbol: "BTC", wallet: "w", amount: 1, price: 150 },
  { id: "new", date: "2025-06-01T00:00:00Z", type: "sell", assetType: "crypto", symbol: "BTC", wallet: "w", amount: 1, price: 200 },
];

afterEach(() => vi.unstubAllEnvs());

it("filters disposals by the user's local tax date", () => {
  vi.stubEnv("TZ", "Asia/Shanghai");
  const report = buildCostBasisReport([
    { ...events[0], date: "2024-12-01T00:00:00Z" },
    { ...events[1], date: "2024-12-31T15:00:00Z" },
    { ...events[2], date: "2024-12-31T17:00:00Z" },
  ], { method: "FIFO", from: "2025-01-01", to: "2025-12-31" });
  expect(report.disposals.map((row) => row.eventId)).toEqual(["new"]);
  expect(report.totals.gainLoss).toBe(100);
  expect(serializeRealizedGains(report, "csv")).toContain("2025-01-01");
});

it("keeps invalid events as warnings when an end date is selected", () => {
  const report = buildCostBasisReport([
    { ...events[0], date: "invalid" },
  ], { method: "FIFO", to: "2025-12-31" });
  expect(report.warnings).toContainEqual(expect.objectContaining({ code: "invalid-event", eventId: "buy" }));
});

it("uses earlier acquisitions and disposals to determine the selected year's gain", () => {
  const report = buildCostBasisReport(events, {
    method: "FIFO", from: "2025-01-01", to: "2025-12-31",
  });
  expect(report.disposals).toEqual([
    expect.objectContaining({ eventId: "new", costBasis: 100, proceeds: 200, gainLoss: 100 }),
  ]);
  expect(report.totals).toMatchObject({ proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 100, longTerm: 0 });
  expect(report.assets).toEqual([
    expect.objectContaining({ symbol: "BTC", proceeds: 200, costBasis: 100, gainLoss: 100 }),
  ]);
});

it("limits dated warnings to the selected date range in the report and JSON", () => {
  const report = buildCostBasisReport([
    { ...events[0], amount: 1 },
    { ...events[1], amount: 2 },
    { ...events[2], amount: 1 },
  ], { method: "FIFO", from: "2025-01-01", to: "2025-12-31" });
  expect(report.warnings).toEqual([
    expect.objectContaining({ code: "missing-lots", eventId: "new", date: events[2].date }),
  ]);
  expect(JSON.parse(serializeRealizedGains(report, "json")).warnings).toEqual(report.warnings);
});

it("exports Form 8949-like CSV with escaped fields and the same rows as JSON", () => {
  const report = buildCostBasisReport([
    { ...events[0], symbol: "=BTC,\"spot\"" },
    { ...events[2], symbol: "=BTC,\"spot\"" },
  ], { method: "FIFO" });
  const csv = serializeRealizedGains(report, "csv");
  expect(csv).toContain("Asset,Acquired Date,Disposed Date,Quantity,Proceeds,Cost Basis,Gain/Loss,Term,Method");
  expect(csv).toContain("\"'=BTC,\"\"SPOT\"\"\"");
  const json = JSON.parse(serializeRealizedGains(report, "json"));
  expect(json.disposals).toEqual(report.disposals);
  expect(json.method).toBe("FIFO");
});

it("keeps negative gain values numeric in CSV", () => {
  const report = buildCostBasisReport([
    events[0],
    { ...events[2], price: 50 },
  ], { method: "FIFO" });
  expect(serializeRealizedGains(report, "csv")).toContain(",1,50.00,100.00,-50.00,short,FIFO");
});

it("rounds quantities to eight places and USD values to cents in CSV", () => {
  const report = buildCostBasisReport([
    { ...events[0], amount: 0.1, price: 100.123 },
    { ...events[2], amount: 0.1, price: 200.129 },
  ], { method: "FIFO" });
  expect(serializeRealizedGains(report, "csv")).toContain(",0.1,20.01,10.01,10.00,short,FIFO");
});

it("does not export a nonzero tiny disposal as zero quantity", () => {
  const report = buildCostBasisReport([
    { ...events[0], amount: 5e-11, price: 100 },
    { ...events[2], amount: 5e-11, price: 200 },
  ], { method: "FIFO" });
  expect(serializeRealizedGains(report, "csv")).toContain(",5e-11,");
});

it("makes the exported gain equal the rounded proceeds less rounded basis", () => {
  const report = buildCostBasisReport([
    { ...events[0], amount: 1, price: 5.004 },
    { ...events[2], amount: 1, price: 10.006 },
  ], { method: "FIFO" });
  const [, row] = serializeRealizedGains(report, "csv").trim().split("\n");
  const fields = row.split(",");
  expect(fields.slice(4, 7)).toEqual(["10.01", "5.00", "5.01"]);
});
