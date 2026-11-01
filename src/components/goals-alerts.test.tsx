import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, expect, it, vi } from "vitest";
import GoalsAlerts from "./goals-alerts";
import { listAlertRules, listAlertHistory, countUnreadAlerts, saveAlertRule, setAlertRuleEnabled, acknowledgeAllAlerts, clearAlertHistory, deleteAlertRule, loadAlertEvaluationData, type AlertRule } from "@/middlelayers/alerts";
import { enableSystemNotifications, systemNotificationsEnabled } from "@/middlelayers/alert-notifications";
import { queryPNLChartValue } from "@/middlelayers/charts-timeseries";
import { I18nProvider, useTranslation } from "@/i18n";
vi.mock("@/middlelayers/charts-timeseries", async (original) => ({
  ...await original<typeof import("@/middlelayers/charts-timeseries")>(),
  queryPNLChartValue: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/middlelayers/configuration", async (original) => ({
  ...await original<typeof import("@/middlelayers/configuration")>(),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));

vi.mock("@/middlelayers/alerts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/alerts")>(),
  listAlertRules: vi.fn(), listAlertHistory: vi.fn(), countUnreadAlerts: vi.fn(), saveAlertRule: vi.fn(),
  setAlertRuleEnabled: vi.fn(), acknowledgeAllAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(), clearAlertHistory: vi.fn(), deleteAlertRule: vi.fn(),
  loadAlertEvaluationData: vi.fn().mockResolvedValue({ snapshots: [], prices: {} }),
}));
vi.mock("@/middlelayers/alert-notifications", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/alert-notifications")>(),
  enableSystemNotifications: vi.fn(), systemNotificationsEnabled: vi.fn(),
}));
vi.mock("react-chartjs-2", () => ({
  Bar: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Line: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Doughnut: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
}));
const savedRule: AlertRule = {
  id: 7, kind: "total_value_target", assetType: null, symbol: null, comparator: "gte",
  threshold: 100, window: null, enabled: true, cooldownSeconds: 3600,
  lastTriggeredAt: null, lastValue: null, armed: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
  vi.mocked(countUnreadAlerts).mockResolvedValue(0);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({ snapshots: [], prices: {}, excludedSymbols: [] });
  vi.mocked(systemNotificationsEnabled).mockResolvedValue(false);
  vi.mocked(queryPNLChartValue).mockResolvedValue([]);
});

it("shows stored portfolio values as a line chart", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2025-01-01"), totalValue: 100 },
    { timestamp: Date.parse("2025-01-02"), totalValue: 120 },
  ]);
  render(<GoalsAlerts />);
  expect(await screen.findByRole("img", { name: /2025-01-01: 100.00.*2025-01-02: 120.00/ })).toBeInTheDocument();
});
it("uses the evaluator's blacklist for the goal line and ETA", async () => {
  vi.mocked(queryPNLChartValue).mockResolvedValue([
    { timestamp: Date.parse("2025-01-01"), totalValue: 100 },
    { timestamp: Date.parse("2025-01-02"), totalValue: 120 },
  ]);
  vi.mocked(listAlertRules).mockResolvedValue([{ ...savedRule, threshold: 140 }]);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2025-01-02T00:00:00.000Z", assets: [{ assetType: "crypto", symbol: "BTC", value: 120, price: 120, wallet: "wallet-a" }] }],
    prices: {}, excludedSymbols: ["SCAM"],
  });
  render(<GoalsAlerts />);
  expect(await screen.findByRole("img", { name: /2025-01-01: 100.00.*2025-01-02: 120.00/ })).toBeInTheDocument();
  expect(queryPNLChartValue).toHaveBeenCalledWith(expect.anything(), 80, ["SCAM"]);
  expect(screen.getByText(/about 1 days/)).toBeInTheDocument();
});

it("has no axe violations in the goals summary", async () => {
  const { container } = render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

it("summarizes active rules and unread triggers from existing data", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{ ...savedRule, enabled: true }, { ...savedRule, id: 8, enabled: false }]);
  vi.mocked(listAlertHistory).mockResolvedValue([{
    id: 1, ruleId: 7, kind: "total_value_target", title: "Target", message: "Reached", value: 120,
    triggeredAt: "2026-01-01T00:00:00.000Z", acknowledgedAt: null,
  }]);
  vi.mocked(countUnreadAlerts).mockResolvedValue(1);
  render(<GoalsAlerts />);
  expect(await screen.findByTestId("goals-summary")).toHaveTextContent("1 / 2");
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("1");
});

it("shows the full unread count when recent history is capped", async () => {
  vi.mocked(countUnreadAlerts).mockResolvedValue(205);
  render(<GoalsAlerts />);
  await waitFor(() => expect(screen.getByText("Unread alerts").nextElementSibling).toHaveTextContent("205"));
});

it("labels the capped history count as recent triggers", async () => {
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("Recent triggers");
});

it("shows the last portfolio check instead of a last trigger", async () => {
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2026-04-16T12:00:00.000Z", assets: [] }], prices: {}, excludedSymbols: [],
  });
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("Last check");
  expect(screen.getByText("Last check").nextElementSibling).toHaveTextContent("Apr 16, 2026, 12:00 PM");
});

it("uses the selected Chinese locale for the last check", async () => {
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2026-04-16T12:00:00.000Z", assets: [] }], prices: {}, excludedSymbols: [],
  });
  function SetChinese() {
    const { setLocale } = useTranslation();
    return <button onClick={() => setLocale("zh")}>中文</button>;
  }
  render(<I18nProvider><SetChinese /><GoalsAlerts /></I18nProvider>);
  await userEvent.click(screen.getByRole("button", { name: "中文" }));
  await waitFor(() => expect(screen.getByText("最近检查").nextElementSibling).toHaveTextContent("2026年4月16日 12:00"));
});

it("opens the rule editor when editing a saved rule", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  render(<GoalsAlerts />);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("dialog", { name: "Edit rule" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("closes the new-rule drawer after saving and returns focus to its trigger", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByRole("button", { name: "Edit" });
  const trigger = screen.getByRole("button", { name: "New rule" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "New rule" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.type(within(dialog).getByRole("spinbutton", { name: "Threshold" }), "1000");
  await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it("closes the rule drawer with Escape after opening it from an outside button", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByRole("button", { name: "Edit" });
  const trigger = screen.getByRole("button", { name: "New rule" });
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it("does not turn the inline editor into a drawer after the first rule is saved", async () => {
  vi.mocked(saveAlertRule).mockImplementation(async () => {
    vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  });
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  await user.type(screen.getByRole("spinbutton", { name: "Threshold" }), "1000");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  await screen.findByRole("button", { name: "Edit" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("scrolls to the inline editor when New rule is pressed before any rules exist", async () => {
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  const editor = document.getElementById("goal-rule-editor")!;
  const scrollIntoView = vi.fn();
  editor.scrollIntoView = scrollIntoView;
  await userEvent.click(screen.getByRole("button", { name: "New rule" }));
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" }));
});

it("shows the empty state and a clear explanation before notification permission", async () => {
  render(<GoalsAlerts />);
  expect(await screen.findByText("No rules yet")).toBeInTheDocument();
  expect(screen.getByText(/Allow system notifications/i)).toBeInTheDocument();
  expect(enableSystemNotifications).not.toHaveBeenCalled();
});

it("shows an AI setup entry before manual rule editing", async () => {
  render(<GoalsAlerts />);
  expect(await screen.findByText("Let the assistant set this up")).toBeInTheDocument();
  expect(await screen.findByText("Alert me if my total value drops 10% in 7 days")).toBeInTheDocument();
  expect(screen.getByText("Manual setup").closest("details")).toHaveAttribute("open");
});

it("validates a new goal before saving", async () => {
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  expect(saveAlertRule).not.toHaveBeenCalled();
  const threshold = screen.getByLabelText("Threshold");
  const error = screen.getByText(/enter a valid threshold/i);
  expect(threshold).toHaveAttribute("aria-invalid", "true");
  expect(threshold).toHaveAttribute("aria-describedby", error.id);
  await user.type(threshold, "1000");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  await waitFor(() => expect(saveAlertRule).toHaveBeenCalledWith(expect.objectContaining({
    kind: "total_value_target", threshold: 1000,
  })));
});

it("keeps success and validation feedback in separate live regions", async () => {
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(/enter a valid threshold/i);
  await user.type(screen.getByLabelText("Threshold"), "1000");
  await user.click(screen.getByRole("button", { name: "Save rule" }));
  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent(/saved/i);
  expect(status).not.toBe(alert);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

it("marks a portfolio loss in the history timeline as high severity", async () => {
  vi.mocked(listAlertHistory).mockResolvedValue([{
    id: 2, ruleId: 2, kind: "period_pnl", title: "Portfolio P&L",
    message: "Portfolio P&L -10%", value: -10,
    triggeredAt: "2026-10-17T12:00:00.000Z", acknowledgedAt: null,
  }]);
  render(<GoalsAlerts />);
  expect((await screen.findByText(/Period P&L triggered/)).closest("li")).toHaveAttribute("data-severity", "high");
});

it("shows an already granted notification permission on opening the page", async () => {
  vi.mocked(systemNotificationsEnabled).mockResolvedValue(true);
  render(<GoalsAlerts />);
  expect(await screen.findByRole("button", { name: "System notifications enabled" })).toBeInTheDocument();
  expect(enableSystemNotifications).not.toHaveBeenCalled();
});

it("asks before deleting a rule", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByRole("checkbox", { name: "Enable Portfolio value goal" });
  await user.click(screen.getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toBeInTheDocument();
  const results = await axe.run(dialog, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations).toEqual([]);
  expect(deleteAlertRule).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(deleteAlertRule).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(deleteAlertRule).toHaveBeenCalledWith(7));
});

it("toggles a rule off and back on", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  vi.mocked(setAlertRuleEnabled).mockImplementation(async (_id, enabled) => {
    vi.mocked(listAlertRules).mockResolvedValue([{ ...savedRule, enabled }]);
  });
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  const toggle = await screen.findByRole("checkbox", { name: "Enable Portfolio value goal" });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(setAlertRuleEnabled).toHaveBeenCalledWith(7, false);
  await user.click(toggle);
  await waitFor(() => expect(toggle).toBeChecked());
  expect(setAlertRuleEnabled).toHaveBeenCalledWith(7, true);
});

it("confirms before clearing alert history", async () => {
  vi.mocked(listAlertHistory).mockResolvedValue([{
    id: 1, ruleId: 7, kind: "total_value_target", title: "Portfolio goal reached",
    message: "Portfolio goal reached: 100.00", value: 100,
    triggeredAt: "2026-10-17T12:00:00.000Z", acknowledgedAt: null,
  }]);
  vi.mocked(clearAlertHistory).mockImplementation(async () => {
    vi.mocked(listAlertHistory).mockResolvedValue([]);
  });
  const user = userEvent.setup();
  render(<GoalsAlerts />);
  await screen.findByText(/Portfolio value goal triggered/);
  await user.click(screen.getByRole("button", { name: "Clear history" }));
  expect(await screen.findByRole("alertdialog")).toHaveTextContent("Permanently remove all alert history?");
  expect(clearAlertHistory).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(clearAlertHistory).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Clear history" }));
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Clear history" }));
  await waitFor(() => expect(clearAlertHistory).toHaveBeenCalledOnce());
  expect(await screen.findByText("No alerts yet")).toBeInTheDocument();
});

it("labels a rule with stale portfolio data", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2026-10-17T12:00:00.000Z", assets: [], hasStaleSources: true }], prices: {}, excludedSymbols: [],
  });
  render(<GoalsAlerts />);
  expect(await screen.findByText(/Data stale/)).toBeInTheDocument();
});

it("shows the available P&L for a displayed period rule", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{ ...savedRule, kind: "period_pnl", window: "7d" }]);
  vi.mocked(loadAlertEvaluationData).mockImplementation(async (...args) => ({
    snapshots: [{
      at: "2026-10-17T12:00:00.000Z", assets: [],
      pnl: ((args as unknown[])[3] as string[] | undefined)?.includes("7d") ? { "7d": 12 } : undefined,
    }], prices: {}, excludedSymbols: [],
  }));
  render(<GoalsAlerts />);
  expect(await screen.findByText(/Current: 12.00/)).toBeInTheDocument();
});
