import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { CoinSourceSummary } from "./coin-source-summary";

it("shows three full source names in the accessible list and prefixes only the last inline wallet", async () => {
  render(<CoinSourceSummary
    names={["Binance", "Ledger cold wallet", "Savings", "OKX"]}
    template="Held on {sources}"
    locale="en"
    moreLabel="+{count} more"
    allLabel="All sources"
    lastPrefix="a "
  />);

  expect(screen.getByTitle("Savings")).toHaveTextContent("a Savings");
  const more = screen.getByRole("button", { name: "+1 more" });
  await userEvent.click(more);
  const dialog = screen.getByRole("dialog", { name: "All sources" });
  expect(dialog.querySelectorAll("li")).toHaveLength(4);
  expect(dialog.querySelector("li:last-child")).toHaveAttribute("title", "OKX");
  expect(dialog).toHaveTextContent("Ledger cold wallet");
});
