import { expect, test } from "@playwright/test";
import { seedOverviewChart } from "./overview-chart-scenes";

test("desktop chart caption does not cover the plot", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const hero = page.locator(".t3-total-overview .t3-hero-chart");
  const caption = hero.locator(".t3-chart-best-day");
  const plot = hero.locator(".t3-chart-plot");
  const preceding = page.locator(".t3-total-overview .t3-hero-change");
  await expect(caption).toBeVisible({ timeout: 30_000 });
  const precedingBox = (await preceding.boundingBox())!;
  const captionBox = (await caption.boundingBox())!;
  const plotBox = (await plot.boundingBox())!;
  expect(captionBox.y).toBeGreaterThanOrEqual(precedingBox.y + precedingBox.height);
  expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(plotBox.y);
});
