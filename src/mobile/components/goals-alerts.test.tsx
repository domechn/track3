import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, expect, it, vi } from "vitest";
import GoalsAlerts from "@/mobile/components/goals-alerts";
import { listAlertRules, listAlertHistory, countUnreadAlerts, saveAlertRule, setAlertRuleEnabled, acknowledgeAllAlerts, clearAlertHistory, deleteAlertRule, loadAlertEvaluationData, type AlertRule } from "@/middlelayers/alerts";
import { enableSystemNotifications, systemNotificationsEnabled } from "@/middlelayers/alert-notifications";
import { queryPNLChartValue } from "@/middlelayers/charts-timeseries";
import { isIOS } from "@/utils/platform";
import { I18nProvider, useTranslation } from "@/mobile/i18n";
vi.mock("@/utils/platform", async (original) => ({
  ...await original<typeof import("@/utils/platform")>(), isIOS: vi.fn(() => false),
}));
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
  vi.mocked(isIOS).mockReturnValue(false);
  vi.clearAllMocks();
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
  vi.mocked(countUnreadAlerts).mockResolvedValue(0);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({ snapshots: [], prices: {}, excludedSymbols: [] });
  vi.mocked(systemNotificationsEnabled).mockResolvedValue(false);
  vi.mocked(queryPNLChartValue).mockResolvedValue([]);
});

it("opens rule editing as a full-screen page on iPhone", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  expect(screen.queryByRole("button", { name: "Save rule" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add alert" }));
  expect(screen.getByRole("dialog", { name: "Add alert" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save rule" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog", { name: "Add alert" })).not.toBeInTheDocument();
});

it("keeps empty alert history actions out of the iPhone page", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  expect(screen.getByRole("button", { name: "Add alert" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Acknowledge all" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear history" })).not.toBeInTheDocument();
});

it("lets an iPhone owner choose an alert kind in one form row", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  render(<GoalsAlerts />);
  await userEvent.click(screen.getByRole("button", { name: "Add alert" }));
  const kind = screen.getByRole("combobox", { name: "Alert kind" });
  await userEvent.selectOptions(kind, "asset_value_target");
  expect(screen.getByRole("textbox", { name: "Symbol" })).toBeInTheDocument();
});

it("uses a switch to toggle a saved alert on iPhone", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  render(<GoalsAlerts />);
  const toggle = await screen.findByRole("switch", { name: "Enable Portfolio value goal" });
  await userEvent.click(toggle);
  expect(setAlertRuleEnabled).toHaveBeenCalledWith(7, false);
});

it("shows the goal progress ring beside the bar on iPhone", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2025-01-02T00:00:00.000Z", assets: [{ assetType: "crypto", symbol: "BTC", value: 50, price: 50, wallet: "wallet-a" }] }],
    prices: {}, excludedSymbols: [],
  });
  render(<GoalsAlerts />);
  expect(await screen.findByRole("img", { name: /Portfolio value goal.*50%/ })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Progress toward Portfolio value goal" })).toBeInTheDocument();
});

it("keeps the iPhone rule editor open when the initial rule query finishes", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  let finishRules!: (rules: AlertRule[]) => void;
  vi.mocked(listAlertRules).mockImplementation(() => new Promise((resolve) => {
    finishRules = resolve;
  }));
  render(<GoalsAlerts />);
  await userEvent.click(screen.getByRole("button", { name: "Add alert" }));
  expect(screen.getByRole("dialog", { name: "Add alert" })).toBeInTheDocument();
  await act(async () => { finishRules([]); });
  await screen.findByText("No rules yet");
  expect(screen.getByRole("dialog", { name: "Add alert" })).toBeInTheDocument();
});

it("traps focus and locks background scroll while the iPhone rule editor is open", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  render(<><button>Outside</button><GoalsAlerts /></>);
  await screen.findByText("No rules yet");
  await userEvent.click(screen.getByRole("button", { name: "Add alert" }));
  const dialog = screen.getByRole("dialog", { name: "Add alert" });
  expect(document.body.style.overflow).toBe("hidden");
  within(dialog).getByRole("button", { name: "Cancel" }).focus();
  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
  expect(dialog.contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "Add alert" })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
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

it("closes the fallback editor when Cancel is pressed", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([savedRule]);
  render(<GoalsAlerts />);
  await screen.findByRole("button", { name: "Edit" });
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const panel = screen.getByText("Manual setup").closest("details");
  expect(panel).toHaveAttribute("open");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(panel).not.toHaveAttribute("open"));
});

it("labels the capped history count as recent triggers", async () => {
  render(<GoalsAlerts />);
  await screen.findByText("No rules yet");
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("Recent triggers");
});

it("shows the full unread count when recent history is capped", async () => {
  vi.mocked(countUnreadAlerts).mockResolvedValue(205);
  render(<GoalsAlerts />);
  await waitFor(() => expect(screen.getByText("Unread alerts").nextElementSibling).toHaveTextContent("205"));
});

it("formats the last check compactly", async () => {
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2026-04-16T12:00:00.000Z", assets: [] }], prices: {}, excludedSymbols: [],
  });
  render(<GoalsAlerts />);
  await waitFor(() => expect(screen.getByText("Last check").nextElementSibling).toHaveTextContent("4/16/2026, 12:00"));
});

it("uses the selected Chinese locale for the last check on iPhone", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({
    snapshots: [{ at: "2026-04-16T12:00:00.000Z", assets: [] }], prices: {}, excludedSymbols: [],
  });
  function SetChinese() {
    const { setLocale } = useTranslation();
    return <button onClick={() => setLocale("zh")}>中文</button>;
  }
  render(<I18nProvider><SetChinese /><GoalsAlerts /></I18nProvider>);
  await userEvent.click(screen.getByRole("button", { name: "中文" }));
  await waitFor(() => expect(screen.getByText("最近检查").nextElementSibling).toHaveTextContent("2026/4/16 12:00"));
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
