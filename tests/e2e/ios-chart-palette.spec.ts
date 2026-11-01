import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone treemap category backgrounds resolve in light and dark themes", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: iPhoneUserAgent,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".app-layout")).toBeVisible();

    for (const dark of [false, true]) {
      const colors = await page.evaluate((useDark) => {
        document.documentElement.classList.toggle("dark", useDark);
        return [1, 3, 4, 5, 6].map((index) => {
          const tile = document.createElement("button");
          tile.style.background = `var(--ios-chart-${index})`;
          document.body.appendChild(tile);
          const color = getComputedStyle(tile).backgroundColor;
          tile.remove();
          return color;
        });
      }, dark);
      expect(colors, `${dark ? "dark" : "light"} phone treemap fills`).not.toContain("rgba(0, 0, 0, 0)");
      expect(new Set(colors).size).toBe(5);
    }
  } finally {
    await context.close();
  }
});
