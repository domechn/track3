import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import SummaryMarketCard from "./summary-market-card";

vi.mock("@/middlelayers/charts-attribution-data", () => ({ queryAttribution: vi.fn() }));
vi.mock("@/middlelayers/charts", () => ({ queryLatestAssets: vi.fn().mockResolvedValue([]) }));

it("shows a whole-unit Summary range with its exact title and aligned amounts", async () => {
  vi.mocked(queryAttribution).mockResolvedValue({
    attribution: {
      entries: [{ symbol: "BTC", assetType: "crypto", wallet: "w",
        priceEffect: -3_434_659.1335, flowEffect: 8.625, residual: -7.125, totalChange: -3_434_657.6335 }],
      totals: { priceEffect: -3_434_659.1335, flowEffect: 8.625, residual: -7.125, totalChange: -3_434_657.6335 },
      startValue: 6_003_301.05, endValue: 22_503_902.94,
    },
    aliases: {},
  });
  render(<SummaryMarketCard mode="attribution"
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    dateRange={{ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    quoteColor="green-up-red-down"
  />);
  const table = await screen.findByRole("table", { name: "Profit attribution" });
  const total = within(table).getByRole("row", { name: /^Total/ });
  const [range, market, quantity, unexplained, totalChange] = within(total).getAllByRole("cell");
  expect(range).toHaveTextContent("$6,003,301 → $22,503,903");
  expect(range).toHaveAttribute("title", "$6,003,301.05 → $22,503,902.94");
  expect(market).toHaveTextContent("−$3,434,659");
  expect(market).toHaveAttribute("title", "−$3,434,659.13");
  expect(market.childNodes).toHaveLength(1);
  expect(quantity).toHaveTextContent("+$9");
  expect(quantity).toHaveAttribute("title", "+$8.63");
  expect(unexplained).toHaveTextContent("−$7");
  expect(unexplained).toHaveAttribute("title", "−$7.13");
  expect(totalChange).toHaveTextContent("−$3,434,658");
  expect(totalChange).toHaveAttribute("title", "−$3,434,657.63");
  for (const cell of [quantity, unexplained, totalChange]) expect(cell.childNodes).toHaveLength(1);
});

it("hides the unexplained column when every converted residual rounds to zero", async () => {
  vi.mocked(queryAttribution).mockResolvedValue({
    attribution: {
      entries: [{ symbol: "BTC", assetType: "crypto", wallet: "w",
        priceEffect: 2, flowEffect: 0, residual: 0.37, totalChange: 2.37 }],
      totals: { priceEffect: 2, flowEffect: 0, residual: 0.37, totalChange: 2.37 },
      startValue: 10, endValue: 12.37,
    },
    aliases: {},
  });
  render(<SummaryMarketCard mode="attribution"
    currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
    dateRange={{ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-31T23:59:59Z") }}
    quoteColor="green-up-red-down"
  />);
  const table = await screen.findByRole("table", { name: "Profit attribution" });
  expect(within(table).queryByRole("columnheader", { name: "Unexplained" })).not.toBeInTheDocument();
  expect(within(table).getByRole("row", { name: /^Total/ }).querySelectorAll('[role="cell"]')).toHaveLength(4);
});
