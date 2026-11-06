import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ComparisonMoversPanel from "./comparison-movers-panel";

const currency = { currency: "USD", alias: "usd", symbol: "$", rate: 1 };
const rows = [
  { symbol: "BTC", assetType: "crypto" as const, value: { base: 100, head: 150, changePercent: 50 } },
  { symbol: "ETH", assetType: "crypto" as const, value: { base: 100, head: 75, changePercent: -25 } },
];

describe("ComparisonMoversPanel", () => {
  it("shows no amounts or percentages when values are hidden", () => {
    const { container } = render(<ComparisonMoversPanel rows={rows} currency={currency}
      quoteColor="green-up-red-down" t={(key) => key} shouldMaskValue />);
    expect(screen.getAllByText("***").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toContain("$");
  });
  it("keeps both ranked lists to ten rows until expanded", () => {
    const many = Array.from({ length: 11 }, (_, index) => ({
      symbol: `ASSET${index}`, assetType: "crypto" as const,
      value: { base: 100, head: 100 + index + 1, changePercent: index + 1 },
    }));
    const { container } = render(<ComparisonMoversPanel rows={many} currency={currency}
      quoteColor="green-up-red-down" t={(key) => key === "comparison.fidelity.andMore" ? "and {count} more" : key}
      shouldMaskValue={false} />);
    expect(container.querySelectorAll(".comparison-movers section:first-child li")).toHaveLength(10);
    const more = screen.getAllByRole("button", { name: "and 1 more" })[0];
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelectorAll(".comparison-movers section:first-child li")).toHaveLength(11);
  });

  it("hides the cards when every asset is unchanged", () => {
    const { container } = render(<ComparisonMoversPanel rows={[
      { symbol: "USD", assetType: "stock", value: { base: 100, head: 100, changePercent: 0 } },
    ]} currency={currency} quoteColor="green-up-red-down" t={(key) => key} shouldMaskValue={false} />);
    expect(container.querySelector(".comparison-movers")).not.toBeInTheDocument();
  });

  it("shows an unchanged asset only after expansion and renders no zero bar", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      symbol: `ASSET${index}`, assetType: "crypto" as const,
      value: { base: 100, head: 110 + index, changePercent: 10 + index },
    }));
    const { container } = render(<ComparisonMoversPanel rows={[
      { symbol: "USD", assetType: "stock", value: { base: 100, head: 100, changePercent: 0 } },
      ...many,
    ]} currency={currency} quoteColor="green-up-red-down"
      t={(key) => key === "comparison.fidelity.andMore" ? "and {count} more" : key}
      shouldMaskValue={false} />);
    const first = container.querySelector(".comparison-movers section:first-child")!;
    expect(first.querySelectorAll("li")).toHaveLength(10);
    fireEvent.click(screen.getAllByRole("button", { name: "and 1 more" })[0]);
    expect(first.querySelector("li:last-child strong")).toHaveTextContent("USD");
    expect(first.querySelector("li:last-child .comparison-mover-track > span")).not.toBeInTheDocument();
  });

  it("does not reveal the number of hidden rows through the expansion buttons", () => {
    const many = Array.from({ length: 11 }, (_, index) => ({
      symbol: `ASSET${index}`, assetType: "crypto" as const,
      value: { base: 100, head: 101 + index, changePercent: index + 1 },
    }));
    const { container } = render(<ComparisonMoversPanel rows={many} currency={currency}
      quoteColor="green-up-red-down" t={(key) => key === "common.showMore" ? "Show More" :
        key === "comparison.fidelity.andMore" ? "and {count} more" : key} shouldMaskValue />);
    expect(container.querySelectorAll(".comparison-movers-more")).toHaveLength(2);
    expect([...container.querySelectorAll(".comparison-movers-more")].map((button) => button.textContent))
      .toEqual(["Show More", "Show More"]);
  });
});
