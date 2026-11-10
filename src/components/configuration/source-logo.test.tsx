import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WALLET_LOGS } from "@/middlelayers/constants";
import { SourceDesign } from "./source-design";

vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: async () => [] }));
vi.mock("@/middlelayers/license", () => ({
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));

it("puts OKX and Binance images on the shared source logo tile", async () => {
  const noop = () => {};
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[
      { type: "okex", alias: "OKX", apiKey: "okx-key", secret: "", active: true },
      { type: "binance", alias: "Binance", apiKey: "binance-key", secret: "", active: true },
    ]}
    wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);

  const okx = (await screen.findByTitle("OKX")).closest(".t3-fidelity-source-row");
  const binance = screen.getByTitle("Binance").closest(".t3-fidelity-source-row");
  expect(okx?.querySelector(".t3-fidelity-source-logo[data-logo-tile] img")).toHaveAttribute("src", WALLET_LOGS.okex);
  expect(binance?.querySelector(".t3-fidelity-source-logo[data-logo-tile] img")).toHaveAttribute("src", WALLET_LOGS.binance);
});
