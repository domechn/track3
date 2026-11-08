import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { seedAdditiveProfitHistory, visibleAmount } from "./pnl-additive-scenes";

test("2024 phone year known P&L equals its months at 390px", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    timezoneId: "UTC", reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2024-12-31T12:00:00Z"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try {
    await seedAdditiveProfitHistory(page);
    await page.goto("/#/summary", { waitUntil: "commit", timeout: 120_000 });
    mkdirSync(".local/ui46-final", { recursive: true });
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
    await page.screenshot({ path: ".local/ui46-final/additive-mobile-initial.png", fullPage: true });
    const months = page.locator(".fd-month");
    await expect(months).toHaveCount(12);
    const values = (await months.locator("strong").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("title")))).map(visibleAmount);
    const year = page.locator(".fd-year").filter({ hasText: "2024" });
    await expect(year).toHaveAttribute("data-partial", "true");
    const annual = visibleAmount(await year.locator("strong").first().textContent());
    expect(annual).toBe(409_328);
    expect(Math.abs(annual - values.reduce((sum, value) => sum + value, 0))).toBeLessThanOrEqual(1);
    await expect(months.filter({ hasText: "Mar" })).toHaveAttribute("data-partial", "true");
    await expect(months.locator('[aria-label^="Explain partial profit"]')).toHaveCount(1);
    await expect(page.locator('.fd-year-list [aria-label^="Explain partial profit"]')).toHaveCount(1);
    await expect(year.locator(".fd-year-deposit")).toContainText("217,677");
    await page.setViewportSize({ width: 390, height: 1600 });
    await page.locator(".mobile-tab-bar").evaluate((bar) => { (bar as HTMLElement).style.visibility = "hidden"; });
    await page.locator(".fd-profit-summary").screenshot({ path: ".local/ui46-final/additive-mobile-months.png" });
    await page.locator(".fd-years").screenshot({ path: ".local/ui46-final/additive-mobile-year.png" });
    await page.locator(".mobile-tab-bar").evaluate((bar) => { (bar as HTMLElement).style.visibility = ""; });
    await page.setViewportSize({ width: 390, height: 844 });
    await year.getByRole("button", { name: "Explain partial profit for 2024" }).click();
    await expect(page.locator('[role="tooltip"][data-state="open"]')).toContainText("1 affected month(s)");
    await page.keyboard.press("Escape");
    await year.getByRole("button", { name: "Recorded inflow breakdown" }).click();
    await expect(page.locator('[role="tooltip"][data-state="open"]')).toContainText("Staking rewards");
    await expect(page.locator('[role="tooltip"][data-state="open"]')).toContainText(/coins up · \d+ down/);
    await page.keyboard.press("Escape");
    const zeroDown = year.locator(".fd-year-foot [data-tone='neutral']");
    await expect(zeroDown).toContainText("0 months down");
    expect(await zeroDown.evaluate((node) => getComputedStyle(node).color))
      .toBe(await year.locator(".fd-year-foot").evaluate((node) => getComputedStyle(node).color));
    expect(errors).toEqual([]);
    await page.screenshot({ path: ".local/ui46-final/additive-mobile-390.png", fullPage: true });
  } finally {
    await context.close();
  }
});

test("phone separates invested capital from unrecorded value in the P&L card", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    timezoneId: "UTC", reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2024-02-16T12:00:00Z"));
    await seedAdditiveProfitHistory(page);
    await page.evaluate(async () => {
      const run = (query: string, values: unknown[] = []) =>
        (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
      await run("DELETE FROM transactions");
      await run("DELETE FROM assets_v2");
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES ('opening', '2024-01-15T12:00:00.000Z', 'w', 'crypto', 'BTC', 1, 100, 100),
               ('later', '2024-02-15T12:00:00.000Z', 'w', 'crypto', 'BTC', 2, 240, 120)`);
    });
    await page.goto("/#/summary", { waitUntil: "commit" });
    const card = page.locator(".fd-profit-loss");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
    await expect(card).toContainText("+$20.00");
    await expect(card).toContainText("+20.00%");
    await expect(card).toContainText("on $100");
    await expect(card).toContainText("Unrecorded changes: +$120.00");
    await expect(card.locator(".fd-kpis > div").nth(1)).toContainText("$220");
    await expect(page.locator(".fd-month").filter({ hasText: "Feb" }).locator("small")).toHaveText("+20.00%");
    await expect(page.locator(".fd-year").filter({ hasText: "2024" }).locator("small")).toHaveText("+20.00%");
  } finally {
    await context.close();
  }
});
