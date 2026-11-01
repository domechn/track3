import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CostBasisPanels, costBasisDisplayRows } from "./cost-basis-panels";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import en from "@/i18n/locales/en.json";

it("keeps unmatched withdrawal profit unknown while averaging only known sold lots", () => {
  const report = {
    method: "FIFO",
    assets: [],
    disposals: [
      { eventId: "sale-1", lotId: "lot-1", acquiredAt: "2025-01-01", disposedAt: "2026-01-01", term: "long", method: "FIFO", symbol: "BTC", assetType: "crypto", amount: 2, proceeds: 300, costBasis: 200, gainLoss: 100 },
      { eventId: "sale-2", lotId: "lot-2", acquiredAt: "2025-01-01", disposedAt: "2026-01-01", term: "long", method: "FIFO", symbol: "BTC", assetType: "crypto", amount: 1, proceeds: 180, costBasis: 120, gainLoss: 60 },
    ],
    warnings: [{ eventId: "withdrawal", date: "2026-01-01", symbol: "SOL", assetType: "crypto", code: "unknown-disposal", amount: 35 }],
    openLots: [],
    unrealized: [],
    totals: { proceeds: 480, costBasis: 320, gainLoss: 160, shortTerm: 0, longTerm: 160 },
  } satisfies CostBasisReport;
  expect(costBasisDisplayRows(report)).toEqual([
    { assetType: "crypto", symbol: "BTC", amount: 3, proceeds: 480, costBasis: 320, gainLoss: 160, avgBuy: 320 / 3, avgSell: 160 },
    { assetType: "crypto", symbol: "SOL", amount: null, proceeds: null, costBasis: null, gainLoss: null, avgBuy: null, avgSell: null },
  ]);
});

it("shows unknown profit when a sold asset also has an unmatched withdrawal", () => {
  const report = {
    method: "FIFO",
    assets: [],
    disposals: [
      { eventId: "sale", lotId: "lot", acquiredAt: "2025-01-01", disposedAt: "2026-01-01", term: "long", method: "FIFO", symbol: "BTC", assetType: "crypto", amount: 2, proceeds: 300, costBasis: 200, gainLoss: 100 },
    ],
    warnings: [{ eventId: "withdrawal", date: "2026-01-02", symbol: "BTC", assetType: "crypto", code: "unknown-disposal", amount: 1 }],
    openLots: [],
    unrealized: [],
    totals: { proceeds: 300, costBasis: 200, gainLoss: 100, shortTerm: 0, longTerm: 100 },
  } satisfies CostBasisReport;
  expect(costBasisDisplayRows(report)).toEqual([
    { assetType: "crypto", symbol: "BTC", amount: 2, proceeds: 300, costBasis: 200, gainLoss: null, avgBuy: 100, avgSell: 150 },
  ]);
});

it("keeps asset identities distinct and colors bars like gain/loss text", () => {
  const disposal = (assetType: "crypto" | "stock", gainLoss: number) => ({
    eventId: assetType, lotId: assetType, acquiredAt: "2025-01-01", disposedAt: "2026-01-01",
    term: "long" as const, method: "FIFO" as const, symbol: "BTC", assetType,
    amount: 1, proceeds: 100 + gainLoss, costBasis: 100, gainLoss,
  });
  const report = {
    method: "FIFO", assets: [], disposals: [disposal("crypto", 20), disposal("stock", -10)],
    warnings: [], openLots: [], unrealized: [],
    totals: { proceeds: 210, costBasis: 200, gainLoss: 10, shortTerm: 0, longTerm: 10 },
  } satisfies CostBasisReport;
  expect(costBasisDisplayRows(report).map(({ assetType, symbol }) => `${assetType}:${symbol}`))
    .toEqual(["crypto:BTC", "stock:BTC"]);
  const { container } = render(<CostBasisPanels report={report} quoteColor="red-up-green-down" t={(key) => key} />);
  const rows = container.querySelectorAll(".cost-dashboard-assets li");
  expect(rows).toHaveLength(2);
  expect(rows[0].querySelector(".cost-dashboard-bar > span")).toHaveClass("bg-negative");
  expect(rows[0].lastElementChild).toHaveClass("text-negative");
  expect(rows[1].querySelector(".cost-dashboard-bar > span")).toHaveClass("bg-positive");
  expect(rows[1].lastElementChild).toHaveClass("text-positive");
});

it("labels the sold-lot basis separately from bought-side average price", () => {
  const report = {
    method: "FIFO", assets: [], disposals: [],
    warnings: [], openLots: [], unrealized: [],
    totals: { proceeds: 0, costBasis: 0, gainLoss: 0, shortTerm: 0, longTerm: 0 },
  } satisfies CostBasisReport;
  const { container } = render(<CostBasisPanels report={report} quoteColor="green-up-red-down"
    t={(key) => en[key as keyof typeof en] ?? key} />);
  expect(container.querySelector(".cost-dashboard-prices h2")).toHaveTextContent(/sold lots/i);
});
