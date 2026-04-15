import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Summary from "@/components/summary";
import WalletAnalytics from "@/components/wallet-analytics";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const reportCounts = {
  athValue: 0,
  profitMetrics: 0,
  profitSummary: 0,
  profit: 0,
  walletAssetsPercentage: 0,
  walletAssetsChange: 0,
};

function createReporter(key: keyof typeof reportCounts) {
  return function Reporter() {
    const { reportLoaded } = React.useContext(OverviewLoadingContext);

    React.useEffect(() => {
      for (let index = 0; index < reportCounts[key]; index += 1) {
        reportLoaded();
      }
    }, [reportLoaded]);

    return <div>{key}</div>;
  };
}

vi.mock("@/components/ath-value", () => ({
  default: createReporter("athValue"),
}));

vi.mock("@/components/profit-metrics", () => ({
  default: createReporter("profitMetrics"),
}));

vi.mock("@/components/profit-summary", () => ({
  default: createReporter("profitSummary"),
}));

vi.mock("@/components/profit", () => ({
  default: createReporter("profit"),
}));

vi.mock("@/components/wallet-assets-percentage", () => ({
  default: createReporter("walletAssetsPercentage"),
}));

vi.mock("@/components/wallet-assets-change", () => ({
  default: createReporter("walletAssetsChange"),
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeUp: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => {
  vi.useRealTimers();
  Object.keys(reportCounts).forEach((key) => {
    reportCounts[key as keyof typeof reportCounts] = 0;
  });
});

describe("Summary page shell", () => {
  it("shows a loading status and keeps it visible until summary sections report loaded", () => {
    vi.useFakeTimers();

    render(
      <Summary
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading summary data/i);

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(/loading summary data/i);
  });

  it("clears the loading status after summary sections report loaded", async () => {
    reportCounts.athValue = 1;
    reportCounts.profitMetrics = 1;
    reportCounts.profitSummary = 1;
    reportCounts.profit = 1;

    render(
      <Summary
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});

describe("Wallets page shell", () => {
  it("shows a loading status and keeps it visible until wallet sections report loaded", () => {
    vi.useFakeTimers();

    render(
      <WalletAnalytics
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: /wallets/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/loading wallet analytics/i);

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(/loading wallet analytics/i);
  });

  it("clears the loading status after wallet sections report loaded", async () => {
    reportCounts.walletAssetsPercentage = 1;
    reportCounts.walletAssetsChange = 1;

    render(
      <WalletAnalytics
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
