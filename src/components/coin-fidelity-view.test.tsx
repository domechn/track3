import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { Asset, Transaction } from "@/middlelayers/types";
import CoinFidelityView from "./coin-fidelity-view";

vi.mock("@/middlelayers/charts", () => ({
  queryCoinsAmountChange: () => Promise.resolve({ timestamps: [], values: [], amounts: [] }),
  queryTotalValue: () => Promise.resolve({ totalValue: 0 }),
  WALLET_ANALYZER: { queryWalletAssetsPercentage: () => Promise.resolve([]) },
}));
vi.mock("@/middlelayers/cost-basis-data", () => ({
  loadCostBasisReport: () => Promise.resolve({ openLots: [], unrealized: [], disposals: [] }),
}));
vi.mock("@/middlelayers/configuration", () => ({
  getConfiguration: () => Promise.resolve({ others: [] }),
}));

const transactions = Array.from({ length: 51 }, (_, index): Transaction => ({
  id: index + 1, uuid: "snapshot", assetID: 1, assetType: "crypto", symbol: "BTC",
  wallet: "binance", amount: index + 1, price: 100,
  txnType: index % 2 ? "sell" : "buy",
  txnCreatedAt: new Date(Date.UTC(2026, 9, 31) - index * 86400000).toISOString(),
}));

function view(rows: Transaction[], transactionsLoading = false, lastAsset?: Asset) {
  return <MemoryRouter><CoinFidelityView symbol="BTC" assetType="crypto"
    currency={{ currency: "USD", alias: "USD", symbol: "$", rate: 1 }} dateRange={{
      start: new Date("2020-01-01T00:00:00Z"), end: new Date("2026-10-31T12:00:00Z"),
    }} lastAsset={lastAsset} transactions={rows} transactionsLoading={transactionsLoading} walletAliasMap={{}} quoteColor="green-up-red-down" onEdit={async () => true} /></MemoryRouter>;
}

it("uses the rendered coin column width when deciding whether holdings fit", () => {
  let holdingsRoom = 180;
  let notifyResize = () => {};
  const clientWidth = vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
    return this.matches(".coin-fidelity-hero") ? 1280 :
      this.matches(".coin-fidelity-metrics.top .coin-fidelity-metric:nth-child(5) strong") ? holdingsRoom : 120;
  });
  const scrollWidth = vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
    return this.matches(".coin-fidelity-metrics.top .coin-fidelity-metric:nth-child(5) strong") ? 160 : 100;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: () => void) {}
    observe(element: Element) {
      if (element.matches(".coin-fidelity")) notifyResize = this.callback;
    }
    disconnect() {}
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  try {
    render(view([], false, { symbol: "BTC", assetType: "crypto", amount: 1,
      value: 1_234_567.89, price: 1 }));
    const hero = document.querySelector(".coin-fidelity-hero")!;
    expect(hero).not.toHaveClass("long-amount");
    holdingsRoom = 140;
    act(() => notifyResize());
    expect(hero).toHaveClass("long-amount");
  } finally {
    clientWidth.mockRestore();
    scrollWidth.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("shows empty sections after transactions finish loading", () => {
  const mounted = render(view([], true));
  const transactionsCard = within(document.querySelector(".coin-fidelity-transactions") as HTMLElement);
  expect(transactionsCard.queryByText("No transactions yet")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".coin-fidelity-row-skeleton")).toHaveLength(25);
  mounted.rerender(view([]));
  expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  expect(screen.getByText("No sources yet")).toBeInTheDocument();
  expect(screen.getByText("No open lots yet")).toBeInTheDocument();
});

it("pages transactions, resets on a filter, and clamps after a last-page deletion", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  const user = userEvent.setup();
  const mounted = render(view(transactions));
  const card = within(document.querySelector(".coin-fidelity-transactions") as HTMLElement);
  expect(card.getAllByRole("row")).toHaveLength(26);
  expect(card.getByText("Showing 1-25 of 51")).toBeInTheDocument();
  expect(card.getByRole("button", { name: "Previous" })).toBeDisabled();
  const scrollArea = document.querySelector(".coin-fidelity-transaction-scroll") as HTMLElement;
  expect(scrollArea).toHaveAttribute("role", "region");
  scrollArea.scrollTop = 300;
  await user.click(card.getByRole("button", { name: "Next" }));
  expect(scrollArea.scrollTop).toBe(0);
  await user.click(card.getByRole("button", { name: "Next" }));
  expect(card.getByText("Showing 51-51 of 51")).toBeInTheDocument();
  expect(card.getByRole("button", { name: "Next" })).toBeDisabled();
  mounted.rerender(view(transactions.slice(0, 50)));
  expect(card.getByText("Showing 26-50 of 50")).toBeInTheDocument();
  await user.click(card.getByRole("button", { name: "Buy 25" }));
  expect(card.queryByText(/Showing/)).not.toBeInTheDocument();
  expect(card.getAllByRole("row")).toHaveLength(26);
  await user.click(card.getByRole("button", { name: "All 50" }));
  expect(card.getByText("Showing 1-25 of 50")).toBeInTheDocument();
});
