import type { Page } from "@playwright/test";

export async function seedSummaryYears(page: Page, firstYear: number) {
  await page.evaluate(async (start) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2 WHERE uuid LIKE 'summary-%'", values: [] });
    for (let year = start; year <= 2024; year++) {
      for (const month of [1, 12]) {
        await invoke("plugin:sql|execute", {
          query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
            VALUES (?, ?, 'summary-year-fixture', 'crypto', 'BTC', 1, ?, ?)`,
          values: [`summary-${year}-${month}`, new Date(Date.UTC(year, month - 1, 15, 9)).toISOString(),
            year + month, year + month],
        });
      }
    }
  }, firstYear);
}
