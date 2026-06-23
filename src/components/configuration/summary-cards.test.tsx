import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryCards } from "./summary-cards";

describe("SummaryCards", () => {
  it("renders all five stat cards with correct counts", () => {
    render(
      <SummaryCards
        exchangeCount={3}
        activeExchangeCount={2}
        stockBrokerCount={1}
        activeStockBrokerCount={1}
        walletCount={5}
        activeWalletCount={4}
        othersCount={2}
        preferCurrency="EUR"
        preferCurrencyLoading={false}
      />,
    );

    // Count values
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Base currency
    expect(screen.getByText("EUR")).toBeInTheDocument();
  });

  it("shows active count text", () => {
    render(
      <SummaryCards
        exchangeCount={3}
        activeExchangeCount={2}
        stockBrokerCount={0}
        activeStockBrokerCount={0}
        walletCount={1}
        activeWalletCount={1}
        othersCount={0}
        preferCurrency="USD"
        preferCurrencyLoading={false}
      />,
    );

    expect(screen.getByText("2 active")).toBeInTheDocument();
  });

  it("shows skeleton when preferCurrencyLoading is true", () => {
    const { container } = render(
      <SummaryCards
        exchangeCount={0}
        activeExchangeCount={0}
        stockBrokerCount={0}
        activeStockBrokerCount={0}
        walletCount={0}
        activeWalletCount={0}
        othersCount={0}
        preferCurrency="USD"
        preferCurrencyLoading={true}
      />,
    );

    // Skeleton should be rendered instead of the currency text
    expect(screen.queryByText("USD")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
