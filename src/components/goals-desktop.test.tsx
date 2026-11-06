import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";
import type { AlertRule } from "@/middlelayers/alerts";
import { alertDraftFromRule, alertRuleFromDraft } from "@/middlelayers/ui-state/alert-draft";
import { I18nProvider, useTranslation } from "@/i18n";
import GoalsDesktop, { GoalsKinds } from "./goals-desktop";

vi.mock("./fidelity-rail", () => ({ default: () => null }));

const rule: AlertRule = alertRuleFromDraft({
  id: 1, kind: "asset_price_move", assetType: "stock", symbol: "AAPL",
  comparator: "lte", threshold: "10", window: "7d", cooldownMinutes: "90",
});
const snapshot = {
  at: "2026-10-30T09:00:00.000Z",
  assets: [{ assetType: "stock" as const, symbol: "AAPL", wallet: "broker", amount: 1, value: 90, price: 90 }],
};

function props(overrides: Partial<ComponentProps<typeof GoalsDesktop>> = {}): ComponentProps<typeof GoalsDesktop> {
  return {
    rules: [rule], history: [], unreadCount: 0, snapshots: [snapshot],
    prices: { "7d": { "stock:AAPL": 100 } }, loading: false, error: "", status: "",
    draft: alertDraftFromRule(rule), editorOpen: false,
    onDraft: vi.fn(), onEditorOpen: vi.fn(), onEditorCloseFocus: vi.fn(),
    onEdit: vi.fn(), onAdd: vi.fn(), onSave: vi.fn(), onToggle: vi.fn(),
    onDelete: vi.fn(), onAcknowledge: vi.fn(), onAcknowledgeAll: vi.fn(),
    onClear: vi.fn(), onEnableNotifications: vi.fn(), notificationsEnabled: false, ...overrides,
  };
}

it("keeps the selected asset type when editing a stock rule", () => {
  const onDraft = vi.fn();
  render(<GoalsDesktop {...props({ editorOpen: true, onDraft })} />);
  const picker = screen.getByRole("combobox", { name: "Asset" });
  expect(picker).toHaveValue("stock:AAPL");
  fireEvent.change(picker, { target: { value: "stock:AAPL" } });
  expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ assetType: "stock", symbol: "AAPL" }));
});

it("opens a prefilled template from the empty Rules panel", () => {
  const onAdd = vi.fn();
  render(<GoalsDesktop {...props({ rules: [], history: [], onAdd })} />);
  fireEvent.click(screen.getByRole("button", { name: "BTC above a price" }));
  expect(onAdd).toHaveBeenCalledWith(expect.any(HTMLButtonElement), expect.objectContaining({
    kind: "asset_price_target", symbol: "BTC", threshold: "70000",
  }));
  expect(screen.getByRole("button", { name: "Acknowledge all" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
});

it("lists only the two available comparators for move and allocation rules", () => {
  render(<GoalsKinds />);
  for (const title of ["Asset price move", "Allocation deviation"]) {
    const card = screen.getByRole("heading", { name: title }).closest("section")!;
    expect(within(card).getByText("2 options", { exact: true })).toBeInTheDocument();
  }
});

it("shows and retains a custom cooldown", () => {
  render(<GoalsDesktop {...props({ editorOpen: true })} />);
  expect(screen.getByText("Cooldown 90m")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Cooldown" })).toHaveValue("90");
  expect(within(screen.getByRole("combobox", { name: "Cooldown" })).getByRole("option", { name: "90m" })).toBeInTheDocument();
});

it("labels a seven day cooldown with the correct unit", () => {
  render(<GoalsDesktop {...props({ rules: [alertRuleFromDraft({ ...alertDraftFromRule(rule), cooldownMinutes: "10080" })] })} />);
  expect(screen.getByText("Cooldown 7d")).toBeInTheDocument();
});

it("previews the selected comparator and measured threshold", () => {
  render(<GoalsDesktop {...props({ editorOpen: true })} />);
  expect(document.querySelector(".t3-fidelity-preview")).toHaveTextContent(/AAPL.*falls.*10%.*7 days.*−10.0%.*would fire/i);
  expect(document.querySelector(".t3-fidelity-preview")).toHaveTextContent("so it would fire at the next refresh once the 90m cooldown allows");
});

it("uses the design's full cooldown wording for a one-day preview", () => {
  render(<GoalsDesktop {...props({
    editorOpen: true,
    draft: { ...alertDraftFromRule(rule), cooldownMinutes: "1440" },
  })} />);
  expect(document.querySelector(".t3-fidelity-preview")).toHaveTextContent("once the 24 hour cooldown allows");
});

it("does not claim a rule would fire below its threshold", () => {
  render(<GoalsDesktop {...props({ editorOpen: true, draft: { ...alertDraftFromRule(rule), comparator: "gte" } })} />);
  expect(screen.getByText(/would not fire/i)).toBeInTheDocument();
});

it("localizes stored alert history instead of showing raw text", () => {
  render(<GoalsDesktop {...props({ history: [{
    id: 3, ruleId: 1, kind: "asset_price_move", symbol: "AAPL", title: "raw title",
    message: "raw message", value: -10, triggeredAt: snapshot.at, acknowledgedAt: null,
  }] })} />);
  expect(screen.queryByText("raw title")).not.toBeInTheDocument();
  expect(screen.queryByText("raw message")).not.toBeInTheDocument();
  expect(screen.getByText("AAPL 7d move below 10%")).toBeInTheDocument();
  expect(screen.getByText("−10.0% over 7 days: $100.00 to $90.00")).toBeInTheDocument();
});

it("formats stored history values and firing thresholds for each rule kind", () => {
  const priceRule = { ...rule, id: 2, kind: "asset_price_target" as const, comparator: "gte" as const, threshold: 2500, symbol: "ETH" };
  render(<GoalsDesktop {...props({
    rules: [rule, priceRule],
    history: [
      { id: 1, ruleId: 2, kind: "asset_price_target", symbol: "ETH", title: "ETH price target reached",
        message: "ETH price target reached: 2524.33 (at least 2500.00)", value: 2524.33,
        triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: null },
      { id: 2, ruleId: null, kind: "total_value_target", symbol: null, title: "Portfolio goal reached",
        message: "Portfolio goal reached: 752683.57 (at least 750000.00)", value: 752683.57,
        triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: "2026-10-27T10:00:00.000Z" },
    ],
  })} />);
  expect(screen.getByText("ETH price above $2,500")).toBeInTheDocument();
  expect(screen.getByText("$2,524.33 on the 27 Oct refresh")).toBeInTheDocument();
  expect(screen.getByText("Portfolio value reached $750,000")).toBeInTheDocument();
  expect(screen.getByText("$752,683.57 on the 27 Oct refresh")).toBeInTheDocument();
});

it("keeps deleted move and allocation alerts readable when their rule details are gone", () => {
  render(<GoalsDesktop {...props({
    rules: [],
    history: [
      { id: 3, ruleId: null, kind: "asset_price_move", symbol: "SOL", title: "SOL price moved",
        message: "old alert", value: 12.5, triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: null },
      { id: 4, ruleId: null, kind: "allocation_deviation", symbol: "BTC", title: "BTC allocation deviated",
        message: "old alert", value: 3.1, triggeredAt: "2026-10-27T09:40:00.000Z", acknowledgedAt: null },
    ],
  })} />);
  expect(screen.getByText("+12.5% on the 27 Oct refresh")).toBeInTheDocument();
  expect(screen.getByText("BTC was 3.1 pts off target on the 27 Oct refresh")).toBeInTheDocument();
});

it("describes a value threshold without a window hint", () => {
  const valueRule = { ...rule, kind: "total_value_target" as const, symbol: null, threshold: 100 };
  render(<GoalsDesktop {...props({ rules: [valueRule], draft: alertDraftFromRule(valueRule), editorOpen: true })} />);
  expect(screen.getByText("Portfolio value at which this rule fires")).toBeInTheDocument();
  expect(screen.queryByText("Price change over the window below")).not.toBeInTheDocument();
});

it("uses the selected currency for value rules", () => {
  const valueRule = { ...rule, kind: "asset_value_target" as const, comparator: "gte" as const, threshold: 100 };
  render(<GoalsDesktop {...props({
    currencySymbol: "€",
    rules: [valueRule], draft: alertDraftFromRule(valueRule), editorOpen: true,
  })} />);
  expect(screen.getByText("Reaches €100")).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Threshold" }).nextElementSibling).toHaveTextContent("€");
});

it("describes a percentage gap in points and dates the last check", () => {
  render(<GoalsDesktop {...props({
    rules: [{ ...rule, comparator: "lte", threshold: -15 }],
  })} />);
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("5.0 pts to go");
  expect(screen.getByTestId("goals-summary")).toHaveTextContent("30 Oct, on every refresh");
});

it("tones the empty rule count and last check like inactive metrics", () => {
  render(<GoalsDesktop {...props({ rules: [] })} />);
  const summary = screen.getByTestId("goals-summary");
  expect(summary.children[0].querySelector("strong")).toHaveAttribute("data-tone", "zero");
  expect(within(summary).getByText("09:00")).toHaveAttribute("data-tone", "zero");
});

it("links to the rule kinds guide", () => {
  render(<GoalsDesktop {...props()} />);
  expect(screen.getByRole("link", { name: "Rule kinds" })).toHaveAttribute("href", "#/goals/kinds");
});

it("offers a named notification control and announces when notifications are enabled", () => {
  const onEnableNotifications = vi.fn();
  const { rerender } = render(<GoalsDesktop {...props({ onEnableNotifications, notificationsEnabled: false })} />);
  const enable = screen.getByRole("button", { name: "Enable notifications" });
  expect(enable).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(enable);
  expect(onEnableNotifications).toHaveBeenCalledOnce();
  rerender(<GoalsDesktop {...props({ onEnableNotifications, notificationsEnabled: true })} />);
  expect(screen.getByRole("button", { name: "System notifications enabled" })).toHaveAttribute("aria-pressed", "true");
});

it("shows rule kind examples in the selected base currency", () => {
  render(<GoalsKinds currency={{ currency: "EUR", alias: "Euro", symbol: "€", rate: 1 }} />);
  expect(screen.getByText("€800,000")).toBeInTheDocument();
  expect(screen.getByText("EUR per unit")).toBeInTheDocument();
  expect(screen.queryByText("US dollars")).not.toBeInTheDocument();
});

it("shows the allocation threshold unit and guide example in Chinese", () => {
  function LocaleButtons() {
    const { setLocale } = useTranslation();
    return <><button onClick={() => setLocale("zh")}>中文</button><button onClick={() => setLocale("en")}>English</button></>;
  }
  const allocationRule = { ...rule, kind: "allocation_deviation" as const, threshold: 2 };
  const { rerender, unmount } = render(<I18nProvider><LocaleButtons /><GoalsDesktop {...props({
    rules: [allocationRule], draft: alertDraftFromRule(allocationRule),
  })} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  rerender(<I18nProvider><LocaleButtons /><GoalsDesktop {...props({
    rules: [allocationRule], draft: alertDraftFromRule(allocationRule), editorOpen: true,
  })} /></I18nProvider>);
  expect(screen.getByRole("spinbutton", { name: "阈值" }).nextElementSibling).toHaveTextContent("百分点");
  unmount();
  render(<I18nProvider><LocaleButtons /><GoalsKinds /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  const card = screen.getByRole("heading", { name: "配置偏离" }).closest("section")!;
  expect(card).toHaveTextContent("2.0 个百分点");
  expect(card).not.toHaveTextContent("pts");
  fireEvent.click(screen.getByRole("button", { name: "English" }));
});
