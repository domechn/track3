import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { PartialProfitHint, PnlPercentHint, hasVisibleUnrecordedChange } from "./profit-summary-hints";

it("shows an unrecorded amount only when it reaches half a cent in display currency", () => {
  expect(hasVisibleUnrecordedChange(0.004, { currency: "USD", symbol: "$", rate: 1, alias: "USD" })).toBe(false);
  expect(hasVisibleUnrecordedChange(-0.004, { currency: "EUR", symbol: "€", rate: 2, alias: "EUR" })).toBe(true);
});

it("keeps the percentage explanation in one expandable panel popover", () => {
  render(<I18nProvider><PnlPercentHint names={Array.from({ length: 60 }, (_, i) => `COIN${i}`)} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "How P&L % is calculated" }));
  const hint = screen.getByRole("tooltip");
  expect(hint).toHaveTextContent("opening value plus recorded buys and deposits");
  expect(hint).toHaveTextContent("COIN0, COIN1, COIN2, COIN3, COIN4, COIN5, COIN6, COIN7 and 52 more");
  expect(hint).not.toHaveTextContent("COIN59");
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(hint).toHaveTextContent("COIN59");
});

it("keeps a long partial coin list behind the same eight-name preview", () => {
  const names = Array.from({ length: 60 }, (_, i) => `COIN${i}`);
  render(<I18nProvider><PartialProfitHint names={names} period="Jun" t={(key) => ({
    "profitSummary.explain": "Explain partial profit for {period}",
    "profitSummary.partialReasonMany": "These coins have withdrawals without matching deposits.",
    "profitSummary.partialFixMany": "Pair the withdrawals in History to include them.",
    "profitSummary.coinMore": "and {n} more",
    "profitSummary.showAll": "Show all",
    "profitSummary.showLess": "Show less",
  }[key] ?? key)} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for Jun" }));
  const hint = screen.getByRole("tooltip");
  expect(hint).toHaveTextContent("COIN0, COIN1, COIN2, COIN3, COIN4, COIN5, COIN6, COIN7 and 52 more");
  expect(hint).not.toHaveTextContent("COIN59");
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(hint).toHaveTextContent("COIN59");
});

it("identifies the affected month and interval for a partial year", () => {
  render(<I18nProvider><PartialProfitHint names={["BTC"]} period="2024"
    affected={[{ symbol: "BTC", intervals: ["2024-03-15T00:00:00.000Z"], months: 1 }]}
    t={(key) => ({
      "profitSummary.explain": "Explain partial profit for {period}",
      "profitSummary.partialIntervals": "{n} affected month(s)",
      "profitSummary.partialIntervalReasonOne": "Only the affected interval is excluded:",
      "profitSummary.partialFixOne": "Pair the withdrawal in History to include it.",
      "profitSummary.coinMore": "and {n} more",
      "profitSummary.showAll": "Show all",
      "profitSummary.showLess": "Show less",
    }[key] ?? key)} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for 2024" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("1 affected month(s)");
  expect(screen.getByRole("tooltip")).toHaveTextContent("BTC");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Mar");
});

it("previews eight affected intervals and lets the user reveal the rest", () => {
  const intervals = Array.from({ length: 60 }, (_, day) =>
    new Date(Date.UTC(2024, 0, day + 1)).toISOString());
  render(<I18nProvider><PartialProfitHint names={["BTC"]} period="2024"
    affected={[{ symbol: "BTC", intervals, months: 2 }]}
    t={(key) => ({
      "profitSummary.explain": "Explain partial profit for {period}",
      "profitSummary.partialIntervals": "{n} affected month(s)",
      "profitSummary.coinMore": "and {n} more",
      "profitSummary.showAll": "Show all",
      "profitSummary.showLess": "Show less",
    }[key] ?? key)} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Explain partial profit for 2024" }));
  const hint = screen.getByRole("tooltip");
  expect(hint).toHaveTextContent("Jan 1, 2024");
  expect(hint).toHaveTextContent("and 52 more");
  expect(hint).not.toHaveTextContent("Feb 29, 2024");
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(hint).toHaveTextContent("Feb 29, 2024");
});

it("uses the active Chinese locale for affected interval dates", () => {
  localStorage.setItem("track3-ui-locale", "zh");
  try {
    render(<I18nProvider><PartialProfitHint names={["BTC"]} period="2024"
      affected={[{ symbol: "BTC", intervals: ["2024-03-15T00:00:00.000Z"] }]}
      t={(key) => key} /></I18nProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Explain partial profit|profitSummary.explain/ }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("2024年3月15日");
  } finally {
    localStorage.removeItem("track3-ui-locale");
  }
});
