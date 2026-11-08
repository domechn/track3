import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function seedOverviewChart(page: Page, currency: "USD" | "CNY" = "USD", jumpDay = 8) {
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.evaluate(async ({ currency, jumpDay }) => {
    const invoke = (window as any).__e2eInvoke as (cmd: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
    const run = (query: string, values: unknown[] = []) => invoke("plugin:sql|execute", { query, values });
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '1038')");
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, ?)", [currency]);
    await run("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese Yuan', '¥', 7.1, 1, '2099-01-01T00:00:00.000Z')");
    const start = Date.parse("2026-10-24T00:00:00Z");
    const end = Date.parse("2026-11-08T09:41:00Z");
    for (let batch = 0; batch < 1038; batch += 100) {
      const values: unknown[] = [];
      const rows = [];
      for (let index = batch; index < Math.min(batch + 100, 1038); index++) {
        const at = start + Math.round((end - start) * index / 1037);
        const day = Math.floor((at - start) / 86_400_000);
        const intraday = ((at - start) % 86_400_000) / 86_400_000;
        const value = index === 1037 ? 1_641_793.33
          : Math.round((1_592_511.33 + day * 2000 + intraday * 2000 +
              (day >= jumpDay ? 19_282 : 0) + 2100 * Math.sin(index / 21)) * 100) / 100;
        rows.push("(?, ?, 'owner-fixture', 'crypto', 'USDT', 1, ?, ?)");
        values.push(`owner-${index}`, new Date(at).toISOString(), value, value);
      }
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ${rows.join(",")}`, values);
    }
    await run("INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES ('owner-500', 1, '[\"gap\"]', 'last_known', '2026-10-31T00:00:00Z')");
  }, { currency, jumpDay });
}
