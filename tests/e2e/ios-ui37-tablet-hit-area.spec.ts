import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

for (const width of [744, 834]) {
  test(`tablet Overview chart button has a 44px hit area at ${width}px`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    const context = await browser.newContext({
      userAgent: iPhoneUserAgent, viewport: { width, height: width === 744 ? 1133 : 1194 },
      hasTouch: true, isMobile: true, colorScheme: "dark", reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
      await page.goto("/#/overview");
      const button = page.locator(".t3-chart-best-day");
      await expect(button).toBeVisible({ timeout: 30_000 });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.goto("/#/summary");
      await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      const columns = await page.locator(".profit-metrics-mobile").evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(" ").length);
      expect(columns).toBe(2);
    } finally {
      await context.close();
    }
  });
}
