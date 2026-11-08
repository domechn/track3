import { expect, test } from "@playwright/test";
import { changes, seedDailyChanges, seedGoalRule } from "./chart-tooltip-scenes";
import { installFidelityRecords } from "./fidelity-records-scenes";

for (const theme of ["light", "dark"] as const) {
  test(`Daily change has nine exact hover and keyboard tooltips at 1280px in ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await seedDailyChanges(page);
      await page.goto("/#/overview");
      const marks = page.locator(".t3-daily-chart [data-chart-mark]");
      await expect(marks).toHaveCount(9, { timeout: 30_000 });
      for (let index = 0; index < 9; index++) {
        await marks.nth(index).hover({ position: { x: 2, y: 10 } });
        const tip = page.locator("[data-chart-tooltip]");
        await expect(tip).toBeVisible();
        await expect(tip).toContainText(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(changes[index])));
        await expect(tip).toContainText(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
          .format(new Date(Date.UTC(2026, 9, 31 + index))));
        await expect(tip).toContainText(new Intl.DateTimeFormat("en-GB", { weekday: "short" })
          .format(new Date(Date.UTC(2026, 9, 31 + index))));
        const percent = changes[index] / (1_700_000 + changes.slice(0, index).reduce((sum, change) => sum + change, 0)) * 100;
        await expect(tip).toContainText(`${percent < 0 ? "−" : "+"}${Math.abs(percent).toFixed(2)}%`);
        const total = 1_700_000 + changes.slice(0, index + 1).reduce((sum, change) => sum + change, 0);
        await expect(tip).toContainText(`$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}`);
        const box = (await tip.boundingBox())!;
        const cursor = (await marks.nth(index).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1280);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(800);
        expect(box.x + box.width <= cursor.x + 2 || box.x >= cursor.x + cursor.width ||
          box.y + box.height <= cursor.y + 10 || box.y >= cursor.y + cursor.height).toBe(true);
        await expect(marks.nth(index)).toHaveCSS("opacity", "1");
        await expect(marks.nth((index + 1) % 9)).toHaveCSS("opacity", "0.55");
        await expect(tip).toHaveCSS("pointer-events", "none");
      }
      await marks.last().hover();
      await expect(page.locator("[data-chart-tooltip]")).toBeVisible();
      await page.screenshot({ path: `test-results/chart-tooltip-desktop-${theme}.png`, animations: "disabled" });
      await marks.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(marks.nth(1)).toBeFocused();
      await expect(marks.nth(1)).toHaveAttribute("aria-label", /down 52,314.07, minus 3.06%/);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-chart-tooltip]")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

test("coin detail points expose exact price on hover", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
  await seedDailyChanges(page);
  await page.goto("/#/coins/BTC");
  await page.locator(".coin-fidelity-chart-controls").getByRole("button", { name: "Price" }).click();
  await expect(page.locator(".coin-fidelity-plot").getByRole("group", { name: "Price" })).toBeVisible();
  const mark = page.locator(".coin-fidelity-plot [data-chart-mark]").last();
  await expect(mark).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: await mark.getAttribute("aria-label") ?? "" })).toBeVisible();
  await mark.hover();
  await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
  await expect(page.locator("[data-chart-tooltip]")).toContainText("Nov");
});

for (const route of ["overview", "summary", "coins/BTC", "wallets", "comparison", "rebalance", "goals", "cost-basis"]) {
  test(`every ${route} chart mark exposes a tooltip on hover`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: route === "rebalance" ? 1600 : route === "wallets" ? 1440 : 1280, height: 800 });
    if (route === "rebalance") {
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    }
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    if (route === "cost-basis") await installFidelityRecords(page);
    else await seedDailyChanges(page);
    if (route === "goals") await seedGoalRule(page);
    await page.goto(`/#/${route}`);
    const marks = page.locator(route === "overview"
      ? ".t3-moved-panel [data-chart-mark]:visible" : "[data-chart-mark]:visible");
    await expect(marks.first()).toBeVisible({ timeout: 60_000 });
    const count = await marks.count();
    for (let index = 0; index < count; index++) {
      const label = await marks.nth(index).getAttribute("aria-label");
      await marks.nth(index).hover({ timeout: 10_000 }).catch(async (error: unknown) => {
        throw new Error(`${route} mark ${index} ${label}; current count ${await marks.count()}: ${String(error)}`);
      });
      await expect(page.locator("[data-chart-tooltip]"), `${route} mark ${index} ${await marks.nth(index).getAttribute("aria-label")}`).toBeVisible();
    }
  });
}
