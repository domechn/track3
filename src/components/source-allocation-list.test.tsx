import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceAllocationList } from "./source-allocation-list";
import type { CurrencyRateDetail, WalletAssetsPercentageData } from "@/middlelayers/types";
import { WALLET_DETAIL_URLS } from "@/middlelayers/constants";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";

const openUrl = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

const currency = { currency: "USD", alias: "usd", symbol: "$", rate: 1 } as CurrencyRateDetail;
const wallets: WalletAssetsPercentageData = Array.from({ length: 10 }, (_, index) => ({
  wallet: `source-${index + 1}`,
  walletType: "Other",
  percentage: 19 - index * 2,
  value: (19 - index * 2) * 10,
  amount: 1,
  chartColor: "",
}));

describe("SourceAllocationList", () => {
  it("keeps the value and percentage of sources beyond the first eight visible on coin detail", () => {
    render(<SourceAllocationList wallets={wallets} selectedSource={null} currency={currency}
      name={(wallet) => wallet.wallet} title="Source allocation" />);
    const list = screen.getByRole("list", { name: "Source allocation" });
    expect(list.children).toHaveLength(9);
    expect(list).toHaveTextContent("Others");
    expect(list).toHaveTextContent("+2");
    expect(list.lastElementChild).toHaveTextContent("$40");
    expect(list.lastElementChild).toHaveTextContent("4.0%");
  });

  it("shows the existing no-data message for an empty source list", () => {
    render(<SourceAllocationList wallets={[]} selectedSource={null} currency={currency}
      name={(wallet) => wallet.wallet} title="Source allocation" />);
    expect(screen.getByText("No Available Data For Selected Dates")).toBeInTheDocument();
  });

  it("shows coin quantity per source and opens supported wallet explorers", () => {
    const coinWallets = [
      { ...wallets[0], wallet: "bc1qexample", walletType: "BTC", amount: 1.23456 },
      { ...wallets[1], wallet: "coinbase", walletType: "Coinbase", amount: 2.5 },
    ];
    render(<SourceAllocationList wallets={coinWallets} selectedSource={null} currency={currency}
      name={(wallet) => wallet.wallet} title="Source allocation" showQuantity />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Source allocation" });
    expect(list.children[0]).toHaveTextContent("1.2346");
    expect(list.children[1]).toHaveTextContent("2.5");
    fireEvent.click(screen.getByRole("button", { name: "bc1qexample" }));
    expect(openUrl).toHaveBeenCalledWith(WALLET_DETAIL_URLS.BTC("bc1qexample"));
    expect(screen.queryByRole("button", { name: "coinbase" })).not.toBeInTheDocument();
  });
});
