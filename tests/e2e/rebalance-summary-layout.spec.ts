import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("rebalance values stay on one line at narrower desktop and iPad widths", async ({ browser }) => {
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1133, height: 834, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      ...(size.userAgent ? { userAgent: size.userAgent, isMobile: true, hasTouch: true } : {}),
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
      await page.goto("/#/rebalance");
      const values = page.getByTestId("rebalance-summary").locator("strong");
      await expect(values).toHaveCount(5);
      const lines = await values.evaluateAll((nodes) => nodes.map((node) => ({
        text: node.textContent,
        height: node.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(node).lineHeight),
      })));
      expect(lines.every((line) => line.height <= line.lineHeight + 1), JSON.stringify(lines)).toBe(true);
    } finally {
      await context.close();
    }
  }
});
