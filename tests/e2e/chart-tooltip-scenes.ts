import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export const changes = [12_345.67, -52_314.07, 4_000, 31_205.44, -8_100.2, 66_200, -950.75, 2_250, -12_340.09];

export async function seedDailyChanges(page: Page) {
  await installTauriBridge(page);
  await page.evaluate(async (changes) => {
    const invoke = (window as any).__e2eInvoke as (command: string, args: object) => Promise<unknown>;
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2", values: [] });
    let total = 1_700_000;
    for (let day = 0; day < 10; day++) {
      if (day) total = Math.round((total + changes[day - 1]) * 100) / 100;
      await invoke("plugin:sql|execute", {
        query: "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, 'fixture-wallet', 'crypto', 'BTC', 1, ?, ?)",
        values: [`tooltip-${day}`, new Date(Date.UTC(2026, 9, 30 + day, 12)).toISOString(), total, total],
      });
    }
  }, changes);
}

export async function seedGoalRule(page: Page) {
  await page.evaluate(async () => {
    const invoke = (window as any).__e2eInvoke as (command: string, args: object) => Promise<unknown>;
    await invoke("plugin:sql|execute", {
      query: "INSERT INTO alert_rules (kind, comparator, threshold, enabled, cooldown_seconds) VALUES ('total_value_target', 'gte', 2000000, 1, 86400)",
      values: [],
    });
  });
}
