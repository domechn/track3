import { expect, test } from "@playwright/test";
import { changes, seedDailyChanges, seedGoalRule } from "./chart-tooltip-scenes";
import { installFidelityRecords } from "./fidelity-records-scenes";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

for (const theme of ["light", "dark"] as const) {
  test(`phone Daily change supports nine full-column taps in ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, colorScheme: theme,
      isMobile: true, hasTouch: true, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await seedDailyChanges(page);
      await page.goto("/#/overview");
      const marks = page.locator(".fd-overview-daily-chart [data-chart-mark]");
      await expect(marks).toHaveCount(9, { timeout: 30_000 });
      for (let index = 0; index < 9; index++) {
        await marks.nth(index).tap();
        const tip = page.locator("[data-chart-tooltip]");
        await expect(tip).toContainText(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          .format(Math.abs(changes[index])));
        await expect(tip).toContainText(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
          .format(new Date(Date.UTC(2026, 9, 31 + index))));
        await expect(tip).toContainText(new Intl.DateTimeFormat("en-GB", { weekday: "short" })
          .format(new Date(Date.UTC(2026, 9, 31 + index))));
        const percent = changes[index] / (1_700_000 + changes.slice(0, index).reduce((sum, change) => sum + change, 0)) * 100;
        await expect(tip).toContainText(`${percent < 0 ? "−" : "+"}${Math.abs(percent).toFixed(2)}%`);
        const box = (await tip.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(844);
        const bar = (await marks.nth(index).locator("xpath=..").locator("rect[data-direction]").boundingBox())!;
        expect(box.x + box.width <= bar.x || box.x >= bar.x + bar.width ||
          box.y + box.height <= bar.y || box.y >= bar.y + bar.height).toBe(true);
        await expect(marks.nth(index).locator("xpath=..").locator("rect[data-direction]")).toHaveAttribute("opacity", "1");
        await expect(marks.nth((index + 1) % 9).locator("xpath=..").locator("rect[data-direction]")).toHaveAttribute("opacity", "0.55");
      }
      await page.locator(".fd-overview-daily h3").tap();
      await expect(page.locator("[data-chart-tooltip]")).toHaveCount(0);
      await marks.last().tap();
      await page.screenshot({ path: `test-results/chart-tooltip-phone-${theme}.png`, animations: "disabled" });
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

test("phone Summary chart reveals an exact point value on tap", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/summary");
    const mark = page.locator(".fd-summary-chart [data-chart-mark]").last();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText(".00");
    await expect(page.locator(".fd-summary-chart .fd-chart-chip")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("phone Overview line points reveal exact totals on tap", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/overview");
    const mark = page.locator(".fd-overview-chart [data-chart-mark]").last();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText(".00");
    await expect(page.locator(".fd-overview-chart g:has(> rect[height='46'])")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("phone What moved bars reveal exact changes without opening coin details", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/overview");
    const mark = page.locator(".fd-overview-moved [data-chart-mark]").first();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page).toHaveURL(/#\/overview$/);
  } finally {
    await context.close();
  }
});

test("phone Summary attribution bars reveal exact known P&L and other changes", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/summary");
    const mark = page.locator(".fd-attr-row [data-chart-mark]").first();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText("Known P&L");
    await expect(page.locator("[data-chart-tooltip]")).toContainText("Cash flow and other changes");
  } finally {
    await context.close();
  }
});

test("phone Summary month bars retain an exact tooltip after tapping", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/summary");
    const mark = page.locator(".fd-month-grid [data-chart-mark]").last();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText("29,950.33");
  } finally {
    await context.close();
  }
});

test("phone coin detail points expose exact price on tap", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/coins/BTC");
    await page.locator(".fd-chart-controls").getByRole("button", { name: "Price" }).click();
    const mark = page.locator(".fd-coin-chart [data-chart-mark]").last();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText("Nov");
  } finally {
    await context.close();
  }
});

test("phone Wallets share segment shows its exact value on tap", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
    await seedDailyChanges(page);
    await page.goto("/#/wallets");
    const mark = page.locator(".fd-wallet-split [data-chart-mark]").first();
    await expect(mark).toBeVisible({ timeout: 30_000 });
    await mark.tap();
    await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
    await expect(page.locator("[data-chart-tooltip]")).toContainText("%");
  } finally {
    await context.close();
  }
});

for (const route of ["overview", "summary", "coins/BTC", "wallets", "comparison", "rebalance", "goals", "cost-basis"]) {
  test(`every phone ${route} chart mark exposes a tooltip on tap`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 },
      isMobile: true, hasTouch: true, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-11-08T16:00:00Z"));
      if (route === "cost-basis") await installFidelityRecords(page);
      else await seedDailyChanges(page);
      if (route === "goals") await seedGoalRule(page);
      await page.goto(`/#/${route}`);
      const marks = page.locator(route === "overview"
        ? ".fd-overview-chart [data-chart-mark]:visible, .fd-overview-moved [data-chart-mark]:visible"
        : "[data-chart-mark]:visible");
      await expect(marks.first()).toBeVisible({ timeout: 60_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      const count = await marks.count();
      for (let index = 0; index < count; index++) {
        const label = await marks.nth(index).getAttribute("aria-label");
        await marks.nth(index).tap({ timeout: 10_000 }).catch(async (error: unknown) => {
          throw new Error(`${route} mark ${index} ${label}; current count ${await marks.count()}: ${String(error)}`);
        });
        await expect(page.locator("[data-chart-tooltip]"), `${route} mark ${index} ${await marks.nth(index).getAttribute("aria-label")}`).toBeVisible();
      }
    } finally {
      await context.close();
    }
  });
}
