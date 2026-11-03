import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import PhoneActionCard from "./phone-action-card";
import { queryLastAssetsBySymbol } from "@/middlelayers/charts-assets";

vi.mock("@/middlelayers/charts-assets", () => ({
  queryLastAssetsBySymbol: vi.fn(async () => ({ price: 100 })),
}));

function alertAction(args: Record<string, unknown>): PendingAction {
  return {
    kind: "pending_action", id: "a", toolCallId: "t", name: "create_alert",
    args: { kind: "asset_price_target", symbol: "BTC", threshold: 200, ...args },
    preview: { before: "{}", after: "{}" }, risk: "low", status: "approved",
    createdAt: "2026-10-31T09:42:00.000Z", expiresAt: "2026-11-10T00:00:00.000Z",
  };
}

it("shows the current price in the same currency as the alert threshold", async () => {
  render(<MemoryRouter><PhoneActionCard action={alertAction({ comparator: "gte", assetType: "stock" })}
    baseCurrency={{ currency: "EUR", symbol: "€", alias: "EUR", rate: 0.9 }} /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/\$100\.00/)).toBeVisible());
  expect(screen.queryByText(/€90\.00/)).toBeNull();
  expect(screen.getByText(/50\.0%/)).toBeVisible();
  expect(queryLastAssetsBySymbol).toHaveBeenCalledWith("BTC", undefined, "stock");
});

it("clears the displayed market price when the proposed symbol changes", async () => {
  const view = render(<MemoryRouter><PhoneActionCard action={alertAction({ comparator: "gte" })} /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/\$100\.00/)).toBeVisible());
  vi.mocked(queryLastAssetsBySymbol).mockResolvedValueOnce(undefined);
  view.rerender(<MemoryRouter><PhoneActionCard action={alertAction({ comparator: "gte", symbol: "ETH" })} /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText(/\$100\.00/)).toBeNull());
});

it("uses the complete shared preview for a below-target alert", () => {
  render(<MemoryRouter><PhoneActionCard action={alertAction({
    comparator: "lte", assetType: "stock", enabled: false, window: "7d",
  })} /></MemoryRouter>);
  expect(screen.queryByText(/above/)).toBeNull();
  expect(screen.getByText(/"comparator": "lte"/)).toBeVisible();
  expect(screen.getByText(/"assetType": "stock"/)).toBeVisible();
  expect(screen.getByText(/"enabled": false/)).toBeVisible();
  expect(screen.getByText(/"window": "7d"/)).toBeVisible();
});

it("shows every additional field in a rising-price alert", () => {
  render(<MemoryRouter><PhoneActionCard action={alertAction({
    comparator: "gte", assetType: "stock", enabled: false, window: "7d", extraOption: 42,
    [["cooldown", "Seconds"].join("")]: 86400,
  })} /></MemoryRouter>);
  expect(screen.getByText("Create alert: BTC above $200")).toBeVisible();
  expect(screen.getByText("Asset type")).toBeVisible();
  expect(screen.getByText("stock")).toBeVisible();
  expect(screen.getByText("Paused")).toBeVisible();
  expect(screen.getByText("Window")).toBeVisible();
  expect(screen.getByText("7d")).toBeVisible();
  expect(screen.getByText("Cooldown")).toBeVisible();
  expect(screen.getByText("24 hours")).toBeVisible();
  expect(screen.queryByText("86400")).toBeNull();
  expect(screen.getByText("extraOption")).toBeVisible();
  expect(screen.getByText("42")).toBeVisible();
});

it("does not interpret unrelated numeric action fields as a duration", () => {
  render(<MemoryRouter><PhoneActionCard action={alertAction({
    comparator: "gte", extraOption: 7200,
  })} /></MemoryRouter>);
  expect(screen.getByText("extraOption")).toBeVisible();
  expect(screen.getByText("7200")).toBeVisible();
});

it("disables approval when the pending action expires", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00.000Z"));
  try {
    const action = { ...alertAction({ comparator: "gte" }), status: "pending" as const,
      expiresAt: "2026-11-03T10:00:01.000Z" };
    render(<MemoryRouter><PhoneActionCard action={action} onDecide={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
