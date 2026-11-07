import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { expect, it } from "vitest";

const directionComponents = new Set([
  "src/components/finance-charts.tsx",
  "src/mobile/components/finance-charts.tsx",
  "src/components/overview-panels.tsx",
  "src/mobile/components/overview-fidelity.tsx",
  "src/components/comparison-movers-panel.tsx",
  "src/components/pnl-chart.tsx",
  "src/mobile/components/pnl-chart.tsx",
  "src/components/profit-attribution.tsx",
  "src/mobile/components/profit-attribution.tsx",
  "src/components/top-coins-percentage-change.tsx",
  "src/mobile/components/top-coins-percentage-change.tsx",
  "src/components/top-coins-rank.tsx",
  "src/mobile/components/top-coins-rank.tsx",
  "src/components/wallet-assets-change.tsx",
  "src/mobile/components/wallet-assets-change.tsx",
  "src/mobile/components/cost-basis-phone.tsx",
  "src/mobile/components/cost-basis.tsx",
  "src/mobile/components/historical-data.tsx",
  "src/components/overview.tsx",
  "src/mobile/components/overview.tsx",
  "src/mobile/components/summary-fidelity.tsx",
  "src/components/summary-profit-loss.tsx",
  "src/components/summary-market-card.tsx",
  "src/components/comparison.tsx",
  "src/components/comparison-fidelity.tsx",
  "src/mobile/components/comparison.tsx",
  "src/mobile/components/comparison-fidelity.tsx",
  "src/components/wallets-fidelity.tsx",
  "src/mobile/components/wallet-fidelity.tsx",
  "src/components/historical-data-desktop.tsx",
  "src/components/coin-fidelity-view.tsx",
  "src/mobile/components/coin-fidelity.tsx",
  "src/mobile/components/coin-analytics.tsx",
  "src/components/rebalance-desktop.tsx",
  "src/mobile/components/rebalance-fidelity.tsx",
  "src/components/goals-desktop.tsx",
  "src/mobile/components/goals-fidelity.tsx",
  "src/components/cost-basis-desktop-view.tsx",
  "src/components/cost-basis-panels.tsx",
  "src/components/appearance-design.tsx",
  "src/components/ath-value.tsx",
  "src/mobile/components/ath-value.tsx",
]);
const blueSource = /accent-data|chart-blue-soft|chart-1|#3b82f6|#4a8ad6|--fd-accent/;
const neutralReason = /color-semantics: neutral .+/;

it("requires a reason for blue inside direction-coloured components", () => {
  const violations: string[] = [];
  for (const path of globSync("src/**/*.{tsx,css}")) {
    if (!directionComponents.has(path)) continue;
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!blueSource.test(line)) return;
      const nearby = lines.slice(Math.max(0, index - 2), index + 1).join("\n");
      if (!neutralReason.test(nearby)) violations.push(`${relative(process.cwd(), path)}:${index + 1}`);
    });
  }
  expect(violations).toEqual([]);
});

it("guards direction-coded CSS rules against blue", () => {
  const directionSelector = /(?:t3-daily-(?:up|down)|t3-moved-track|fd-overview-(?:bars|daily|mover)|fd-zero-bar|fidelity-summary-chart|fidelity-cost-(?:gain|loss)|fd-coin-(?:changes|metric))/;
  const violations: string[] = [];
  for (const path of globSync("src/**/*.css")) {
    const css = readFileSync(path, "utf8");
    for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!directionSelector.test(match[1]) || !blueSource.test(match[2])) continue;
      const index = match.index ?? 0;
      const nearby = css.slice(Math.max(0, index - 160), index + match[0].length);
      if (!neutralReason.test(nearby)) violations.push(`${path}:${css.slice(0, index).split("\n").length}`);
    }
  }
  expect(violations).toEqual([]);
});

it("does not hard-code exchange-independent green and red utility colours for movement", () => {
  const violations = [...directionComponents].filter((path) =>
    /(?:text|bg)-(?:emerald|rose)-\d+|#10b981|#f43f5e/.test(readFileSync(path, "utf8")));
  expect(violations).toEqual([]);
});

it("keeps the Daily change CSS free of blue direction rules", () => {
  const css = readFileSync("src/style.css", "utf8");
  const rules = [...css.matchAll(/[^{}]*\.t3-daily-(?:up|down|neutral)[^{}]*\{([^}]*)\}/g)];
  expect(rules.length).toBeGreaterThan(0);
  expect(rules.map((rule) => rule[1]).join("\n")).not.toMatch(blueSource);
  const phoneCss = readFileSync("src/mobile/components/mobile/fidelity.css", "utf8");
  const phoneRules = [...phoneCss.matchAll(/[^{}]*\.fd-overview-bars[^{}]*\{([^}]*)\}/g)];
  expect(phoneRules.map((rule) => rule[1]).join("\n")).not.toMatch(blueSource);
});

it("uses live quote colours in the phone Overview date sheet", () => {
  const css = readFileSync("src/mobile/components/mobile/fidelity.css", "utf8");
  const rule = css.match(/\.fd-overview-date-sheet\.mobile-sheet\s*\{([^}]*)\}/)?.[1] ?? "";
  expect(rule).toContain("--fd-gain:hsl(var(--gain))");
  expect(rule).toContain("--fd-loss:hsl(var(--loss))");
});

it("does not mute signed Wallets deltas behind data-tone", () => {
  const css = readFileSync("src/mobile/components/mobile/fidelity.css", "utf8");
  expect(css).not.toMatch(/\.fd-wallet-main-stat>small\s*\{[^}]*color:var\(--fd-muted\)!important/);
  expect(css).not.toMatch(/\.fd-wallet-balance small:last-child\[data-tone\]\s*\{[^}]*color:var\(--fd-faint\)/);
});

it("guards desktop History edit deltas from sign-only physical classes", () => {
  const history = readFileSync("src/components/historical-data-desktop.tsx", "utf8");
  expect(history).not.toMatch(/editDelta\s*(?:>=?|<=?|===?)\s*0\s*\?\s*["'](?:pos|neg)["']/);
});
