import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InsightsCard from "./insights-card";
import { loadInsightCard } from "@/middlelayers/insights-service";

vi.mock("@/middlelayers/insights-service", async () => ({
  ...await vi.importActual<typeof import("@/middlelayers/insights-service")>("@/middlelayers/insights-service"),
  loadInsightCard: vi.fn(),
  dismissInsight: vi.fn(),
  formatInsight: vi.fn(() => "fallback"),
  refreshInsights: vi.fn(),
}));
vi.mock("@/middlelayers/rebalance", async () => ({
  ...await vi.importActual<typeof import("@/middlelayers/rebalance")>("@/middlelayers/rebalance"),
  getRebalanceProfile: vi.fn(async () => ({
    targets: [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
    ],
    tolerancePercent: 0,
  })),
  loadRebalanceHoldings: vi.fn(async () => ({
    holdings: [
      { symbol: "BTC", assetType: "crypto", amount: 1, value: 30, price: 30 },
      { symbol: "ETH", assetType: "crypto", amount: 1, value: 70, price: 70 },
    ],
    stablecoinSymbols: [],
  })),
}));
vi.mock("@/middlelayers/charts-history", () => ({
  queryHistoricalPage: vi.fn(async () => ({
    totalCount: 1, rows: [{ id: "latest", createdAt: "2026-10-31T09:41:00.000Z", total: 100 }],
  })),
}));
vi.mock("@/middlelayers/charts-assets", () => ({
  queryLastRefreshAt: vi.fn(async () => "2026-10-31T09:41:00.000Z"),
}));

it("uses the rebalance portfolio for the assistant trade hint", async () => {
  vi.mocked(loadInsightCard).mockResolvedValue({
    snapshotUuid: "latest", dismissedIds: [],
    insights: [{ id: "drift-btc", severity: "info", messageKey: "insights.drift", data: { symbol: "BTC", deviationPercent: -20 } }],
  });
  render(<InsightsCard assistantView currency={{ currency: "USD", rate: 1, symbol: "$", alias: "USD" }} />);
  expect(await screen.findByText(/Buying \$20\.00 of BTC/)).toBeInTheDocument();
});
