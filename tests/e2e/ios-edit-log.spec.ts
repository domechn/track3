import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const width of [390, 834]) for (const theme of ["light", "dark"] as const) {
  test(`History edit log iOS ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1112 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, { richPortfolio: true, freshReviewData: true, seedEditLog: true });
    mkdirSync("test-results/edit-log", { recursive: true });
    await page.goto("/#/history");
    await expect(page.locator("[data-testid=history-content][aria-busy=true]")).toHaveCount(0);
    await expect(page.getByText("Edited", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/edit-log/ios-${width}-${theme}-list.png` });
    await page.getByRole("combobox", { name: "History filter" }).click();
    await page.getByRole("option", { name: "Edited" }).click();
    const row = page.getByTestId("history-mobile-row");
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(page.getByRole("region", { name: "Edit log" })).toContainText("Restored asset ETH");
    await page.screenshot({ path: `test-results/edit-log/ios-${width}-${theme}-detail.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
