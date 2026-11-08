import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

test.setTimeout(90_000);
test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
});

test("Overview keeps a configured exchange mark before source status is stored", async ({ page }) => {
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  const row = page.locator(".fd-overview-source").filter({ hasText: "Binance" });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.locator(".t3-asset-icon")).toHaveAttribute("data-kind", "exchange");
  await expect(row.locator(".t3-asset-icon img")).toHaveCount(1);
});

test("First run keeps the configured exchange mark before refresh", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, firstRunBinance: true });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "UPDATE configuration SET data = REPLACE(data, 'alias: Binance', 'alias: Main exchange') WHERE id = 10",
    values: [],
  }));
  await page.goto("/#/overview");
  await expect(page.getByText("Main exchange has not been refreshed yet.")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-first-run-source .t3-asset-icon[data-kind='exchange'] img")).toHaveCount(1);
});
