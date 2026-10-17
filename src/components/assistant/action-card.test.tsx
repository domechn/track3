import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ActionCard from "./action-card";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import axe from "axe-core";

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
