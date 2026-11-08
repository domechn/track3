import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { executeSceneSql } from "./fidelity-records-scenes";
import { installTauriBridge as installDesignHistoryBridge, seedFidelityCompletedSync } from "./fidelity-bridge-captures";
import { seedHistoryKpis } from "./history-kpi-scenes";
import { findKpiOverflows, routes } from "./kpi-overflow-scenes";
import { installTauriBridge } from "./tauri-bridge";

const desktopRouteRoot: Record<string, string> = {
  overview: ".t3-hero-value",
  summary: ".fidelity-kpis",
  comparison: ".analyze-comparison",
  "cost-basis": ".fidelity-cost-kpi-row",
  wallets: ".analyze-wallets",
  rebalance: ".t3-manage-rebalance, .t3-fidelity-rebalance",
  "coins/BTC?assetType=crypto": ".coin-fidelity-metrics",
  goals: ".t3-manage-goals, .t3-fidelity-goals",
  history: ".fidelity-history-detail-kpis",
};

test("standard History capture compares the full design page height", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1272 });
  await installDesignHistoryBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27", { timeout: 30_000 });
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await seedFidelityCompletedSync(page);
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator(".fidelity-history-detail-kpis").evaluate((strip) => ({
    strip: strip.getBoundingClientRect().toJSON(),
    columns: [...strip.children].map((cell) => ({
      box: cell.getBoundingClientRect().toJSON(),
      padding: getComputedStyle(cell).padding,
      fontSize: getComputedStyle(cell.querySelector("strong")!).fontSize,
    })),
  }));
  mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
  writeFileSync("/tmp/history-kpi-overflow/app-history-bounds.json", JSON.stringify(bounds, null, 2));
  await page.screenshot({ path: "/tmp/history-kpi-overflow/history-design-fixture-expanded.png",
    fullPage: true, animations: "disabled" });
});

for (const route of routes) {
  test(`${route} desktop KPI values stay inside their columns`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: ["comparison", "wallets"].includes(route) ? 1440 : 1100, height: 1000 });
    if (route === "history") await seedHistoryKpis(page, 883327.90, 1669806.58);
    else {
      await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
      await executeSceneSql(page, "UPDATE assets_v2 SET value = value * 10000, price = price * 10000");
    }
    await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#app-main-content")).toBeVisible();
    await expect(page.locator("#app-main-content").locator(desktopRouteRoot[route]).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Loading page", { exact: true })).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1100, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator("#app-main-content").locator(desktopRouteRoot[route]).first()).toBeVisible();
      const result = await findKpiOverflows(page);
      expect(result.inspected, `${route} at ${width}px`).toBeGreaterThan(0);
      expect(result.failures.map((failure) => `${width}: ${failure}`)).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

