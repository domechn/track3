import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { seedOverviewChart } from "./overview-chart-scenes";
import { mkdirSync } from "node:fs";

test.use({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("dense phone history keeps the best day caption above the plot in every range", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const chart = page.locator(".fd-overview-chart");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await page.getByRole("radio", { name: "All" }).click();
  await expect(page.locator(".fd-overview-chart-caption")).toContainText("1 Nov");
  mkdirSync("/tmp/overview-chart-hover", { recursive: true });
  for (const range of ["7D", "30D", "90D", "1Y", "All"]) {
    await page.getByRole("radio", { name: range, exact: true }).click();
    await expect(chart).toBeVisible();
    const caption = page.locator(".fd-overview-chart-caption");
    if (await caption.count()) {
      const captionBox = (await caption.boundingBox())!;
      const chartBox = (await chart.boundingBox())!;
      expect(captionBox.x).toBeGreaterThanOrEqual(chartBox.x);
      expect(captionBox.x + captionBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width);
      expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(chartBox.y + chartBox.height * 26 / 190);
    }
    const chartBox = (await chart.boundingBox())!;
    const cardBox = (await page.locator(".fd-overview-hero").boundingBox())!;
    for (const fraction of [0, .1, .2, .3, .4, .5, .6, .7, .8, 1]) {
      await chart.tap({ position: { x: chartBox.width * (.2 + fraction * .6), y: 90 } });
      const tip = page.locator("[data-chart-tooltip]");
      await expect(tip).toContainText(/\$[\d,]+\.\d\d/);
      const box = (await tip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x + 7);
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width - 7);
      expect(box.y).toBeGreaterThanOrEqual(cardBox.y + 7);
      expect(box.y + box.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 7);
      const point = (await chart.locator("[data-chart-active-point]").boundingBox())!;
      expect(box.x + box.width <= point.x - 4 || box.x >= point.x + point.width + 4 ||
        box.y + box.height <= point.y - 4 || box.y >= point.y + point.height + 4).toBe(true);
      const crosshair = Number(await chart.locator("[data-chart-crosshair]").getAttribute("x1"));
      const pointX = Number(await chart.locator("[data-chart-active-point]").getAttribute("cx"));
      expect(Math.abs(crosshair - pointX)).toBeLessThanOrEqual(1);
    }
    await page.locator(".fd-overview-hero").screenshot({ path: `/tmp/overview-chart-hover/phone-${range}.png` });
  }
});

test("phone best-day caption avoids every line segment when the day is early, middle, or late", async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync("/tmp/overview-chart-hover", { recursive: true });
  for (const [day, expected] of [[1, "25 Oct"], [8, "1 Nov"], [15, "8 Nov"]] as const) {
    const page = await browser.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
    await seedOverviewChart(page, "USD", day);
    await page.goto("/#/overview");
    await page.getByRole("radio", { name: "All" }).click();
    const caption = page.locator(".fd-overview-chart-caption");
    await expect(caption).toContainText(expected, { timeout: 30_000 });
    await expect(caption).toContainText("USDT", { timeout: 30_000 });
    const clear = await page.locator(".fd-overview-chart").evaluate((svg) => {
      const path = svg.querySelector("path")!;
      const caption = document.querySelector(".fd-overview-chart-caption")!.getBoundingClientRect();
      const matrix = path.getScreenCTM()!;
      for (let length = 0; length <= path.getTotalLength(); length++) {
        const point = path.getPointAtLength(length).matrixTransform(matrix);
        if (point.x >= caption.left - 6 && point.x <= caption.right + 6 &&
          point.y >= caption.top - 6 && point.y <= caption.bottom + 6) return false;
      }
      return true;
    });
    expect(clear).toBe(true);
    await page.locator(".fd-overview-hero").screenshot({ path: `/tmp/overview-chart-hover/phone-best-${day}.png` });
    await caption.focus();
    await expect(page.locator("[data-chart-tooltip]")).toContainText(expected);
    const marker = Number(await page.locator("[data-best-day-marker]").getAttribute("cx"));
    const selected = Number(await page.locator("[data-chart-active-point]").getAttribute("cx"));
    expect(Math.abs(marker - selected)).toBeLessThanOrEqual(1);
    await page.close();
  }
});

test("phone chart caption stays above the line and tap shows the snapshot value", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  const chart = page.locator(".fd-overview-chart");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await chart.tap({ position: { x: 150, y: 90 } });
  const tooltip = page.locator("[data-chart-tooltip]");
  await expect(tooltip).toContainText(/\$[\d,]+\.\d\d/);
  const crosshair = Number(await chart.locator("[data-chart-crosshair]").getAttribute("x1"));
  const point = Number(await chart.locator("[data-chart-active-point]").getAttribute("cx"));
  expect(Math.abs(crosshair - point)).toBeLessThanOrEqual(1);
  const caption = page.locator(".fd-overview-chart-caption");
  await expect(caption).toBeVisible();
  const captionBox = await caption.boundingBox();
  const chartBox = await chart.boundingBox();
  expect(captionBox!.y + captionBox!.height).toBeLessThanOrEqual(chartBox!.y + chartBox!.height * 26 / 190);
});

test("phone Daily change keeps the latest 31 snapshot deltas across chart ranges", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const bars = page.locator(".fd-overview-daily-chart rect");
  await expect(bars).toHaveCount(31, { timeout: 30_000 });
  await page.getByRole("radio", { name: "7D", exact: true }).click();
  await expect(bars).toHaveCount(31);
});

test("phone CNY chart labels and tooltip fit in light mode", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page, "CNY");
  await page.goto("/#/overview");
  await page.getByRole("radio", { name: "All" }).click();
  const card = page.locator(".fd-overview-hero");
  await expect(card.locator(".fd-overview-value")).toHaveText("¥11,656,732.64", { timeout: 30_000 });
  const chart = card.locator(".fd-overview-chart");
  await chart.tap({ position: { x: 150, y: 90 } });
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/¥[\d,]+\.\d\d/);
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/Day's top mover: USDT/);
  const ticks = chart.locator("text[text-anchor='end']");
  const cardBox = (await card.boundingBox())!;
  for (const tick of await ticks.all()) {
    const box = (await tick.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(cardBox.x + 8);
  }
  await card.screenshot({ path: "/tmp/overview-chart-hover/phone-cny-light.png" });
});

test("wide iOS overview uses the same complete point tooltip", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const chart = page.locator(".mobile-hero-chart canvas");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  const bounds = (await chart.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/Value: \$[\d,]+\.\d\d/);
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/Change:/);
  await page.locator(".mobile-hero-chart .t3-chart-best-day").focus();
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/Day's top mover: USDT/);
  await page.locator(".mobile-hero-card").screenshot({ path: "/tmp/overview-chart-hover/wide-ios.png" });
  await context.close();
});
