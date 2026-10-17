import { expect, it } from "vitest";
import { costBasisVisuals, rebalanceVisuals, goalVisuals, alertSentence, goalEtaDays } from "./finance-visuals";
import en from "@/i18n/locales/en.json";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { RebalanceResult } from "@/middlelayers/rebalance";
import type { AlertRule, AlertSnapshot } from "@/middlelayers/alerts";

it("groups small asset gains and accumulates disposals in date order", () => {
  const report = {
    totals: { proceeds: 240, costBasis: 160, gainLoss: 80, shortTerm: -20, longTerm: 100 },
    assets: [
      { assetType: "crypto", symbol: "BTC", gainLoss: 100, costBasis: 200, proceeds: 300 },
      { assetType: "crypto", symbol: "ETH", gainLoss: -30, costBasis: 100, proceeds: 70 },
      { assetType: "crypto", symbol: "SOL", gainLoss: 10, costBasis: 50, proceeds: 60 },
    ],
    disposals: [
      { disposedAt: "2025-02-01", gainLoss: -30 },
      { disposedAt: "2025-01-01", gainLoss: 100 },
      { disposedAt: "2025-02-01", gainLoss: 10 },
    ],
    unrealized: [{ symbol: "BTC", costBasis: 80, gainLoss: 20 }],
  } as CostBasisReport;
  const visual = costBasisVisuals(report, 2);
  expect(visual.gains).toEqual([{ label: "BTC", value: 100 }, { label: "ETH", value: -30 }, { label: "Other", value: 10 }]);
  expect(visual.cumulative).toEqual([{ date: "2025-01-01", value: 100 }, { date: "2025-02-01", value: 80 }]);
  expect(visual.composition).toEqual([{ label: "BTC", value: 80 }]);
  expect(visual.unrealized).toBe(20);
  expect(visual.taxYears).toEqual([{ index: 0, year: "2025" }]);
  expect(costBasisVisuals(report, 2, "其他").gains.at(-1)?.label).toBe("其他");
  expect(visual.rates).toEqual({ realized: 50, shortTerm: -25, longTerm: 125, unrealized: 25 });
});

it("maps calculator allocations and sorts nonzero trade cards by absolute value", () => {
  const result = { currentTotal: 100, projectedTotal: 110, warnings: [], rows: [
    { kind: "asset", symbol: "BTC", assetType: "crypto", amount: 1, price: 80, value: 80, currentPercent: 80, targetPercent: 50, deviationPercent: 30, tradeValue: -30, tradeQuantity: -0.1 },
    { kind: "asset", symbol: "ETH", assetType: "crypto", amount: 1, price: 20, value: 20, currentPercent: 20, targetPercent: 50, deviationPercent: -30, tradeValue: 40, tradeQuantity: 2 },
    { kind: "cash", symbol: "CASH", amount: 0, price: 1, value: 0, currentPercent: 0, targetPercent: 0, deviationPercent: 0, tradeValue: 0, tradeQuantity: null },
  ] } as RebalanceResult;
  const visual = rebalanceVisuals(result);
  expect(visual.current).toEqual([80, 20]);
  expect(visual.target).toEqual([50, 50]);
  expect(visual.trades.map((row) => row.symbol)).toEqual(["ETH", "BTC"]);
  expect(visual.buyTotal).toBe(40);
  expect(visual.sellTotal).toBe(30);
});

it("builds goal progress and portfolio values from evaluation snapshots", () => {
  const rule = { id: 1, kind: "total_value_target", comparator: "gte", threshold: 200, enabled: true, symbol: null } as AlertRule;
  const snapshots = [
    { at: "2025-01-01", assets: [{ value: 50 }] },
    { at: "2025-01-02", assets: [{ value: 100 }] },
  ] as AlertSnapshot[];
  const visual = goalVisuals([rule], snapshots);
  expect(visual.values).toEqual([{ date: "2025-01-01", value: 50 }, { date: "2025-01-02", value: 100 }]);
  expect(visual.goals).toEqual([{ id: 1, value: 100, target: 200, progress: 50, kind: "total_value_target", symbol: null }]);
});

it("estimates a total value goal only from a rising dated series", () => {
  const values = [
    { date: "2025-01-01", value: 100 },
    { date: "2025-01-11", value: 120 },
  ];
  expect(goalEtaDays(values, 160)).toBe(20);
  expect(goalEtaDays(values, 110)).toBe(0);
  expect(goalEtaDays([...values, { date: "2025-01-21", value: 110 }], 160)).toBeNull();
  expect(goalEtaDays([values[0]], 160)).toBeNull();
});

it("describes an alert in plain language with its threshold and window", () => {
  const t = (key: string) => (en as Record<string, string>)[key] ?? key;
  expect(alertSentence({
    kind: "asset_price_target", symbol: "BTC", comparator: "gte", threshold: 100000, window: null,
  } as AlertRule, t)).toBe("Notify when BTC is at least $100,000");
  expect(alertSentence({
    kind: "period_pnl", symbol: null, comparator: "lte", threshold: -10, window: "7d",
  } as AlertRule, t)).toBe("Notify when portfolio P&L is at most -$10 over 7d");
  expect(alertSentence({
    kind: "portfolio_value_change", symbol: null, comparator: "lte", threshold: -10, window: "7d",
  } as AlertRule, t)).toBe("Notify when portfolio value change is at most -10% over 7d");
});
