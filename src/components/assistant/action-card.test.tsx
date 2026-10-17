import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ActionCard from "./action-card";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import axe from "axe-core";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";

const action: PendingAction = {
  kind: "pending_action", id: "one", toolCallId: "tool-one", name: "blacklist_add",
  args: { symbol: "BTC" }, preview: { before: "(empty)", after: "BTC" },
  risk: "low", status: "pending", createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 300000).toISOString(),
};

it("shows validated arguments and supports keyboard approval and rejection", async () => {
  const decide = vi.fn();
  render(<ActionCard action={action} onDecide={decide} />);
  expect(screen.getByText(/"symbol": "BTC"/)).toBeInTheDocument();
  const approve = screen.getByRole("button", { name: "Approve" });
  approve.focus();
  await userEvent.keyboard("{Enter}");
  expect(decide).toHaveBeenCalledWith("one", "approve");
  await userEvent.click(screen.getByRole("button", { name: "Reject" }));
  expect(decide).toHaveBeenCalledWith("one", "reject");
});

it("has no axe violations while confirmation is pending", async () => {
  const { container } = render(<ActionCard action={action} onDecide={vi.fn()} />);
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

it("cannot approve an expired action", () => {
  render(<ActionCard action={{ ...action, expiresAt: "2000-01-01T00:00:00.000Z" }} onDecide={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Expired");
});

it("shows a dotted symbol in the preview as data", () => {
  render(<ActionCard action={{ ...action, preview: { before: "common.delete", after: "assistant.action.preview.current" } }} />);
  expect(screen.getByText("common.delete")).toBeVisible();
  expect(screen.getByText("Current selection")).toBeVisible();
});

it("shows an action result that resembles a translation key as data", () => {
  render(<ActionCard action={{ ...action, status: "approved", result: "common.delete" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("common.delete");
});

it("offers the originating page after an approved setup action", () => {
  render(<MemoryRouter><ActionCard action={{ ...action, name: "save_rebalance_targets", status: "approved" }} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Open Rebalance" })).toHaveAttribute("href", "/rebalance");
});

it("shows changed settings as a readable field diff", () => {
  render(<ActionCard action={{
    ...action, name: "set_cost_basis_settings",
    preview: { before: '{"method":"LIFO","holdingPeriodDays":365}', after: '{"method":"FIFO","holdingPeriodDays":365}' },
  }} />);
  expect(screen.getByText("Method")).toBeVisible();
  expect(screen.getByText("LIFO → FIFO")).toBeVisible();
  expect(screen.queryByText("365 → 365")).not.toBeInTheDocument();
});

it("summarizes target percentages in the confirmation card", () => {
  render(<ActionCard action={{
    ...action, name: "save_rebalance_targets",
    preview: { before: "null", after: JSON.stringify({
      targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 40 },
        { kind: "cash", percent: 60 }], tolerancePercent: 2,
    }) },
  }} />);
  expect(screen.getByText(/BTC 40%.*Cash 60%/)).toBeVisible();
});

it("labels rebalance amounts without unresolved currency placeholders", () => {
  render(<ActionCard action={{
    ...action, name: "set_rebalance_options",
    preview: { before: "{}", after: '{"injectedCash":1000,"minimumTradeValue":10}' },
  }} />);
  expect(screen.getByText("New cash")).toBeVisible();
  expect(screen.getByText("Minimum trade")).toBeVisible();
  expect(screen.queryByText(/\{currency\}/)).not.toBeInTheDocument();
});
it("shows the percentage alert threshold as a readable confirmation diff", () => {
  render(<ActionCard action={{
    ...action, name: "edit_alert",
    preview: {
      before: '{"id":7,"kind":"portfolio_value_change","threshold":-5,"window":"7d"}',
      after: '{"id":7,"kind":"portfolio_value_change","threshold":-10,"window":"7d"}',
    },
  }} />);
  expect(screen.getByText("Threshold")).toBeVisible();
  expect(screen.getByText("-5% → -10%")).toBeVisible();
});
it("shows each new alert field in the confirmation card", () => {
  render(<ActionCard action={{
    ...action, name: "create_alert",
    preview: { before: "{}", after: '{"kind":"asset_price_target","symbol":"BTC","threshold":100000}' },
  }} />);
  expect(screen.getByText("Threshold")).toBeVisible();
  expect(screen.getByText("— → 100000")).toBeVisible();
});
it("translates the acknowledge-all preview into Chinese with its count", () => {
  localStorage.setItem(localeLocalStorageKey, "zh");
  try {
    render(<I18nProvider><ActionCard action={{
      ...action, name: "acknowledge_all_alerts",
      preview: { before: "[]", after: "assistant.action.preview.acknowledgedAll:2" },
    }} /></I18nProvider>);
    expect(screen.getByText("已确认 2 条提醒")).toBeVisible();
  } finally {
    localStorage.removeItem(localeLocalStorageKey);
  }
});
it("uses each alert kind's unit when a threshold changes from percent to currency", () => {
  render(<ActionCard action={{
    ...action, name: "edit_alert",
    preview: {
      before: '{"id":7,"kind":"portfolio_value_change","threshold":-10,"window":"7d"}',
      after: '{"id":7,"kind":"period_pnl","threshold":-50,"window":"7d"}',
    },
  }} />);
  expect(screen.getByText("-10% → -$50")).toBeVisible();
});
