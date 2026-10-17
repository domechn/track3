import { beforeEach, expect, it, vi } from "vitest";
import { loadCostBasisReport, exportCostBasisReport } from "./cost-basis-data";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { ASSET_HANDLER } from "./entities/assets";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: { listTransactions: vi.fn() },
}));
vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: { listAssets: vi.fn() },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const localNoon = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12).toISOString();

it("loads the full transaction history and latest local price", async () => {
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "a", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 2, price: 100, txnCreatedAt: localNoon(2024, 1, 1) },
    { id: 2, uuid: "b", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "sell", amount: 1, price: 200, txnCreatedAt: localNoon(2025, 1, 1) },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
    [{ id: 9, uuid: "snapshot", createdAt: localNoon(2025, 1, 2), symbol: "BTC", assetType: "crypto", amount: 1, price: 300, value: 300, wallet: "w" }],
  ]);
  const report = await loadCostBasisReport({ method: "FIFO", from: "2025-01-01", to: "2025-12-31" });
  expect(report.totals.gainLoss).toBe(100);
  expect(report.unrealized[0].gainLoss).toBe(200);
});

it("does not value open lots at a missing zero snapshot price", async () => {
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "a", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 1, price: 100, txnCreatedAt: localNoon(2024, 1, 1) },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
    [{ id: 9, uuid: "snapshot", createdAt: localNoon(2025, 1, 2), symbol: "BTC", assetType: "crypto", amount: 1, price: 0, value: 0, wallet: "w" }],
  ]);
  const report = await loadCostBasisReport({ method: "FIFO" });
  expect(report.unrealized).toEqual([]);
});

it("matches a latest price when the stored symbol has surrounding spaces", async () => {
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "a", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 1, price: 100, txnCreatedAt: localNoon(2024, 1, 1) },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([
    [{ id: 9, uuid: "snapshot", createdAt: localNoon(2025, 1, 2), symbol: " BTC ", assetType: "crypto", amount: 1, price: 300, value: 300, wallet: "w" }],
  ]);
  const report = await loadCostBasisReport({ method: "FIFO" });
  expect(report.unrealized).toEqual([expect.objectContaining({ symbol: "BTC", gainLoss: 200 })]);
});

it("does not pair a withdrawal with a deposit after the report end date", async () => {
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "a", txnType: "buy", amount: 1, price: 100, txnCreatedAt: localNoon(2024, 1, 1) },
    { id: 2, uuid: "out", assetType: "crypto", symbol: "BTC", wallet: "a", txnType: "withdraw", amount: 1, price: 150, txnCreatedAt: localNoon(2024, 12, 31) },
    { id: 3, uuid: "in", assetType: "crypto", symbol: "BTC", wallet: "b", txnType: "deposit", amount: 1, price: 150, txnCreatedAt: localNoon(2025, 1, 1) },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([]);
  const report = await loadCostBasisReport({ method: "FIFO", to: "2024-12-31" });
  expect(report.warnings.map((warning) => warning.code)).toEqual(["unknown-disposal"]);
  expect(report.openLots).toEqual([]);
});

it("writes the displayed realized rows through the Tauri dialog and file API", async () => {
  vi.mocked(save).mockResolvedValue("/tmp/tax.csv");
  const report = {
    method: "FIFO", from: "2025-01-01", to: "2025-12-31",
    disposals: [{ eventId: "b", lotId: "a", assetType: "crypto", symbol: "BTC", acquiredAt: localNoon(2024, 1, 1), disposedAt: localNoon(2025, 1, 1), amount: 1, proceeds: 200, costBasis: 100, gainLoss: 100, term: "long", method: "FIFO" }],
    warnings: [], openLots: [], unrealized: [], assets: [],
    totals: { proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 0, longTerm: 100 },
  } as import("./cost-basis-report").CostBasisReport;
  expect(await exportCostBasisReport(report, "csv")).toBe(true);
  expect(vi.mocked(writeTextFile).mock.calls[0][1]).toContain("BTC,2024-01-01,2025-01-01,1,200.00,100.00,100.00,long,FIFO");
});

it("redacts embedded credentials from exported CSV", async () => {
  vi.mocked(save).mockResolvedValue("/tmp/gains.csv");
  const report = {
    method: "FIFO", from: "2025-01-01", to: "2025-12-31",
    disposals: [{ symbol: "sk-abcdefghijklmnop1234567890", assetType: "crypto", acquiredAt: "2024-01-01", disposedAt: "2025-01-01",
      amount: 1, proceeds: 200, costBasis: 100, gainLoss: 100, term: "long", method: "FIFO", eventId: "x", lotId: "a" }],
    warnings: [], openLots: [], unrealized: [], assets: [],
    totals: { proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 0, longTerm: 100 },
  } as unknown as import("./cost-basis-report").CostBasisReport;
  await exportCostBasisReport(report, "csv");
  expect(String(vi.mocked(writeTextFile).mock.calls[0]?.[1])).not.toContain("sk-abcdefghijklmnop1234567890");
});

it("preserves JSON event and lot IDs while redacting embedded credentials", async () => {
  vi.mocked(save).mockResolvedValue("/tmp/gains.json");
  const eventId = "0123456789abcdef0123456789abcdef";
  const lotId = "abcdef0123456789abcdef0123456789";
  const report = {
    method: "FIFO", from: "2025-01-01", to: "2025-12-31",
    disposals: [{ symbol: "LONGCRYPTOSYMBOL0123456789ABCDEF012345", assetType: "crypto",
      acquiredAt: "2024-01-01", disposedAt: "2025-01-01", amount: 1,
      proceeds: 200, costBasis: 100, gainLoss: 100, term: "long", method: "FIFO", eventId, lotId },
    { symbol: "sk-abcdefghijklmnop1234567890", assetType: "crypto",
      acquiredAt: "2024-01-01", disposedAt: "2025-01-01", amount: 1,
      proceeds: 200, costBasis: 100, gainLoss: 100, term: "long", method: "FIFO", eventId: "other", lotId: "other" }],
    warnings: [], openLots: [], unrealized: [], assets: [],
    totals: { proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 0, longTerm: 100 },
  } as unknown as import("./cost-basis-report").CostBasisReport;
  await exportCostBasisReport(report, "json");
  const exported = JSON.parse(String(vi.mocked(writeTextFile).mock.calls[0]?.[1]));
  expect(exported.disposals[0]).toMatchObject({ eventId, lotId, symbol: "LONGCRYPTOSYMBOL0123456789ABCDEF012345" });
  expect(exported.disposals[1].symbol).toBe("<REDACTED>");
});
