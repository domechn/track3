// Regenerate only against 0.9.4: UPDATE_GOLDEN=1 corepack yarn vitest run src/test/golden/ui-shapes.test.tsx
// The seeded configuration is explicit; the saved formats below are captured from components.
// The full desktop and mobile shell date-range write is pinned in tests/e2e/format-golden.spec.ts.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext } from "react";
import { HashRouter } from "react-router-dom";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalConfig } from "@/middlelayers/datafetch/types";
import type { PersistedChatMessage } from "@/middlelayers/ai";
import type { AlertRule } from "@/middlelayers/alerts";
import DesktopConfiguration from "@/components/configuration";
import MobileConfiguration from "@/mobile/components/configuration";
import DesktopGoals from "@/components/goals-alerts";
import MobileGoals from "@/mobile/components/goals-alerts";
import DesktopComparison from "@/components/comparison";
import MobileComparison from "@/mobile/components/comparison";
import DesktopCostBasis from "@/components/cost-basis";
import MobileCostBasis from "@/mobile/components/cost-basis";
import DesktopRebalance from "@/components/rebalance";
import MobileRebalance from "@/mobile/components/rebalance";
import DesktopRefresh from "@/components/refresh-data";
import MobileRefresh from "@/mobile/components/refresh-data";
import {
  persistedToRuntime as desktopLoad,
  runtimeToPersisted as desktopSave,
} from "@/components/assistant/chat-page";
import {
  persistedToRuntime as mobileLoad,
  runtimeToPersisted as mobileSave,
} from "@/mobile/components/assistant/chat-page";
import { getConfiguration, saveConfiguration, updateAllCurrencyRates } from "@/middlelayers/configuration";
import { listAlertRules, listAlertHistory, loadAlertEvaluationData, saveAlertRule } from "@/middlelayers/alerts";
import { isIOS } from "@/utils/platform";
import { queryAllDataDates, queryCoinDataByUUID, refreshAllData } from "@/middlelayers/charts";
import { getRebalanceProfile, loadRebalanceHoldings } from "@/middlelayers/rebalance";
import { loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import { getCostBasisMethod } from "@/middlelayers/configuration";

vi.mock("@/middlelayers/configuration", async (original) => ({
  ...await original<typeof import("@/middlelayers/configuration")>(),
  getConfiguration: vi.fn(), saveConfiguration: vi.fn().mockResolvedValue(undefined),
  getCachedPreferCurrency: vi.fn(() => "USD"),
  queryPreferCurrency: vi.fn().mockResolvedValue({ currency: "USD", alias: "USD", rate: 1, symbol: "$" }),
  queryQuerySize: vi.fn().mockResolvedValue(10),
  updateAllCurrencyRates: vi.fn().mockResolvedValue(undefined),
  listAllCurrencyRates: vi.fn().mockResolvedValue([{ currency: "USD", alias: "USD", rate: 1, symbol: "$" }]),
  getCostBasisMethod: vi.fn().mockResolvedValue("FIFO"),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));
vi.mock("@/middlelayers/license", async (original) => ({
  ...await original<typeof import("@/middlelayers/license")>(),
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
}));
vi.mock("@/utils/platform", async (original) => ({
  ...await original<typeof import("@/utils/platform")>(), isIOS: vi.fn(() => false),
}));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/tmp") }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/middlelayers/alerts", async (original) => ({
  ...await original<typeof import("@/middlelayers/alerts")>(),
  listAlertRules: vi.fn().mockResolvedValue([]),
  listAlertHistory: vi.fn().mockResolvedValue([]),
  loadAlertEvaluationData: vi.fn().mockResolvedValue({ snapshots: [], prices: {}, excludedSymbols: [] }),
  saveAlertRule: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/middlelayers/alert-notifications", async (original) => ({
  ...await original<typeof import("@/middlelayers/alert-notifications")>(),
  systemNotificationsEnabled: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/middlelayers/charts-timeseries", async (original) => ({
  ...await original<typeof import("@/middlelayers/charts-timeseries")>(),
  queryPNLChartValue: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/middlelayers/charts", async (original) => ({
  ...await original<typeof import("@/middlelayers/charts")>(),
  queryAllDataDates: vi.fn(), queryCoinDataByUUID: vi.fn(), refreshAllData: vi.fn(),
}));
vi.mock("@/middlelayers/rebalance", async (original) => ({
  ...await original<typeof import("@/middlelayers/rebalance")>(),
  getRebalanceProfile: vi.fn().mockResolvedValue(undefined),
  loadRebalanceHoldings: vi.fn().mockResolvedValue({ holdings: [], stablecoinSymbols: [] }),
}));
vi.mock("@/middlelayers/cost-basis-data", async (original) => ({
  ...await original<typeof import("@/middlelayers/cost-basis-data")>(),
  loadCostBasisReport: vi.fn().mockResolvedValue({
    method: "FIFO", disposals: [], openLots: [], unrealized: [], warnings: [], assets: [],
    totals: { proceeds: 0, costBasis: 0, gainLoss: 0, shortTerm: 0, longTerm: 0 },
  }),
}));
vi.mock("@/components/index/index", () => ({
  RefreshButtonLoadingContext: createContext({ setButtonLoading: () => {}, setProgress: () => {}, buttonLoading: false, progress: 0 }),
}));
vi.mock("@/mobile/components/index", () => ({
  RefreshButtonLoadingContext: createContext({ setButtonLoading: () => {}, setProgress: () => {}, buttonLoading: false, progress: 0, refreshAction: { current: null } }),
}));
vi.mock("react-chartjs-2", () => ({
  Bar: () => <div />, Line: () => <div />, Doughnut: () => <div />,
}));

const exchanges = [
  "binance", "okex", "bitget", "gate", "kraken", "coinbase",
  "bybit", "htx", "mexc", "backpack",
].map((name) => ({
  name, alias: `Alias ${name}`, initParams: {
    apiKey: `key-${name}`, secret: `secret-${name}`,
    password: name === "okex" ? "okx-password" : undefined,
    passphrase: name === "bitget" ? "bitget-passphrase" : undefined,
  }, active: true,
}));
const fixture: GlobalConfig = {
  configs: { groupUSD: true, hideInactive: false },
  exchanges,
  stockConfig: { brokers: [{
    name: "ibkr", alias: "Stocks", initParams: { token: "broker-token", queryId: "broker-query" }, active: true,
  }] },
  btc: { addresses: [{ address: "btc-wallet", alias: "Bitcoin", active: true }] },
  erc20: { addresses: [{ address: "evm-wallet", alias: "EVM", active: true }] },
  sol: { addresses: [{ address: "sol-wallet", alias: "Solana", active: true }] },
  doge: { addresses: [{ address: "doge-wallet", alias: "Dogecoin", active: true }] },
  trc20: { addresses: [{ address: "tron-wallet", alias: "Tron", active: true }] },
  ton: { addresses: [{ address: "ton-wallet", alias: "Ton", active: true }] },
  sui: { addresses: [{ address: "sui-wallet", alias: "Sui", active: true }] },
  others: [{ symbol: "OTHER", alias: "Manual", amount: 2.5,
    attachTo: { kind: "wallet", type: "btc", identity: "btc-wallet" } }],
};
const additionalSources: GlobalConfig = {
  ...fixture,
  configs: { ...fixture.configs, hideInactive: true },
  exchanges: [...fixture.exchanges, { ...exchanges[0], alias: "Inactive exchange", active: false }],
  others: [
    ...fixture.others,
    { symbol: "CEXOTHER", alias: "Exchange manual", amount: 3,
      attachTo: { kind: "cex", type: "binance", identity: "binance-account" } },
    { symbol: "FREEOTHER", alias: "Unattached manual", amount: 4 },
  ],
};
const shapePath = resolve("tests/golden/ui-shapes-0.9.4.json");
const observedShapes: Record<string, unknown> = {};
const expectedShapes = process.env.UPDATE_GOLDEN === "1"
  ? {} as Record<string, unknown>
  : JSON.parse(readFileSync(shapePath, "utf8")) as Record<string, unknown>;
const additionalShapePath = resolve("tests/golden/ui-sources-extra-0.9.4.json");
const updateAdditional = process.env.UPDATE_EXTRA_GOLDEN === "1" || process.env.UPDATE_GOLDEN === "1";
const observedAdditionalShapes: Record<string, unknown> = {};
const expectedAdditionalShapes = updateAdditional
  ? {} as Record<string, unknown>
  : JSON.parse(readFileSync(additionalShapePath, "utf8")) as Record<string, unknown>;
function pinShape(key: string, value: unknown) {
  observedShapes[key] = value;
  if (process.env.UPDATE_GOLDEN !== "1") expect(value).toStrictEqual(expectedShapes[key]);
}
function pinAdditionalShape(key: string, value: unknown) {
  observedAdditionalShapes[key] = value;
  if (!updateAdditional) expect(value).toStrictEqual(expectedAdditionalShapes[key]);
}
afterAll(() => {
  if (process.env.UPDATE_GOLDEN === "1") {
    mkdirSync(resolve("tests/golden"), { recursive: true });
    writeFileSync(shapePath, JSON.stringify(observedShapes, null, 2) + "\n");
  }
  if (updateAdditional) writeFileSync(additionalShapePath, JSON.stringify(observedAdditionalShapes, null, 2) + "\n");
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isIOS).mockReturnValue(false);
  vi.mocked(getConfiguration).mockResolvedValue(fixture);
  vi.mocked(saveConfiguration).mockResolvedValue(undefined);
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
  vi.mocked(loadAlertEvaluationData).mockResolvedValue({ snapshots: [], prices: {}, excludedSymbols: [] });
  vi.mocked(saveAlertRule).mockResolvedValue(undefined);
  vi.mocked(queryAllDataDates).mockResolvedValue([
    { id: "new", date: "2024-04-16", createdAt: "2024-04-16T00:00:00.000Z" },
    { id: "old", date: "2024-04-15", createdAt: "2024-04-15T00:00:00.000Z" },
  ]);
  vi.mocked(queryCoinDataByUUID).mockResolvedValue([]);
  vi.mocked(updateAllCurrencyRates).mockResolvedValue(undefined as never);
  vi.mocked(getRebalanceProfile).mockResolvedValue(undefined);
  vi.mocked(loadRebalanceHoldings).mockResolvedValue({ holdings: [], stablecoinSymbols: [] });
  vi.mocked(getCostBasisMethod).mockResolvedValue("FIFO");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); window.location.hash = ""; });

describe("0.9.4 UI persistence shapes", () => {
  it("desktop Settings saves every loaded source field after a no-op edit", async () => {
    render(<DesktopConfiguration />);
    const toggle = await screen.findByRole("checkbox", { name: /group stable coins/i });
    await waitFor(() => expect(screen.getByText("Alias binance")).toBeInTheDocument());
    fireEvent.click(toggle);
    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveConfiguration).mock.lastCall?.[0]).toStrictEqual(fixture);
    pinShape("desktop.configuration", JSON.parse(JSON.stringify(vi.mocked(saveConfiguration).mock.lastCall?.[0])));
  });

  it("mobile Settings saves every loaded source field after a no-op edit", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/configuration?section=sources";
    render(<HashRouter><MobileConfiguration /></HashRouter>);
    const toggle = await screen.findByRole("switch", { name: "Toggle Alias binance" });
    fireEvent.click(toggle);
    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveConfiguration).mock.lastCall?.[0]).toStrictEqual(fixture);
    pinShape("mobile.configuration", JSON.parse(JSON.stringify(vi.mocked(saveConfiguration).mock.lastCall?.[0])));
  });

  for (const tree of ["desktop", "mobile"] as const) {
    it(`${tree} Settings preserves CEX and unattached manual assets and hidden inactive sources`, async () => {
      vi.mocked(getConfiguration).mockResolvedValue(additionalSources);
      if (tree === "mobile") {
        vi.mocked(isIOS).mockReturnValue(true);
        window.location.hash = "#/settings/configuration?section=sources";
        render(<HashRouter><MobileConfiguration /></HashRouter>);
      } else {
        render(<DesktopConfiguration />);
      }
      const toggle = await screen.findByRole(tree === "mobile" ? "switch" : "checkbox",
        { name: tree === "mobile" ? "Toggle Alias binance" : /group stable coins/i });
      fireEvent.click(toggle);
      await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(1));
      fireEvent.click(toggle);
      await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(2));
      const saved = vi.mocked(saveConfiguration).mock.lastCall?.[0];
      expect(saved?.configs.hideInactive).toBe(true);
      expect(saved?.exchanges.at(-1)).toStrictEqual(additionalSources.exchanges.at(-1));
      expect(saved?.others).toStrictEqual(additionalSources.others);
      pinAdditionalShape(tree, JSON.parse(JSON.stringify({
        hideInactive: saved?.configs.hideInactive,
        inactiveExchange: saved?.exchanges.at(-1),
        others: saved?.others,
      })));
    });
  }

  const messages: PersistedChatMessage[] = [
    { role: "user", content: "What changed?" },
    { role: "assistant", usage: { promptTokens: 12, completionTokens: 7, source: "reported" }, contextTokens: 2048,
      blocks: [
        { kind: "text", text: "Your holdings increased." },
        { kind: "pending_action", id: "action-1", toolCallId: "call-1", name: "set_date_range",
          args: { from: "2024-04-01", to: "2024-04-16" },
          preview: { before: "Old dates", after: "New dates" }, risk: "low", status: "pending",
          createdAt: "2024-04-16T12:00:00.000Z", expiresAt: "2024-04-16T13:00:00.000Z" },
      ] },
  ];
  for (const [tree, load, save] of [
    ["desktop", desktopLoad, desktopSave], ["mobile", mobileLoad, mobileSave],
  ] as const) {
    it(`${tree} chat preserves persisted text, action, usage, and context tokens`, () => {
      const saved = messages.map((message) => save(load(message)));
      expect(saved).toStrictEqual(messages);
      pinShape(`${tree}.chat`, saved);
    });
  }

  const expectedRule: AlertRule = {
    id: 0, kind: "total_value_target", assetType: null, symbol: null,
    comparator: "gte", threshold: 1000, window: null, enabled: true,
    cooldownSeconds: 2700, lastTriggeredAt: null, lastValue: null, armed: true,
  };
  for (const [tree, Component] of [["desktop", DesktopGoals], ["mobile", MobileGoals]] as const) {
    it(`${tree} alert editor converts minutes and saves the whole rule`, async () => {
      render(<Component />);
      await screen.findByText("No rules yet");
      fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "1000" } });
      fireEvent.change(screen.getByLabelText("Cooldown (minutes)"), { target: { value: "45" } });
      await userEvent.click(screen.getByRole("button", { name: "Save rule" }));
      await waitFor(() => expect(saveAlertRule).toHaveBeenCalledTimes(1));
      expect(vi.mocked(saveAlertRule).mock.lastCall?.[0]).toStrictEqual(expectedRule);
      pinShape(`${tree}.alert`, vi.mocked(saveAlertRule).mock.lastCall?.[0]);
    });
  }

  const usd = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };
  for (const [tree, Comparison, CostBasis, Rebalance, Refresh] of [
    ["desktop", DesktopComparison, DesktopCostBasis, DesktopRebalance, DesktopRefresh],
    ["mobile", MobileComparison, MobileCostBasis, MobileRebalance, MobileRefresh],
  ] as const) {
    it(`${tree} writes the exact comparison date JSON`, async () => {
      render(<Comparison currency={usd} quoteColor="green-up-red-down" />);
      await waitFor(() => expect(localStorage.getItem("track3-current-comparison-dates"))
        .toBe('{"base":"2024-04-15","head":"2024-04-16"}'));
      pinShape(`${tree}.comparison`, localStorage.getItem("track3-current-comparison-dates"));
    });

    it(`${tree} writes the exact cost basis options JSON`, async () => {
      localStorage.setItem("track3-cost-basis-settings", '{"from":"2024-01-01","to":"2024-12-31","holdingPeriodDays":365}');
      render(<CostBasis />);
      await screen.findByLabelText("Long-term after (days)");
      fireEvent.change(screen.getByLabelText("Long-term after (days)"), { target: { value: "400" } });
      await waitFor(() => expect(localStorage.getItem("track3-cost-basis-settings"))
        .toBe('{"from":"2024-01-01","to":"2024-12-31","holdingPeriodDays":400}'));
      pinShape(`${tree}.costBasis`, localStorage.getItem("track3-cost-basis-settings"));
    });

    it(`${tree} writes the exact rebalance options JSON`, async () => {
      sessionStorage.setItem("track3-rebalance-options",
        '{"mode":"buys","injectedCash":42.5,"minimumTradeValue":3,"ignoreBelowValue":2}');
      const writes = vi.spyOn(Storage.prototype, "setItem");
      try {
        render(<Rebalance currency={usd} />);
        await waitFor(() => expect(writes).toHaveBeenCalledWith("track3-rebalance-options",
          '{"mode":"buys","injectedCash":42.5,"minimumTradeValue":3,"ignoreBelowValue":2}'));
        pinShape(`${tree}.rebalance`, sessionStorage.getItem("track3-rebalance-options"));
      } finally {
        writes.mockRestore();
      }
    });

    it(`${tree} writes the off-only stablecoin rebalance option`, async () => {
      sessionStorage.setItem("track3-rebalance-options",
        '{"mode":"buys","injectedCash":42.5,"minimumTradeValue":3,"ignoreBelowValue":2}');
      render(<Rebalance currency={usd} />);
      fireEvent.click(await screen.findByRole("switch", { name: "Treat USDT and USDC as cash" }));
      await waitFor(() => expect(sessionStorage.getItem("track3-rebalance-options"))
        .toBe('{"mode":"buys","injectedCash":42.5,"minimumTradeValue":3,"ignoreBelowValue":2,"stablecoinsAsCash":false}'));
      pinShape(`${tree}.rebalanceStablecoinsOff`, sessionStorage.getItem("track3-rebalance-options"));
    });

    it(`${tree} writes the exact normalized source status JSON`, () => {
      localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([{
        sourceId: "wallet:btc", label: "Bitcoin", status: "stale",
        category: "network", kind: "wallet", lastSuccessAt: "2024-04-15T00:00:00.000Z",
        upstreamSecret: "drop-this",
      }]));
      render(<Refresh loading={false} />);
      expect(localStorage.getItem("track3-refresh-source-statuses"))
        .toBe('[{"sourceId":"wallet:btc","label":"Bitcoin","status":"stale","category":"network","kind":"wallet","lastSuccessAt":"2024-04-15T00:00:00.000Z"}]');
      pinShape(`${tree}.sourceStatuses`, localStorage.getItem("track3-refresh-source-statuses"));
    });

    it(`${tree} stores normalized source statuses after refresh`, async () => {
      vi.mocked(refreshAllData).mockResolvedValue({
        persisted: false, requiresDataSourceAction: false, usedLastKnownData: false, failedSources: [],
        sourceStatuses: [{ sourceId: "cex:0", label: "Exchange", status: "stale",
          category: "network", kind: "exchange", lastSuccessAt: "2024-04-15T00:00:00.000Z",
          upstreamSecret: "drop-this" }],
      } as never);
      render(<Refresh loading={false} />);
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(localStorage.getItem("track3-refresh-source-statuses"))
        .toBe('[{"sourceId":"cex:0","label":"Exchange","status":"stale","category":"network","kind":"exchange","lastSuccessAt":"2024-04-15T00:00:00.000Z"}]'));
      pinAdditionalShape(`${tree}.refreshedStatus`, localStorage.getItem("track3-refresh-source-statuses"));
    });
  }
});
