import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import GoalsFidelity from "@/mobile/components/goals-fidelity";
import type { AlertHistory, AlertPrices, AlertRule } from "@/middlelayers/alerts";
import { alertRuleFromDraft, type AlertDraft } from "@/middlelayers/ui-state/alert-draft";
import { I18nProvider } from "@/mobile/i18n";

const draft: AlertDraft = {
  id: 0, kind: "total_value_target", assetType: "crypto", symbol: "",
  comparator: "gte", threshold: "900000", window: "24h", cooldownMinutes: "60",
};
const rule = alertRuleFromDraft({ ...draft, id: 1, comparator: "lte", threshold: "50000" });

function renderGoals(next: { rules?: AlertRule[]; draft?: AlertDraft; editorOpen?: boolean; portfolioChange?: number;
  history?: AlertHistory[]; prices?: AlertPrices; locale?: "zh" } = {}) {
  if (next.locale) vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
  const content = <MemoryRouter><GoalsFidelity
    rules={next.rules ?? []} history={next.history ?? []} unreadCount={next.history?.filter((item) => !item.acknowledgedAt).length ?? 0}
    snapshots={[{ at: "2026-10-31T09:41:00.000Z", assets: [{
      assetType: "crypto", symbol: "BTC", value: 63_842, price: 63_842, wallet: "wallet",
    }], portfolioChange: next.portfolioChange === undefined ? undefined : { "24h": next.portfolioChange } }]}
    prices={next.prices ?? {}} loading={false} error="" status="" draft={next.draft ?? draft}
    editorOpen={next.editorOpen ?? false} onDraft={vi.fn()} onOpenEditor={vi.fn()}
    onCloseEditor={vi.fn()} onSave={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()}
    onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
  /></MemoryRouter>;
  return render(next.locale ? <I18nProvider>{content}</I18nProvider> : content);
}

it("shows partial progress for a price or value goal above an at-most threshold", () => {
  renderGoals({ rules: [rule] });
  const row = screen.getByText("Portfolio value").closest(".pf-goal-row")!;
  expect(within(row as HTMLElement).getByText("78.3%")).toBeInTheDocument();
  expect(within(row as HTMLElement).getByText("Watching")).toBeInTheDocument();
  expect(within(row as HTMLElement).getByRole("progressbar", { name: "Progress toward Portfolio value goal" }))
    .toHaveAttribute("aria-valuenow", "78.3");
});

it("shows the measured rule value on its progress mark", () => {
  renderGoals({ rules: [rule] });
  const mark = document.querySelector(".pf-goal-progress [data-chart-mark]");
  expect(mark).not.toBeNull();
  fireEvent.pointerEnter(mark!);
  expect(screen.getByRole("tooltip")).toHaveTextContent("78.3%");
});

it("opens a prefilled template from the empty phone Rules panel", async () => {
  const onOpenEditor = vi.fn();
  render(<MemoryRouter><GoalsFidelity
    rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
    loading={false} error="" status="" draft={draft} editorOpen={false}
    onDraft={vi.fn()} onOpenEditor={onOpenEditor} onCloseEditor={vi.fn()} onSave={vi.fn()}
    onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
  /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "BTC above a price" }));
  expect(onOpenEditor).toHaveBeenCalledWith(undefined, expect.objectContaining({
    kind: "asset_price_target", symbol: "BTC", threshold: "70000",
  }));
  expect(screen.getByRole("button", { name: "Acknowledge all" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
});

it("previews the selected kind without invented asset or threshold examples", async () => {
  renderGoals({ editorOpen: true });
  const preview = screen.getByText("Preview").closest(".pf-preview")!;
  expect(preview).toHaveTextContent("$900,000");
  expect(preview).toHaveTextContent("portfolio");
  expect(preview).not.toHaveTextContent("SOL");
  expect(preview).not.toHaveTextContent("900000%");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
});

it("shows zero in an invalid move threshold without treating it as entered", async () => {
  renderGoals({ editorOpen: true, draft: {
    ...draft, kind: "asset_price_move", symbol: "", threshold: "",
  } });
  await userEvent.click(within(document.querySelector(".pf-editor") as HTMLElement).getByRole("button", { name: "Add rule" }));
  const threshold = screen.getByRole("spinbutton", { name: "Threshold" });
  expect(threshold).toHaveValue(null);
  expect(threshold).toHaveAttribute("placeholder", "0");
  expect(screen.getByText("Enter a move larger than 0%")).toBeInTheDocument();
});

it("uses percentage points in an allocation rule preview", () => {
  renderGoals({ editorOpen: true, draft: {
    ...draft, kind: "allocation_deviation", symbol: "BTC", threshold: "2",
  } });
  const preview = screen.getByText("Preview").closest(".pf-preview")!;
  expect(preview).toHaveTextContent(/BTC.*2.*pts/);
  expect(preview).not.toHaveTextContent("2%");
});

it("describes an at-most value rule as a fall toward its threshold", () => {
  renderGoals({ rules: [rule] });
  const row = screen.getByText("Portfolio value").closest(".pf-goal-row")!;
  expect(row).toHaveTextContent("Falls to or below $50,000");
  expect(row).toHaveTextContent("$13,842.00 to fall");
});

it("shows the drop needed for an at-most price rule", () => {
  renderGoals({ rules: [{ ...rule, kind: "asset_price_target", assetType: "crypto", symbol: "BTC" }] });
  const row = screen.getByText("BTC price").closest(".pf-goal-row")!;
  expect(row).toHaveTextContent("−21.7% needed");
});

it("edits a falling price move as a positive magnitude and saves a negative threshold", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, id: 2, kind: "asset_price_move", symbol: "BTC",
      comparator: "lte", threshold: "-10",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  const threshold = screen.getByRole("spinbutton", { name: "Threshold" });
  expect(threshold).toHaveValue(10);
  await userEvent.clear(threshold);
  await userEvent.type(threshold, "12");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[0]).toMatchObject({ comparator: "lte", threshold: -12 });
});

it("normalizes a falling portfolio move when switching from a value rule", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, comparator: "lte", threshold: "50000",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Kind" }), "portfolio_value_change");
  const threshold = screen.getByRole("spinbutton", { name: "Threshold" });
  expect(threshold).toHaveValue(50000);
  await userEvent.clear(threshold);
  await userEvent.type(threshold, "5");
  await userEvent.click(screen.getAllByRole("button", { name: "Add rule" }).at(-1)!);
  expect(saved[0]).toMatchObject({ kind: "portfolio_value_change", comparator: "lte", threshold: -5 });
});

it("keeps the entered magnitude when switching to a move kind", async () => {
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, comparator: "lte", threshold: "12",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()}
      onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Kind" }), "asset_price_move");
  expect(screen.getByRole("spinbutton", { name: "Threshold" })).toHaveValue(12);
});

it("shows a rising portfolio move's positive trigger and a falling move's magnitude", () => {
  renderGoals({ portfolioChange: 2, rules: [
    { ...rule, id: 2, kind: "portfolio_value_change", comparator: "gte", threshold: 5, window: "24h" },
    { ...rule, id: 3, kind: "portfolio_value_change", comparator: "lte", threshold: -5, window: "24h" },
  ] });
  expect(screen.getByText(/Fires at \+5\.0% or higher/)).toBeInTheDocument();
  expect(screen.getByText(/Fires at −5\.0% or lower/)).toBeInTheDocument();
  expect(screen.getByText(/Falls more than 5%/)).toBeInTheDocument();
});

it("names an alert from its kind when its rule is missing", () => {
  renderGoals({ history: [{
    id: 9, ruleId: 999, kind: "asset_price_move", title: "Old SOL alert",
    message: "Previously triggered", value: 4, triggeredAt: "2026-10-31T09:41:00.000Z",
    acknowledgedAt: null,
  }] });
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("Asset price move");
});

it("uses a linked rule to name alert history when its stored message wording changes", () => {
  renderGoals({
    rules: [{ ...rule, id: 8, kind: "asset_price_target", symbol: "BTC", comparator: "gte", threshold: 70000 }],
    history: [{
      id: 12, ruleId: 8, kind: "asset_price_target", title: "BTC target",
      message: "Updated alert wording", symbol: "BTC", value: 71000,
      triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null,
    }],
  });
  expect(screen.getByText("BTC price above $70,000")).toBeInTheDocument();
  expect(screen.getByText(/71,000.*refresh/)).toBeInTheDocument();
});

it("shows percentage remaining for the closest price move", () => {
  renderGoals({
    rules: [{ ...rule, id: 8, kind: "asset_price_move", assetType: "crypto", symbol: "BTC",
      comparator: "gte", threshold: 10, window: "24h" }],
    prices: { "24h": { "crypto:BTC": 60_000 } },
  });
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("3.6% to go");
});

it("shows how far a falling move has crossed its negative threshold", () => {
  renderGoals({
    rules: [{ ...rule, id: 8, kind: "asset_price_move", assetType: "crypto", symbol: "BTC",
      comparator: "lte", threshold: -10, window: "24h" }],
    prices: { "24h": { "crypto:BTC": 72_000 } },
  });
  expect(screen.getByText(/Over by 1\.3 pts/)).toBeInTheDocument();
});

it("uses the approved cooldown wording in a live preview", () => {
  renderGoals({
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", window: "24h", cooldownMinutes: "360" },
    prices: { "24h": { "crypto:BTC": 56_000 } },
  });
  expect(screen.getByText(/6 hour cooldown/)).toBeInTheDocument();
});

it("does not predict a rising move will fire below its threshold", () => {
  renderGoals({
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", window: "24h", cooldownMinutes: "1440" },
    prices: { "24h": { "crypto:BTC": 62_000 } },
  });
  const preview = screen.getByText("Preview").closest(".pf-preview")!;
  expect(preview).toHaveTextContent("Right now: +3.0%");
  expect(preview).toHaveTextContent("would not fire");
  expect(preview).not.toHaveTextContent("would fire at the next refresh");
});

it("predicts a rising move will fire when it reaches its threshold", () => {
  renderGoals({
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", window: "24h", cooldownMinutes: "1440" },
    prices: { "24h": { "crypto:BTC": 58_000 } },
  });
  const preview = screen.getByText("Preview").closest(".pf-preview")!;
  expect(preview).toHaveTextContent("would fire at the next refresh");
});

it("names a seven day cooldown in days in the live preview", () => {
  renderGoals({
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", window: "24h", cooldownMinutes: "10080" },
    prices: { "24h": { "crypto:BTC": 56_000 } },
  });
  expect(screen.getByText(/7 day cooldown/)).toBeInTheDocument();
  expect(screen.queryByText(/168 hour/)).not.toBeInTheDocument();
});

it("shows a stored two-hour cooldown in the editor without changing its selected value", () => {
  renderGoals({
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", cooldownMinutes: "120" },
    prices: { "24h": { "crypto:BTC": 56_000 } },
  });
  expect(screen.getByRole("combobox", { name: "Cooldown" })).toHaveValue("120");
  expect(screen.getByText("2 hours", { selector: ".pf-select > span" })).toBeInTheDocument();
  expect(screen.getByText(/2 hour cooldown/)).toBeInTheDocument();
});

it("names a 30-minute cooldown in minutes in the rule and preview", () => {
  renderGoals({
    rules: [alertRuleFromDraft({ ...draft, id: 3, kind: "asset_price_move", symbol: "BTC", threshold: "10", cooldownMinutes: "30" })],
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", cooldownMinutes: "30" },
    prices: { "24h": { "crypto:BTC": 56_000 } },
  });
  expect(screen.getByText("Cooldown 30m")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Cooldown" })).toHaveValue("30");
  expect(screen.getByText(/30 minute cooldown/)).toBeInTheDocument();
});

it("shows a zero cooldown as zero minutes without inventing a day", () => {
  renderGoals({
    rules: [alertRuleFromDraft({ ...draft, id: 3, kind: "asset_price_move", symbol: "BTC", threshold: "10", cooldownMinutes: "0" })],
    editorOpen: true,
    draft: { ...draft, kind: "asset_price_move", symbol: "BTC", threshold: "10", cooldownMinutes: "0" },
    prices: { "24h": { "crypto:BTC": 56_000 } },
  });
  expect(screen.getByText("Cooldown 0m")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Cooldown" })).toHaveValue("0");
  expect(screen.getByText(/0 minute cooldown/)).toBeInTheDocument();
});

it("keeps the designed 24h and 7d rule labels", () => {
  renderGoals({ rules: [
    alertRuleFromDraft({ ...draft, id: 1, cooldownMinutes: "1440" }),
    alertRuleFromDraft({ ...draft, id: 2, cooldownMinutes: "10080" }),
  ] });
  expect(screen.getByText("Cooldown 24h")).toBeInTheDocument();
  expect(screen.getByText("Cooldown 7d")).toBeInTheDocument();
});

it("separates unread rule names using the selected language", () => {
  try {
    renderGoals({ locale: "zh", rules: [
      { ...rule, id: 1, kind: "asset_price_move", symbol: "SOL", window: "7d" },
      { ...rule, id: 2, kind: "allocation_deviation", symbol: "BTC" },
    ], history: [
      { id: 1, ruleId: 1, kind: "asset_price_move", title: "", message: "", value: 1,
        triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null },
      { id: 2, ruleId: 2, kind: "allocation_deviation", title: "", message: "", value: 1,
        triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null },
    ] });
    expect(screen.getByTestId("goals-summary")).toHaveTextContent("SOL 7 天涨跌、BTC 配置");
  } finally {
    vi.restoreAllMocks();
  }
});

it("localizes seven-day windows throughout a Chinese move rule", () => {
  try {
    renderGoals({ locale: "zh", rules: [{
      ...rule, id: 8, kind: "asset_price_move", assetType: "crypto", symbol: "BTC",
      comparator: "gte", threshold: 5, window: "7d",
    }, { ...rule, id: 9, kind: "period_pnl", window: "30d" }],
    prices: { "7d": { "crypto:BTC": 60_000 } } });
    const row = document.querySelector(".pf-goal-row")!;
    expect(row).toHaveTextContent("BTC 7 天涨跌");
    expect(row).toHaveTextContent("7 天内");
    expect(row).not.toHaveTextContent("7d");
    expect(row).toHaveTextContent("冷却 1 小时");
    expect(document.querySelectorAll(".pf-goal-row")[1]).toHaveTextContent("30 天 盈亏");
  } finally {
    vi.restoreAllMocks();
  }
});

it("spells out saved cooldown durations in Chinese rule rows", () => {
  try {
    renderGoals({ locale: "zh", rules: [
      alertRuleFromDraft({ ...draft, id: 1, cooldownMinutes: "1440" }),
      alertRuleFromDraft({ ...draft, id: 2, cooldownMinutes: "10080" }),
    ] });
    expect(screen.getByText("冷却 24 小时")).toBeInTheDocument();
    expect(screen.getByText("冷却 7 天")).toBeInTheDocument();
  } finally {
    vi.restoreAllMocks();
  }
});

it("keeps the sign of a legacy move threshold when its magnitude is edited", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, id: 2, kind: "asset_price_move", symbol: "BTC",
      comparator: "gte", threshold: "-10",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  const threshold = screen.getByRole("spinbutton", { name: "Threshold" });
  await userEvent.clear(threshold);
  await userEvent.type(threshold, "12");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[0]).toMatchObject({ comparator: "gte", threshold: -12 });
});

it.each([
  ["gte", "-10", -10],
  ["lte", "10", 10],
] as const)("keeps a legacy %s move rule unchanged after a comparator round trip", async (comparator, threshold, expected) => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, id: 2, kind: "asset_price_move", symbol: "BTC", comparator, threshold,
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  const select = screen.getByRole("combobox", { name: "Comparator" });
  await userEvent.selectOptions(select, comparator === "gte" ? "lte" : "gte");
  await userEvent.selectOptions(select, comparator);
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[0]).toMatchObject({ comparator, threshold: expected });
});

it("resets a legacy move sign baseline when the same rule is reopened after saving", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, id: 2, kind: "asset_price_move", symbol: "BTC",
      comparator: "gte", threshold: "-10",
    });
    const [open, setOpen] = useState(true);
    return <MemoryRouter><button onClick={() => setOpen(true)}>Reopen editor</button><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen={open}
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={() => setOpen(false)}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); setOpen(false); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Comparator" }), "lte");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[0]).toMatchObject({ comparator: "lte", threshold: -10 });
  await userEvent.click(screen.getByRole("button", { name: "Reopen editor" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Comparator" }), "gte");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[1]).toMatchObject({ comparator: "gte", threshold: 10 });
});

it("types a falling move as negative after changing the comparator with an empty threshold", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, kind: "asset_price_move", symbol: "BTC", comparator: "gte", threshold: "",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Comparator" }), "lte");
  await userEvent.type(screen.getByRole("spinbutton", { name: "Threshold" }), "5");
  await userEvent.click(within(document.querySelector(".pf-editor-footer") as HTMLElement).getByRole("button", { name: "Add rule" }));
  expect(saved[0]).toMatchObject({ comparator: "lte", threshold: -5 });
});

it("saves the selected asset type when stock and crypto share a symbol", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, kind: "asset_price_target", symbol: "BTC", assetType: "crypto",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0}
      snapshots={[{ at: "2026-10-31T09:41:00.000Z", assets: [
        { assetType: "crypto", symbol: "BTC", value: 60, price: 60, wallet: "crypto-wallet" },
        { assetType: "stock", symbol: "BTC", value: 90, price: 90, wallet: "stock-wallet" },
      ] }]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Asset" }), "stock:BTC");
  expect(document.querySelector(".pf-select-asset")).toHaveTextContent("BTC · $90.00");
  expect(document.querySelector(".pf-select-asset")).not.toHaveTextContent("Bitcoin");
  await userEvent.click(within(document.querySelector(".pf-editor-footer") as HTMLElement).getByRole("button", { name: "Add rule" }));
  expect(saved[0]).toMatchObject({ assetType: "stock", symbol: "BTC" });
});

it("localizes stored English alert history from its kind and value", () => {
  const language = vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
  try {
    render(<I18nProvider><MemoryRouter><GoalsFidelity
      rules={[]} history={[{
        id: 9, ruleId: null, kind: "asset_price_move", title: "SOL price moved",
        message: "SOL price moved: 14.30 (at least 10.00)", symbol: "SOL", value: 14.3,
        triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null,
      }]} unreadCount={1} snapshots={[]} prices={{}}
      loading={false} error="" status="" draft={draft} editorOpen={false}
      onDraft={vi.fn()} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()} onSave={vi.fn()}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter></I18nProvider>);
    expect(screen.getByTestId("goals-summary")).toHaveTextContent("SOL");
    expect(screen.getByTestId("goals-summary")).not.toHaveTextContent("price moved");
    expect(screen.getByText(/14\.30%/)).toBeInTheDocument();
    expect(screen.queryByText(/at least 10\.00/)).not.toBeInTheDocument();
  } finally {
    language.mockRestore();
  }
});

it("uses a live rule and stored trigger threshold to name alert history", () => {
  const live = alertRuleFromDraft({
    ...draft, id: 4, kind: "asset_price_move", symbol: "SOL",
    threshold: "10", window: "7d",
  });
  renderGoals({ rules: [live], history: [
    {
      id: 1, ruleId: 4, kind: "asset_price_move", symbol: "SOL",
      title: "SOL price moved", message: "SOL price moved: 14.30 (at least 10.00)",
      value: 14.3, triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null,
    },
    {
      id: 2, ruleId: null, kind: "asset_price_target", symbol: "ETH",
      title: "ETH price target reached", message: "ETH price target reached: 2524.33 (at least 2500.00)",
      value: 2524.33, triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: "2026-10-27T10:00:00.000Z",
    },
    {
      id: 3, ruleId: null, kind: "total_value_target", symbol: null,
      title: "Portfolio goal reached", message: "Portfolio goal reached: 752683.57 (at least 750000.00)",
      value: 752683.57, triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: "2026-10-27T10:00:00.000Z",
    },
  ] });
  const titles = [...document.querySelectorAll(".pf-alert-row b")].map((node) => node.textContent);
  expect(titles).toEqual(["SOL 7d move above 10%", "ETH price above $2,500", "Portfolio value reached $750,000"]);
  expect(document.querySelectorAll(".pf-alert-row")[1]).toHaveTextContent("$2,524.33 on the 27 Oct refresh");
  expect(document.querySelectorAll(".pf-alert-row")[2]).toHaveTextContent("$752,683.57 on the 27 Oct refresh");
});

it("keeps the sign of a loss in localized P&L history", () => {
  renderGoals({ history: [{
    id: 10, ruleId: null, kind: "period_pnl", title: "Period P&L threshold reached",
    message: "Period P&L threshold reached: -40.00 (at most -20.00)",
    symbol: null, value: -40, triggeredAt: "2026-10-31T09:41:00.000Z",
    acknowledgedAt: null,
  }] });
  expect(screen.getByText(/−\$40\.00/)).toBeInTheDocument();
});

it("names any-asset allocation rules and history without exposing the wildcard symbol", () => {
  const anyRule = alertRuleFromDraft({
    ...draft, id: 12, kind: "allocation_deviation", symbol: "*", threshold: "2",
  });
  renderGoals({ rules: [anyRule], history: [{
    id: 15, ruleId: 12, kind: "allocation_deviation", symbol: "*",
    title: "Any asset allocation deviated",
    message: "Any asset allocation deviated: 3.10 (at least 2.00)",
    value: 3.1, triggeredAt: "2026-10-31T09:41:00.000Z", acknowledgedAt: null,
  }] });
  expect(screen.getAllByText("Any asset allocation").length).toBeGreaterThan(0);
  expect(document.querySelector(".pf-alert-row")).toHaveTextContent("Any asset allocation off target");
  expect(screen.getByTestId("goals-phone")).not.toHaveTextContent("* allocation");
});

it("lets an any-asset allocation rule retain its wildcard after changing the asset choice", async () => {
  const saved: AlertRule[] = [];
  function Editor() {
    const [value, setValue] = useState<AlertDraft>({
      ...draft, id: 12, kind: "allocation_deviation", symbol: "*", threshold: "2",
    });
    return <MemoryRouter><GoalsFidelity
      rules={[]} history={[]} unreadCount={0}
      snapshots={[{ at: "2026-10-31T09:41:00.000Z", assets: [
        { assetType: "crypto", symbol: "BTC", value: 60, price: 60, wallet: "wallet" },
      ] }]} prices={{}}
      loading={false} error="" status="" draft={value} editorOpen
      onDraft={setValue} onOpenEditor={vi.fn()} onCloseEditor={vi.fn()}
      onSave={async () => { saved.push(alertRuleFromDraft(value)); }}
      onToggle={vi.fn()} onDelete={vi.fn()} onAck={vi.fn()} onAckAll={vi.fn()} onClear={vi.fn()}
    /></MemoryRouter>;
  }
  render(<Editor />);
  const asset = screen.getByRole("combobox", { name: "Asset" });
  expect(asset).toHaveValue("crypto:*");
  expect(asset.closest(".pf-select")).toHaveTextContent("Any crypto asset");
  await userEvent.selectOptions(asset, "crypto:BTC");
  await userEvent.selectOptions(asset, "crypto:*");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(saved[0]).toMatchObject({ kind: "allocation_deviation", assetType: "crypto", symbol: "*" });
});
