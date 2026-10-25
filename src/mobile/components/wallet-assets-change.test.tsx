import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import WalletAssetsChange from "@/mobile/components/wallet-assets-change";

vi.mock("@/middlelayers/charts-refresh", () => ({
  WALLET_ANALYZER: {
    queryWalletAssetsChange: vi.fn().mockResolvedValue([
      { wallet: "btc-wallet", walletType: "BTC", walletAlias: "Cold storage", changeValue: 120, changePercentage: 4 },
    ]),
  },
}));

it("uses the allocation wallet name and omits the desktop page-size select on a phone", async () => {
  const previousMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) => ({
    matches: query.includes("pointer: coarse"), media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  });
  try {
    render(<WalletAssetsChange
      currency={{ currency: "USD", symbol: "$", rate: 1, alias: "usd" }}
      dateRange={{ start: new Date("2024-01-01"), end: new Date("2024-01-02") }}
      quoteColor="green-up-red-down"
    />);
    expect(await screen.findByText("Cold storage")).toBeInTheDocument();
    expect(screen.queryByText("BTC-Cold storage")).toBeNull();
    expect(screen.queryByText("0 down")).toBeNull();
    expect(screen.queryByRole("combobox", { name: /rows/i })).toBeNull();
    expect(screen.getByPlaceholderText("Search wallets")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Value" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "%" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Volatility" })).toBeInTheDocument();
  } finally {
    window.matchMedia = previousMatchMedia;
  }
});
