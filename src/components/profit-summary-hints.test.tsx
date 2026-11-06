import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import { PartialProfitHint, PnlPercentHint } from "./profit-summary-hints";

it("keeps the percentage explanation in one expandable panel popover", () => {
  render(<I18nProvider><PnlPercentHint names={Array.from({ length: 60 }, (_, i) => `COIN${i}`)} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "How P&L % is calculated" }));
  const hint = screen.getByRole("tooltip");
  expect(hint).toHaveTextContent("opening value plus deposits");
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
