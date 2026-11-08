import { expect, test } from "@playwright/test";
import { seedElevenAssetSummary } from "./summary-top-list-layout-scenes";

for (const theme of ["dark", "light"] as const) {
  test(`opening stock holdings keep the 820px Summary return correct in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 820, height: 900 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true, hasTouch: true, colorScheme: theme,
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((selected) => localStorage.setItem("track3-ui-theme", selected), theme);
      await seedElevenAssetSummary(page);
      await page.goto("/#/summary");
      await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      const stock = page.locator(".profit-mobile-list .mobile-list-row").filter({ hasText: "1211.HK" });
      await expect(stock.locator(".mobile-list-value .text-xs")).toHaveText("-94.54%");
      const box = await stock.evaluate((row) => {
        const value = row.querySelector(".mobile-list-value")!.getBoundingClientRect();
        const label = row.querySelector(".mobile-list-label")!.getBoundingClientRect();
        return { labelRight: label.right, valueLeft: value.left };
      });
      expect(box.labelRight).toBeLessThanOrEqual(box.valueLeft + 1);
    } finally {
      await context.close();
    }
  });
}
