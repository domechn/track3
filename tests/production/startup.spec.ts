import { expect, test } from "@playwright/test";
import { installTauriBridge } from "../e2e/tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

for (const platform of ["desktop", "iPhone"] as const) {
  test(`${platform} production bundle starts without JavaScript errors`, async ({ browser }) => {
    const context = await browser.newContext(platform === "iPhone"
      ? { userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }
      : {});
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await installTauriBridge(page);
      await page.goto("/#/overview");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      if (platform === "iPhone") {
        await expect(page.locator(".mobile-tab-bar")).toBeVisible();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
