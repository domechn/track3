import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CoinSourcesTable, CoinLotsTable } from "./coin-detail-sections";

const labels = {
  holdings: "Holdings by source", source: "Source", quantity: "Quantity", value: "Value",
  share: "Share", total: "Total", empty: (n: number) => `${n} sources with no balance`,
  sourceCount: (n: number) => `${n} ${n === 1 ? "source" : "sources"}`,
  others: "Others", openLots: "Open lots", acquired: "Acquired", costPrice: "Cost price",
  unrealized: "Unrealized", showAll: (n: number) => `Show all ${n} lots`,
  showLess: "Show fewer lots",
};
const source = (index: number, value: number) => ({
  id: `wallet-${index}`, label: `Wallet ${index}`, kind: "Wallet", amount: value, value,
});
const money = (value: number) => `$${value.toFixed(2)}`;
const quantity = (value: number) => value.toFixed(4);

describe("CoinSourcesTable", () => {
  for (const [count, positive] of [[0, 0], [1, 1], [3, 2], [16, 2]] as const) {
    it(`collapses zero balances among ${count} sources and keeps displayed shares totaling 100%`, async () => {
      const sources = Array.from({ length: count }, (_, index) => source(index + 1, index < positive ? index + 1 : 0));
      render(<CoinSourcesTable sources={sources} labels={labels} money={money} quantity={quantity} />);
      const table = screen.getByRole("table", { name: "Holdings by source" });
    expect(table.parentElement).toHaveAttribute("tabindex", "0");
      const rows = within(table).getAllByRole("row");
      expect(rows).toHaveLength(1 + positive + (count - positive > 0 ? 1 : 0) + 1);
      const percentages = rows.slice(1, -1).flatMap((row) => [...row.querySelectorAll("td")].slice(-1)
        .filter((cell) => cell.textContent?.endsWith("%")).map((cell) => Number(cell.textContent?.replace("%", ""))));
      expect(percentages.reduce((sum, value) => sum + value, 0)).toBe(positive ? 100 : 0);
      expect(within(rows.at(-1)!).getByText(positive ? "100.0%" : "0.0%")).toBeVisible();
      if (count > positive) {
        const toggle = screen.getByRole("button", { name: `${count - positive} sources with no balance` });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(within(table).getAllByRole("row")).toHaveLength(1 + count + 1 + 1);
        if (count === 3) {
          toggle.focus();
          await userEvent.keyboard("{Enter}");
          expect(toggle).toHaveAttribute("aria-expanded", "false");
        }
      }
    });
  }

  it("keeps the nine largest non-zero sources and aggregates the rest", () => {
    render(<CoinSourcesTable sources={Array.from({ length: 12 }, (_, index) => source(index + 1, index + 1))}
      labels={labels} money={money} quantity={quantity} />);
    const rows = within(screen.getByRole("table", { name: "Holdings by source" })).getAllByRole("row");
    expect(rows).toHaveLength(12);
    expect(rows[1]).toHaveTextContent("Wallet 12");
    expect(rows[10]).toHaveTextContent("Others");
    expect(rows[10]).toHaveTextContent("$6.00");
    expect(rows.slice(1, -1).reduce((sum, row) => sum + Number(row.lastElementChild!.textContent!.replace("%", "")), 0)).toBe(100);
  });

  it("keeps tiny Others shares non-negative after rounding", () => {
    const values = [...Array(8).fill(11.051), 11.251, 0.1137, 0.1137, 0.1136];
    render(<CoinSourcesTable sources={values.map((value, index) => source(index + 1, value))}
      labels={labels} money={money} quantity={quantity} />);
    const rows = within(screen.getByRole("table", { name: "Holdings by source" })).getAllByRole("row");
    const shares = rows.slice(1, -1).map((row) => Number(row.lastElementChild!.textContent!.replace("%", "")));
    expect(shares.every((share) => share >= 0)).toBe(true);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
  });
});

describe("CoinLotsTable", () => {
  for (const count of [2, 8, 30]) {
    it(`shows at most eight of ${count} lots until expanded`, async () => {
      const rows = Array.from({ length: count }, (_, index) => ({
        id: String(index), acquired: `Day ${index}`, amount: quantity(index + 1), cost: money(index + 1),
        unrealized: money(index + 1), tone: "positive",
      }));
      render(<CoinLotsTable rows={rows} labels={labels} lotCount={`FIFO · ${count} lots`} />);
      const table = screen.getByRole("table", { name: "Open lots" });
      expect(within(table).getAllByRole("row")).toHaveLength(1 + Math.min(count, 8));
      if (count > 8) {
        const toggle = screen.getByRole("button", { name: `Show all ${count} lots` });
        await userEvent.click(toggle);
        expect(within(table).getAllByRole("row")).toHaveLength(1 + count);
        expect(table.parentElement).toHaveAttribute("role", "region");
        expect(table.parentElement).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("button", { name: "Show fewer lots" })).toBeVisible();
      }
    });
  }
});
