import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import GoalsAlerts from "./goals-alerts";
import { listAlertRules, listAlertHistory, saveAlertRule, setAlertRuleEnabled, acknowledgeAllAlerts } from "@/middlelayers/alerts";
import { enableSystemNotifications } from "@/middlelayers/alert-notifications";

vi.mock("@/middlelayers/alerts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/alerts")>(),
  listAlertRules: vi.fn(), listAlertHistory: vi.fn(), saveAlertRule: vi.fn(),
  setAlertRuleEnabled: vi.fn(), acknowledgeAllAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(), clearAlertHistory: vi.fn(), deleteAlertRule: vi.fn(),
  loadAlertEvaluationData: vi.fn().mockResolvedValue({ snapshots: [], prices: {} }),
}));
vi.mock("@/middlelayers/alert-notifications", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/alert-notifications")>(),
  enableSystemNotifications: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
});

it("shows the empty state and a clear explanation before notification permission", async () => {
  render(<GoalsAlerts />);
  expect(await screen.findByText("No rules yet")).toBeInTheDocument();
  expect(screen.getByText(/Allow system notifications/i)).toBeInTheDocument();
  expect(enableSystemNotifications).not.toHaveBeenCalled();
});

it("validates a new goal before saving", async () => {
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  expect(saveAlertRule).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Threshold"), "1000");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  await waitFor(() => expect(saveAlertRule).toHaveBeenCalledWith(expect.objectContaining({
    kind: "total_value_target", threshold: 1000,
  })));
});

it("shows an unread alert and acknowledges it", async () => {
  vi.mocked(listAlertHistory).mockResolvedValue([{
    id: 1, ruleId: 1, kind: "total_value_target", title: "Portfolio goal reached",
    message: "Portfolio goal reached: 1000.00", value: 1000,
    triggeredAt: "2026-10-17T12:00:00.000Z", acknowledgedAt: null,
  }]);
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  expect(await screen.findByText(/Portfolio value goal triggered/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Acknowledge all" }));
  expect(acknowledgeAllAlerts).toHaveBeenCalledTimes(1);
});
