import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { executeSceneSql } from "./fidelity-records-scenes";
import { seedHistoryKpisData } from "./history-kpi-scenes";
import { findKpiOverflows, mobileRouteRoot, routes } from "./kpi-overflow-scenes";
import { installTauriBridge } from "./tauri-bridge";

for (const width of [390, 820]) {
  for (const theme of ["dark", "light"]) {
    test(`mobile KPI values stay inside their columns at ${width}px in ${theme}`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile");
      test.setTimeout(180_000);
      const context = await browser.newContext({ viewport: { width, height: 1024 },
        userAgent: width === 390
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
          : "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        isMobile: true, hasTouch: true, colorScheme: theme as "dark" | "light" });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
        await executeSceneSql(page, "UPDATE assets_v2 SET value = value * 10000, price = price * 10000");
        const failures: string[] = [];
        let inspected = 0;
        for (const route of routes) {
          if (route === "history") await seedHistoryKpisData(page, 883327.90, 1669806.58);
          await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
          await expect(page.locator("#app-main-content").locator(mobileRouteRoot[route]).first()).toBeVisible({ timeout: 30_000 });
          await expect(page.getByText("Loading page", { exact: true })).toHaveCount(0, { timeout: 30_000 });
          await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
          await page.evaluate(() => document.fonts.ready);
          const result = await findKpiOverflows(page);
          inspected += result.inspected;
          failures.push(...result.failures.map((item) => `${route}: ${item}`));
          if (theme === "dark" && (width === 390 && route.startsWith("coins/") ||
            width === 820 && ["summary", "comparison"].includes(route))) {
            mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
            const target = route === "summary" ? ".profit-metrics-mobile" :
              route === "comparison" ? ".comparison-assets-grid > *:first-child" : ".fd-coin-changes";
            await page.locator(target).first().screenshot({
              path: `/tmp/history-kpi-overflow/kpi-${route.split("/")[0]}-${width}.png`,
            });
            if (route.startsWith("coins/")) await page.locator(".fd-coin-stats").screenshot({
              path: `/tmp/history-kpi-overflow/kpi-coin-stats-${width}.png`,
            });
            if (width === 390 && route.startsWith("coins/"))
              await page.screenshot({ path: "/tmp/history-kpi-overflow/coin-btc-phone-viewport.png" });
          }
        }
        expect(inspected).toBeGreaterThan(30);
        expect(failures).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}

test("iPad comparison amounts fit the 1133px split view", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1133, height: 834 },
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await executeSceneSql(page, "UPDATE assets_v2 SET value = value * 10000, price = price * 10000");
    await page.goto("/#/comparison", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".d2-comparison")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".comparison-assets-grid .comparison-metric-row").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator(".comparison-assets-grid").evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(2);
    const result = await findKpiOverflows(page);
    expect(result.inspected).toBeGreaterThan(3);
    expect(result.failures).toEqual([]);
    mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
    await page.locator(".comparison-assets-grid > *:first-child").screenshot({
      path: "/tmp/history-kpi-overflow/kpi-comparison-1133.png",
    });
  } finally {
    await context.close();
  }
});
