import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

test("ordinary BTC phone viewport keeps the design grid", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    userAgent: iPhoneUserAgent, isMobile: true, hasTouch: true,
    colorScheme: "dark", reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".fd-coin-changes")).not.toHaveClass(/long-amount/);
    expect((await page.locator(".fd-coin-hero").boundingBox())!.height).toBe(586);
    await page.locator("#app-main-content").evaluate((node) => { node.scrollTop = 0; });
    mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
    await page.screenshot({ path: "/tmp/history-kpi-overflow/coin-btc-phone-viewport-final.png" });
  } finally {
    await context.close();
  }
});
