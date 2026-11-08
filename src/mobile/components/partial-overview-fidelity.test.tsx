import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import PartialOverviewFidelity from "./partial-overview-fidelity";
import type { View } from "./overview-fidelity";

it("shows a configured exchange mark when no status is stored", () => {
  const view = {
    latest: { createdAt: "2026-10-31T09:41:00Z", assets: [
      { wallet: "exchange-hash", symbol: "BTC", assetType: "crypto", amount: 1, value: 100 },
    ], partial: { missing: [] } },
    points: [], currentTotal: 100, excluded: [],
    sourceLabels: { "exchange-hash": "Main account" },
    sourceTypes: { "exchange-hash": "Binance" },
    sources: [{ sourceId: "cex:0", label: "Configured account", provider: "Binance" }],
  } as unknown as View;
  render(<MemoryRouter><PartialOverviewFidelity view={view} statuses={[]}
    currency={{ currency: "USD", alias: "usd", symbol: "$", rate: 1 }}
    quoteColor="green-up-red-down" withLastKnown={false} setWithLastKnown={() => {}} /></MemoryRouter>);
  const row = screen.getByText("Main account").closest(".fd-partial-source");
  expect(row?.querySelector(".t3-asset-icon")).toHaveAttribute("data-kind", "exchange");
  expect(row?.querySelector(".t3-asset-icon img")).toHaveAttribute("src");
});
