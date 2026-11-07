import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SummaryTopList } from "./summary-top-list";

it("keeps ticker, bar, amount, and a bounded percentage in each row", () => {
  const { container } = render(<SummaryTopList heading="Top loss" rows={[
    { assetType: "stock", symbol: "1211.HK", value: -109_628, percentage: -1840.4, stable: false },
    { assetType: "crypto", symbol: "IOTA", value: -1, percentage: -0.1, stable: false },
  ]} amount={(value) => `−$${Math.abs(value).toLocaleString("en-US")}`}
    tone={() => "loss"} />);
  const rows = container.querySelectorAll(".summary-top-row");
  expect(rows).toHaveLength(2);
  expect(rows[0].children).toHaveLength(4);
  expect(rows[0].querySelector(".summary-top-track i")).toBeInTheDocument();
  expect(screen.getByText("<-999%")).toHaveAttribute("title", "−1,840.4%");
  expect(screen.getByText("<-999%")).toHaveAttribute("aria-label", "−1,840.4%");
  expect(container.querySelectorAll(".summary-top-axis")).toHaveLength(1);
});

it("shows no market P&L for stablecoin rows", () => {
  render(<SummaryTopList heading="No market P&L" rows={[
    { assetType: "crypto", symbol: "USDT", value: 14, percentage: 0, stable: true },
  ]} amount={(value) => `$${value}`} tone={() => "neutral"} />);
  expect(screen.getByRole("row", { name: /USDT/ })).toHaveTextContent("$0");
  expect(document.querySelector(".summary-top-track i")).not.toBeInTheDocument();
});

it("spans the three accessible data columns with its section heading", () => {
  render(<div role="table"><SummaryTopList heading="Top profit" rows={[
    { assetType: "crypto", symbol: "BTC", value: 10, percentage: 10, stable: false },
  ]} amount={(value) => `$${value}`} tone={() => "gain"} /></div>);
  expect(screen.getByRole("row", { name: "Top profit" }).querySelector('[role="cell"]')).toHaveAttribute("aria-colspan", "3");
});
