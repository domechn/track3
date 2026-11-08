import { expect, test } from "@playwright/test";
import { executeSceneSql } from "./fidelity-records-scenes";
import { findKpiOverflows } from "./kpi-overflow-scenes";
import { installTauriBridge as installDesktopBridge } from "./tauri-bridge";

test("large desktop Summary values stay inside the KPI strip at 1100px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1100, height: 1000 });
  await installDesktopBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
  await executeSceneSql(page, "UPDATE assets_v2 SET value = value * 10000, price = price * 10000");
  await page.goto("/#/summary", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fidelity-summary-pnl-kpis")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  const result = await findKpiOverflows(page);
  expect(result.failures.filter((failure) => failure.includes("fidelity-summary-pnl-kpis"))).toEqual([]);
});
