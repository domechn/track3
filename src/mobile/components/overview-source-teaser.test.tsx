import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { OverviewSourceTeaser } from "@/mobile/components/overview";
import { WALLET_ANALYZER } from "@/middlelayers/charts-refresh";
import { DataChangedContext } from "@/contexts/data-changed";

vi.mock("@/middlelayers/charts-refresh", () => ({
  WALLET_ANALYZER: { queryWalletAssetsPercentage: vi.fn() },
}));

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

beforeEach(() => vi.mocked(WALLET_ANALYZER.queryWalletAssetsPercentage).mockReset());

it("hides the source section when the query returns no sources", async () => {
  vi.mocked(WALLET_ANALYZER.queryWalletAssetsPercentage).mockResolvedValue([]);
  render(<OverviewSourceTeaser currency={currency} />);
  await waitFor(() => expect(WALLET_ANALYZER.queryWalletAssetsPercentage).toHaveBeenCalledOnce());
  expect(screen.queryByText("Sources")).not.toBeInTheDocument();
});

it("handles a failed source query without leaving an empty section", async () => {
  vi.mocked(WALLET_ANALYZER.queryWalletAssetsPercentage)
    .mockResolvedValueOnce([{ wallet: "btc", walletType: "BTC", walletAlias: "Vault", value: 100, percentage: 100, amount: 1, chartColor: "#fff" }])
    .mockRejectedValueOnce(new Error("offline"));
  const view = render(<DataChangedContext.Provider value={0}><OverviewSourceTeaser currency={currency} /></DataChangedContext.Provider>);
  await screen.findByText("Sources");
  view.rerender(<DataChangedContext.Provider value={1}><OverviewSourceTeaser currency={currency} /></DataChangedContext.Provider>);
  await waitFor(() => expect(screen.queryByText("Sources")).not.toBeInTheDocument());
});
