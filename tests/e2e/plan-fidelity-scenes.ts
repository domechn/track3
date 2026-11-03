import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

type Scene = "rebalance" | "rebalance-empty" | "goals" | "goals-empty";

export async function installPlanFidelityScene(page: Page, scene: Scene) {
  await installTauriBridge(page);
  const execute = (query: string, values: unknown[] = []) =>
    page.evaluate(({ query, values }) =>
      (window as typeof window & { __e2eInvoke: (cmd: string, args: unknown) => Promise<unknown> })
        .__e2eInvoke("plugin:sql|execute", { query, values }), { query, values });

  await execute("DELETE FROM assets_v2");
  await execute("DELETE FROM transactions");
  const positions = [
    ["BTC", "crypto", 3.2226, 59485.37, 60029.57, 63875.02, 63842.11],
    ["USDT", "crypto", 182446.74, 1.0001, 0.9997, 0.9999, 1],
    ["ETH", "crypto", 59.8508, 2367.06, 2451.83, 2497.7, 2527.14],
    ["SOL", "crypto", 410, 150.23, 147.27, 165.87, 168.4],
    ["BNB", "crypto", 85.8796, 549.09, 564.16, 585.3, 579.58],
    ["USDC", "crypto", 40000, 1.0001, 1, 1, 1],
    ["AAPL", "stock", 150, 231.41, 238.92, 231.4, 229.87],
    ["NVDA", "stock", 220, 135.77, 138.83, 143.33, 141.25],
  ] as const;
  const dates = [
    "2026-10-01T09:41:00.000Z", "2026-10-24T09:41:00.000Z",
    "2026-10-30T09:41:00.000Z", "2026-10-31T09:41:00.000Z",
  ];
  for (const [index, at] of dates.entries()) {
    for (const [symbol, assetType, amount, ...prices] of positions) {
      const price = prices[index];
      await execute(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'plan-fixture', ?, ?, ?, ?, ?)`,
      [`plan-${index}`, at, assetType, symbol, amount, Math.round(amount * price * 100) / 100, price]);
    }
  }
  for (const [symbol, assetType, amount, price] of positions) {
    await execute(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
      SELECT 'plan-0', id, ?, 'plan-fixture', ?, ?, ?, 'buy', '2026-10-01T09:41:00.000Z'
      FROM assets_v2 WHERE uuid = 'plan-0' AND symbol = ?`,
    [assetType, symbol, amount, price, symbol]);
  }
  if (scene === "rebalance" || scene === "goals") {
    await execute("INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, 2)", [
      JSON.stringify(["BTC", "USDT", "ETH", "SOL", "BNB", "USDC", "AAPL", "NVDA"].map((symbol) => ({
        kind: "asset", assetType: symbol === "AAPL" || symbol === "NVDA" ? "stock" : "crypto",
        symbol, percent: { BTC: 30, USDT: 20, ETH: 20, SOL: 8, BNB: 7, USDC: 5, AAPL: 5, NVDA: 5 }[symbol as "BTC"],
      }))),
    ]);
  }
  if (scene === "rebalance" || scene === "rebalance-empty") {
    await execute(`INSERT INTO alert_history (rule_id, kind, title, message, symbol, value, triggered_at, acknowledged_at)
      VALUES (NULL, 'total_value_target', 'Portfolio goal reached', 'Portfolio goal reached: 763809.27 (at least 750000.00)', NULL, 763809.27, '2026-10-31T09:41:00.000Z', NULL)`);
  }
  if (scene === "goals") {
    const rules = [
      ["total_value_target", null, null, "gte", 800000, null, 1, 86400],
      ["asset_value_target", "crypto", "BTC", "gte", 250000, null, 1, 86400],
      ["asset_price_target", "crypto", "BTC", "gte", 70000, null, 1, 86400],
      ["asset_price_move", "crypto", "SOL", "gte", 10, "7d", 1, 86400],
      ["allocation_deviation", "crypto", "BTC", "gte", 2, null, 1, 86400],
      ["period_pnl", null, null, "gte", 40000, "30d", 1, 604800],
      ["portfolio_value_change", null, null, "lte", -5, "24h", 0, 86400],
    ] as const;
    for (const row of rules) {
      await execute(`INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, window, enabled, cooldown_seconds, armed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`, [...row]);
    }
    const alerts = [
      [4, "asset_price_move", "SOL price moved", "SOL price moved: 14.30 (at least 10.00)", "SOL", 14.3, "2026-10-31T09:41:00.000Z", null],
      [5, "allocation_deviation", "BTC allocation deviated", "BTC allocation deviated: 3.10 (at least 2.00)", "BTC", 3.1, "2026-10-31T09:41:00.000Z", null],
      [null, "total_value_target", "Portfolio goal reached", "Portfolio goal reached: 752683.57 (at least 750000.00)", null, 752683.57, "2026-10-27T09:40:00.000Z", "2026-10-27T10:00:00.000Z"],
      [null, "asset_price_target", "ETH price target reached", "ETH price target reached: 2524.33 (at least 2500.00)", "ETH", 2524.33, "2026-10-27T09:40:00.000Z", "2026-10-27T10:00:00.000Z"],
      [null, "asset_price_target", "BTC price target reached", "BTC price target reached: 60029.57 (at least 60000.00)", "BTC", 60029.57, "2026-10-24T09:41:00.000Z", "2026-10-24T10:00:00.000Z"],
    ] as const;
    for (const row of alerts) {
      await execute(`INSERT INTO alert_history (rule_id, kind, title, message, symbol, value, triggered_at, acknowledged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [...row]);
    }
  }
}
