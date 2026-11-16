import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import { I18nProvider } from "@/mobile/i18n";
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
  render(<I18nProvider><MemoryRouter><PhoneActionCard action={alertAction({
    comparator: "lte", assetType: "stock", enabled: false, window: "7d", threshold: 1200.5,
  })} /></MemoryRouter></I18nProvider>);
  expect(screen.getByText("Create alert: BTC below $1,200.50")).toBeVisible();
  expect(screen.getByText("Asset price target: BTC goes below $1,200.50")).toBeVisible();
  expect(screen.getByText("Nothing else changes. No trades are made and no data leaves the device beyond this chat.")).toBeInTheDocument();
  expect(screen.queryByText(/above/)).toBeNull();
  expect(screen.getByText(/"comparator": "lte"/)).toBeVisible();
  expect(screen.getByText(/"assetType": "stock"/)).toBeVisible();
  expect(screen.getByText(/"enabled": false/)).toBeVisible();
  expect(screen.getByText(/"window": "7d"/)).toBeVisible();
});

it("translates progress in the shared fallback card for an invalid phone alert", async () => {
  render(<I18nProvider><MemoryRouter><PhoneActionCard action={alertAction({
    comparator: "gte", threshold: 0,
  })} /></MemoryRouter></I18nProvider>);
  expect(screen.getByText("Asset price target: BTC goes above $0")).toBeVisible();
  expect(await screen.findByText(/of the way/)).toBeVisible();
  expect(screen.queryByText(/fidelity\.assistant\.ofWay/)).toBeNull();
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

const phoneHead = () => document.querySelector(".fidelity-action-head");
const renderPhoneAlert = (patch: Partial<PendingAction>) => render(<MemoryRouter>
  <PhoneActionCard action={{ ...alertAction({ comparator: "gte" }), expiresAt: "2999-01-01T00:00:00.000Z", ...patch }}
    onDecide={vi.fn()} /></MemoryRouter>);

it("shows a pending phone alert as waiting for approval", () => {
  renderPhoneAlert({ status: "pending" });
  expect(phoneHead()).toHaveTextContent("Approval neededWaiting");
  expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
});

it("shows an approved phone alert as created", () => {
  renderPhoneAlert({ status: "approved" });
  expect(phoneHead()).toHaveTextContent("Alert createdApproved");
});

it.each([
  ["rejected", "Rejected"], ["expired", "Expired"], ["failed", "Failed"], ["executing", "Executing"],
] as const)("shows a %s phone alert with its own status", (status, label) => {
  renderPhoneAlert({ status });
  expect(phoneHead()).toHaveTextContent(`Create an alert rule${label}`);
  expect(phoneHead()).not.toHaveTextContent("Approval needed");
  expect(screen.getByRole("status")).toHaveTextContent(label);
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.getByRole("region", { name: "Confirm assistant action" })).toHaveAttribute("data-state", status);
});

it("shows a pending phone alert past its expiry as expired in the head and the footer", () => {
  renderPhoneAlert({ status: "pending", expiresAt: "2000-01-01T00:00:00.000Z" });
  expect(phoneHead()).toHaveTextContent("Create an alert ruleExpired");
  expect(screen.getByRole("status")).toHaveTextContent("Expired");
  expect(screen.getByRole("region", { name: "Confirm assistant action" })).toHaveAttribute("data-state", "expired");
});

it("shows why a phone alert failed", () => {
  renderPhoneAlert({ status: "failed", result: "The rule could not be stored" });
  expect(screen.getByRole("status")).toHaveTextContent("Failed: The rule could not be stored");
});

it.each(["pending", "approved"] as const)("exposes a %s phone alert as data-state", (status) => {
  renderPhoneAlert({ status });
  expect(screen.getByRole("region", { name: "Confirm assistant action" })).toHaveAttribute("data-state", status);
});
