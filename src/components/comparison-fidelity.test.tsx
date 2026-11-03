import { render, screen } from "@testing-library/react";
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

describe("ComparisonFidelity", () => {
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
});
