import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActionCard from "./action-card";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";

vi.mock("@/middlelayers/charts-assets", () => ({
  queryLastAssetsBySymbol: vi.fn(async () => ({
    symbol: "BTC", assetType: "crypto", amount: 1, value: 63842.11, price: 63842.11,
  })),
}));

it("shows the current alert price in the portfolio currency", async () => {
  const action: PendingAction = {
    kind: "pending_action", id: "alert", toolCallId: "tool-alert", name: "create_alert",
    args: { kind: "asset_price_target", assetType: "crypto", symbol: "BTC", comparator: "gte", threshold: 70000 },
    preview: { before: "null", after: "{}" }, risk: "low", status: "pending",
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  render(<ActionCard action={action} currency={{ currency: "EUR", rate: 0.9, symbol: "€", alias: "Euro" }} />);
  expect(await screen.findByText(/€57,457\.90, 91\.2%/)).toBeInTheDocument();
});
