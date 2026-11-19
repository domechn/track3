import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import OverviewFidelity from "./overview-fidelity";
import { queryHistoricalData, queryLatestAssetsPercentage, queryTotalValue, queryTotalValues } from "@/middlelayers/charts";

vi.mock("@/middlelayers/charts", () => ({
  queryHistoricalData: vi.fn(), queryLatestAssetsPercentage: vi.fn(),
  queryTotalValue: vi.fn(), queryTotalValues: vi.fn(), queryAssetChange: vi.fn(),
}));
vi.mock("@/middlelayers/configuration", () => ({
  loadAIConfig: vi.fn(async () => ({})),
  getConfiguration: vi.fn(async () => ({ configs: { groupUSD: false }, others: [] })),
}));
vi.mock("@/middlelayers/license", () => ({ isProVersion: vi.fn(async () => ({ isPro: false })) }));
vi.mock("@/middlelayers/data", () => ({ listPortfolioSources: vi.fn(() => []) }));
vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: { subscribe: () => () => {}, status: () => syncStatus },
}));
vi.mock("@/components/source-name-order", () => ({
  useLatestWalletOrdinals: () => ordinals,
}));

const syncStatus = { mode: "off" };
const ordinals = {};

it("hides phone overview dust without changing the total", async () => {
  const at = "2026-10-31T09:41:00.000Z";
  vi.mocked(queryTotalValues).mockResolvedValue([
    { timestamp: Date.parse(at) - 86400000, totalValue: 900 },
    { timestamp: Date.parse(at), totalValue: 1000.9 },
  ] as never);
  vi.mocked(queryHistoricalData).mockResolvedValue([
    { id: "latest", createdAt: at, total: 1000.9,
      assets: [{ id: 1, uuid: "latest", createdAt: at, symbol: "BTC",
        assetType: "crypto", amount: 1, price: 1000, value: 1000 }], transactions: [] },
  ] as never);
  vi.mocked(queryLatestAssetsPercentage).mockResolvedValue([
    { coin: "BTC", assetType: "crypto", amount: 1, value: 1000, percentage: 99.9, chartColor: "red" },
    { coin: "USD", assetType: "stock", amount: 0.5, value: 0.5, percentage: 0.05, chartColor: "red" },
    { coin: "DUST", assetType: "crypto", amount: 1, value: 0.4, percentage: 0.04, chartColor: "red" },
  ]);
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 1000.9, excludedSources: [] } as never);
  const dateRange = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") };
  render(<MemoryRouter><OverviewFidelity currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    dateRange={dateRange} allTimeRange={dateRange} quoteColor="green-up-red-down" /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("small-holdings-toggle")).toHaveTextContent("Show 1 small holdings"));
  expect(document.querySelectorAll(".fd-overview-holdings .fd-overview-row")).toHaveLength(2);
  expect(document.querySelector(".fd-overview-value")).toHaveTextContent("$1,000.90");
  fireEvent.click(screen.getByTestId("small-holdings-toggle"));
  expect(document.querySelectorAll(".fd-overview-holdings .fd-overview-row")).toHaveLength(3);
});
