import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ComparisonFidelity from "./comparison-fidelity";

vi.mock("./sync-status-indicator", () => ({ default: () => null }));

const currency = { currency: "USD", alias: "usd", symbol: "$", rate: 1 };
const row = { symbol: "BTC", assetType: "crypto" as const,
  amount: { base: 1, head: 1 }, price: { base: 100, head: 120 },
  value: { base: 100, head: 120, changePercent: 20 } };
const props = { currency, quoteColor: "green-up-red-down" as const, rows: [row],
  baseOption: { label: "2026-10-01", createdAt: "2026-10-01T09:41:00Z" },
  headOption: { label: "2026-10-31", createdAt: "2026-10-31T09:41:00Z" },
  basePicker: <button>Snapshot A</button>, headPicker: <button>Snapshot B</button>,
  baseTotal: 100, headTotal: 120, snapshotCount: 31, quickRange: "1M",
  onQuickRange: vi.fn(), onSwap: vi.fn(), onToggleMask: vi.fn(), onCopy: vi.fn() };

const moverRows = ([
  ["SCHD", 1.48, 100, "stock"], ["VIG", 1.30, 90, "stock"],
  ["USD", 0, 0, "stock"], ["XPL", -0.97, -20, "crypto"],
  ["QQQI", -1.29, -30, "stock"], ["USDT", -2.23, -4000, "crypto"],
  ["1211.HK", -2.44, -50, "stock"], ["BTC", -4, -318305, "crypto"],
  ["ETH", -5.19, -420, "crypto"], ["BNB", -6.92, -35571, "crypto"],
  ["PLUME", -6.92, -79, "crypto"],
] as const).map(([symbol, changePercent, delta, assetType]) => {
  const base = changePercent ? delta / (changePercent / 100) : 1000;
  return { ...row, symbol, assetType, isStable: symbol === "USDT",
    value: { base, head: base + delta, changePercent } };
});

describe("ComparisonFidelity", () => {
  it("uses the shared accent tag for top movers", () => {
    render(<ComparisonFidelity {...props} noTransactions={false} mask={false} />);
    expect(document.querySelector(".t3-cmp-top-mover")).toHaveClass("t3-tag");
    expect(document.querySelector(".t3-cmp-top-mover")).toHaveAttribute("data-tone", "accent");
  });

  it("exposes exact mover values on hover, including values rounded in the chart labels", () => {
    const { container } = render(<ComparisonFidelity {...props} rows={[{ ...row,
      value: { base: 100, head: 120.37, changePercent: 20.37 } }]} noTransactions={false} mask={false} />);
    const mover = container.querySelector(".t3-cmp-movers-card li")!;
    expect(mover.tagName).toBe("LI");
    expect(mover.querySelector("[data-chart-mark]")).toHaveAttribute("role", "button");
    fireEvent.pointerEnter(mover.querySelector("[data-chart-mark]")!, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("+$20.37");
    expect(screen.getByRole("tooltip")).toHaveTextContent("+20.37%");
  });
  it("only attributes an unchanged amount to price movement when the saved log has no transactions", () => {
    const { rerender } = render(<ComparisonFidelity {...props} noTransactions={false} mask={false} />);
    expect(screen.queryByText("Amounts are the same on both dates")).not.toBeInTheDocument();
    rerender(<ComparisonFidelity {...props} noTransactions mask={false} />);
    expect(screen.getByText("Amounts are the same on both dates")).toBeInTheDocument();
  });

  it("masks prices and values together when hide-values is active", () => {
    const { container } = render(<ComparisonFidelity {...props} noTransactions mask />);
    expect(container.textContent).toContain("***");
    expect(container.textContent).not.toContain("$100");
    expect(container.textContent).not.toContain("$120");
  });

  it("does not reveal the remaining mover count when values are hidden", () => {
    const { container } = render(<ComparisonFidelity {...props} rows={moverRows} noTransactions={false} mask />);
    expect([...container.querySelectorAll(".t3-cmp-movers-more")].map((button) => button.textContent))
      .toEqual(["Show More", "Show More"]);
  });

  it("shows ten mover rows and expands the remaining asset inside each card", () => {
    const { container } = render(<ComparisonFidelity {...props} rows={moverRows} noTransactions={false} mask={false} />);
    const cards = container.querySelectorAll(".t3-cmp-movers-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelectorAll("li")).toHaveLength(10);
    expect(cards[1].querySelectorAll("li")).toHaveLength(10);
    expect(screen.getAllByRole("button", { name: /and 1 more/i })).toHaveLength(2);
    expect([...cards[0].querySelectorAll("li .t3-asset-label-name")].map((node) => node.textContent))
      .toEqual(["BTC", "BNB", "USDT", "ETH", "SCHD", "VIG", "PLUME", "1211.HK", "QQQI", "XPL"]);
    expect([...cards[1].querySelectorAll("li .t3-asset-label-name")].map((node) => node.textContent))
      .toEqual(["BNB", "PLUME", "ETH", "BTC", "1211.HK", "USDT", "SCHD", "VIG", "QQQI", "XPL"]);
    expect(cards[0].querySelector("li > span:last-of-type")?.textContent).toBe("−$318,305");
    expect(cards[1].querySelector("li > span:last-of-type")?.textContent).toBe("−6.92%");
    expect(cards[0].querySelector("p")?.textContent).toContain("BTC and BNB made 99%");
    expect(cards[1].querySelector("p")?.textContent).toContain("SCHD rose most");
    for (const button of screen.getAllByRole("button", { name: /and 1 more/i })) {
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    }
    expect([...cards[0].querySelectorAll("li .t3-asset-label-name")].map((node) => node.textContent))
      .toEqual(["BTC", "BNB", "USDT", "ETH", "SCHD", "VIG", "PLUME", "1211.HK", "QQQI", "XPL", "USD"]);
    expect([...cards[1].querySelectorAll("li .t3-asset-label-name")].map((node) => node.textContent))
      .toEqual(["BNB", "PLUME", "ETH", "BTC", "1211.HK", "USDT", "SCHD", "VIG", "QQQI", "XPL", "USD"]);
  });

  it("uses the flagged stable asset's actual percentage in the note", () => {
    const { container } = render(<ComparisonFidelity {...props} rows={moverRows} noTransactions={false} mask={false} />);
    expect(container.querySelector(".t3-cmp-movers-card:last-child p")?.textContent).toContain("USDT");
    expect(container.querySelector(".t3-cmp-movers-card:last-child p")?.textContent).toContain("−2.23%");
    expect(container.querySelector(".t3-cmp-movers-card:last-child p")?.textContent).not.toContain("±0.01%");
  });
});
