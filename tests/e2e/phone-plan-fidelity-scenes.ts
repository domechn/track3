import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export type PlanFidelityState = "rebalance" | "rebalance-empty" | "goals" | "goals-empty";

export async function installPlanFidelityScene(page: Page, state: PlanFidelityState) {
  await installTauriBridge(page);
  await page.goto("/#/more");
  const run = (query: string, values: unknown[] = []) => page.evaluate(({ query, values }) =>
    (window as any).__e2eInvoke("plugin:sql|execute", { query, values }), { query, values });
  await run("DELETE FROM assets_v2");
  await run("DELETE FROM transactions");
  const positions = [
    ["BTC", "crypto", 3.2226, 63842.11, 205737.58],
    ["USDT", "crypto", 182446.74, 1, 182446.74],
    ["ETH", "crypto", 59.8508, 2527.14, 151251.35],
    ["SOL", "crypto", 410, 168.4, 69044],
    ["BNB", "crypto", 85.8796, 579.58, 49774.1],
    ["USDC", "crypto", 40000, 1, 40000],
    ["AAPL", "stock", 150, 229.87, 34480.5],
    ["NVDA", "stock", 220, 141.25, 31075],
  ] as const;
  for (const [symbol, assetType, amount, price, value] of positions) {
    await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, price, value)
      VALUES ('fidelity-31', '2026-10-31T09:41:00.000Z', 'fidelity-wallet', ?, ?, ?, ?, ?)`,
    [assetType, symbol, amount, price, value]);
  }
  if (state !== "rebalance-empty" && state !== "goals-empty") {
    const targets = [
      ["BTC", 30], ["USDT", 20], ["ETH", 20], ["SOL", 8],
      ["BNB", 7], ["USDC", 5], ["AAPL", 5], ["NVDA", 5],
    ].map(([symbol, percent]) => ({
      kind: "asset", assetType: symbol === "AAPL" || symbol === "NVDA" ? "stock" : "crypto",
      symbol, percent,
    }));
    await run("INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, 2)",
      [JSON.stringify(targets)]);
  }
  if (state === "goals") {
    const oldPrices = [
      ["BTC", 59485.37, 60029.57, 63875.02],
      ["USDT", 1.0001, 0.9997, 0.9999],
      ["ETH", 2367.06, 2451.83, 2497.7],
      ["SOL", 150.23, 147.27, 165.87],
      ["BNB", 549.09, 564.16, 585.3],
      ["USDC", 1.0001, 1, 1],
      ["AAPL", 231.41, 238.92, 231.4],
      ["NVDA", 135.77, 138.83, 143.33],
    ] as const;
    for (const [index, date] of ["01", "24", "30"].entries()) {
      for (const [symbol, start, week, yesterday] of oldPrices) {
        const position = positions.find((item) => item[0] === symbol)!;
        const price = [start, week, yesterday][index];
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, price, value)
          VALUES (?, ?, 'fidelity-wallet', ?, ?, ?, ?, ?)`,
        [`fidelity-${date}`, `2026-10-${date}T09:40:00.000Z`, position[1], symbol, position[2], price,
          Math.round(position[2] * price * 100) / 100]);
      }
    }
    for (const [kind, symbol, comparator, threshold, window, enabled, cooldown] of [
      ["total_value_target", null, "gte", 800000, null, 1, 86400],
      ["asset_value_target", "BTC", "gte", 250000, null, 1, 86400],
      ["asset_price_target", "BTC", "gte", 70000, null, 1, 86400],
      ["asset_price_move", "SOL", "gte", 10, "7d", 1, 86400],
      ["allocation_deviation", "BTC", "gte", 2, null, 1, 86400],
      ["period_pnl", null, "gte", 40000, "30d", 1, 604800],
      ["portfolio_value_change", null, "lte", -5, "24h", 0, 86400],
    ] as const) {
      await run(`INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, window, enabled, cooldown_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [kind, symbol ? "crypto" : null, symbol, comparator, threshold, window, enabled, cooldown]);
    }
    for (const [ruleId, kind, title, message, symbol, value, at, acknowledged] of [
      [4, "asset_price_move", "SOL price moved", "SOL price moved: 14.30 (at least 10.00)", "SOL", 14.3, "2026-10-31T09:41:01.000Z", null],
      [5, "allocation_deviation", "BTC allocation deviated", "BTC allocation deviated: 3.10 (at least 2.00)", "BTC", 3.1, "2026-10-31T09:41:00.000Z", null],
      [null, "total_value_target", "Portfolio goal reached", "Portfolio goal reached: 752683.57 (at least 750000.00)", null, 752683.57, "2026-10-27T09:40:01.000Z", "2026-10-27T10:00:00.000Z"],
      [null, "asset_price_target", "ETH price target reached", "ETH price target reached: 2524.33 (at least 2500.00)", "ETH", 2524.33, "2026-10-27T09:40:00.000Z", "2026-10-27T10:00:00.000Z"],
      [null, "asset_price_target", "BTC price target reached", "BTC price target reached: 60029.57 (at least 60000.00)", "BTC", 60029.57, "2026-10-24T09:41:00.000Z", "2026-10-24T10:00:00.000Z"],
    ] as const) {
      await run(`INSERT INTO alert_history (rule_id, kind, title, message, symbol, value, triggered_at, acknowledged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ruleId, kind, title, message, symbol, value, at, acknowledged]);
    }
    await run(`UPDATE alert_rules SET armed = 0, last_triggered_at = '2026-10-31T09:41:00.000Z'
      WHERE id IN (4, 5)`);
  }
  if (state.startsWith("rebalance")) {
    for (const [kind, title, message, symbol, value] of [
      ["asset_price_move", "SOL price moved", "SOL price moved: 14.30 (at least 10.00)", "SOL", 14.3],
      ["allocation_deviation", "BTC allocation deviated", "BTC allocation deviated: 3.10 (at least 2.00)", "BTC", 3.1],
    ]) {
      await run(`INSERT INTO alert_history (rule_id, kind, title, message, symbol, value, triggered_at, acknowledged_at)
        VALUES (NULL, ?, ?, ?, ?, ?, '2026-10-31T09:41:00.000Z', NULL)`,
      [kind, title, message, symbol, value]);
    }
  }
  await page.reload();
}
