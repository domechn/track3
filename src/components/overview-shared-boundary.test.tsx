import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { DailyChangeCard, TopCoinsCard } from "./overview-panels";

const usd = { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" };

it("keeps the shared daily chart scaled to its own values by default", () => {
  render(<DailyChangeCard currency={usd} daily={[
    { timestamp: Date.parse("2026-10-29"), value: 120 },
    { timestamp: Date.parse("2026-10-30"), value: -30 },
  ]} />);
  const up = screen.getByRole("img", { name: /daily change chart/i }).querySelector(".t3-daily-up") as HTMLElement;
  expect(up.style.height).toBe("48%");
  expect(screen.queryByText("overview.fidelity.up")).not.toBeInTheDocument();
});

it("shows the shared coin row with a 20px asset tile by default", () => {
  render(<MemoryRouter><TopCoinsCard currency={usd} rows={[
    { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, priceChange: 5 },
  ]} /></MemoryRouter>);
  const row = screen.getByTestId("overview-coin-row");
  expect(row.querySelector(".t3-asset-icon")).toHaveAttribute("data-size", "20");
  expect(row.querySelector(".t3-asset-label-name")).toHaveTextContent("BTC");
});

it("keeps the shared coin change sign for a small nonzero change", () => {
  render(<MemoryRouter><TopCoinsCard currency={usd} rows={[
    { symbol: "BTC", assetType: "crypto", value: 100, amount: 1, priceChange: 0.01 },
  ]} /></MemoryRouter>);
  expect(screen.getByTestId("overview-coin-row").querySelector(".text-gain")).toHaveTextContent("+0.0%");
});
