import { expect, test } from "@playwright/test";
import { seedOverviewChart } from "./overview-chart-scenes";

test.use({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
});

test("phone chart accepts input across the top of its plot", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const chart = page.locator(".fd-overview-chart");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".fd-overview-chart-caption")).toBeVisible();
  const acceptsPlotInput = await chart.evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    return document.elementFromPoint(box.left + 30, box.top + 10)?.closest("svg") === svg;
  });
  expect(acceptsPlotInput).toBe(true);
  await chart.tap({ position: { x: 30, y: 10 } });
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/\$[\d,]+\.\d\d/);
});
