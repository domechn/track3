import { render, screen } from "@testing-library/react";
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
});
