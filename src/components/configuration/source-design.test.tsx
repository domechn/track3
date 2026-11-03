import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import { SourceDesign } from "./source-design";

vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => [{
  id: "latest", createdAt: "2026-10-31T09:41:00.000Z",
  assets: [
    { wallet: "27ed7789cdb2445dce9575a26a2385c0", symbol: "BTC", amount: 1, value: 100, price: 100 },
    { wallet: "27ed7789cdb2445dce9575a26a2385c0", symbol: "ETH", amount: 2, value: 40, price: 20 },
  ],
}]) }));
vi.mock("@/middlelayers/license", () => ({
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@/middlelayers/ui-state/source-status-store", () => ({ readStoredStatuses: () => [] }));

it("shows a source value from the latest snapshot's holdings", async () => {
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[{ type: "binance", apiKey: "sample", secret: "sample", active: true }]}
    wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect(await screen.findAllByText("$140.00")).toHaveLength(2);
  expect(queryHistoricalData).toHaveBeenCalledWith(1, false, { includeTransactions: false });
});
