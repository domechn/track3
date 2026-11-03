import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

test.use({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC" });

test("assistant context converts holdings and cost into the base currency", async ({ page }) => {
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.evaluate(async () => {
    const execute = (query: string, values: unknown[]) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await execute("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'EUR')", []);
    await execute(
      "INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('EUR', 'Euro', '€', 0.9, 1, '2099-01-01T00:00:00.000Z')",
      [],
    );
  });
  await page.goto("/#/assistant");
  const context = page.locator(".t3-assistant-context");
  await expect(context).toContainText("€687,428.34");
  await expect(context).not.toContainText("$763,809.27");
  await expect(context).toContainText("€0.00");
});
