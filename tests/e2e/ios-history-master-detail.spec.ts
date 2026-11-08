import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installTauriBridge } from "./fidelity-bridge-captures";

const screenshotDir = "/tmp/track3-history-master-detail";

for (const scheme of ["dark", "light"] as const) {
  test.describe(`phone History ${scheme}`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
      colorScheme: scheme,
      reducedMotion: "reduce",
      timezoneId: "UTC",
    });

    test("list opens a separate detail screen and Back restores scroll", async ({ page }) => {
      test.setTimeout(120_000);
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), scheme);
      await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
      await page.goto("/#/history");
      const main = page.locator("#app-main-content");
      await expect(page.getByTestId("history-mobile-row").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".fidelity-history-subtitle")).toContainText("1,038");
      await main.evaluate((node) => { node.scrollTop = 350; });
      const savedScrollTop = await main.evaluate((node) => node.scrollTop);
      expect(savedScrollTop).toBeGreaterThan(0);
      const row = page.locator(".history-mobile-snapshot").filter({ hasText: "$752,642.71" }).getByTestId("history-mobile-row");
      await row.click();
      const detail = page.getByRole("dialog", { name: /snapshot details/i });
      await expect(detail).toBeVisible();
      await expect(detail).toContainText("47 assets");
      await expect(detail.locator(".fidelity-history-detail-asset")).toHaveCount(12);
      await detail.getByRole("button", { name: "Show all (47)" }).click();
      await expect(detail.locator(".fidelity-history-detail-asset")).toHaveCount(47);
      await detail.getByRole("button", { name: "Show less" }).click();
      await expect(detail.locator(".fidelity-history-detail-asset")).toHaveCount(12);
      await detail.getByRole("button", { name: "Edits", exact: true }).click();
      await expect(detail.locator(".fidelity-history-detail-edits")).toBeInViewport();
      await expect(page.locator(".history-mobile-list")).toBeHidden();
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: `${screenshotDir}/${scheme}-phone-detail.png`, animations: "disabled" });
      await detail.getByRole("button", { name: "Back" }).click();
      await expect(page.locator(".history-mobile-list")).toBeVisible();
      await expect(detail).toBeHidden();
      await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(savedScrollTop);
      await page.screenshot({ path: `${screenshotDir}/${scheme}-phone-list.png`, animations: "disabled" });
    });
  });
}

test.describe("iPad History", () => {
  test.use({
    viewport: { width: 820, height: 900 },
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    reducedMotion: "reduce",
    timezoneId: "UTC",
  });

  test("regular width opens a separate detail screen and Back restores list scroll", async ({ page }) => {
    test.setTimeout(120_000);
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
    await page.goto("/#/history");
    const main = page.locator("#app-main-content");
    const list = page.locator(".fidelity-history-list");
    await expect(page.locator(".fidelity-history-subtitle")).toContainText("1,038");
    await expect(page.getByTestId("history-mobile-row")).toHaveCount(50);
    await main.evaluate((node) => { node.scrollTop = 440; });
    const savedScrollTop = await main.evaluate((node) => node.scrollTop);
    expect(savedScrollTop).toBeGreaterThan(0);
    const row = page.getByTestId("history-mobile-row").nth(15);
    await row.click();
    const detail = page.getByRole("dialog", { name: /snapshot details/i });
    await expect(detail).toBeVisible();
    await expect(list).toBeHidden();
    await expect(detail.getByRole("button", { name: "Back" })).toBeVisible();
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: `${screenshotDir}/ipad-ios-detail.png`, animations: "disabled" });
    await detail.getByRole("button", { name: "Back" }).click();
    await expect(list).toBeVisible();
    await expect(detail).toBeHidden();
    await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(savedScrollTop);
    await page.screenshot({ path: `${screenshotDir}/ipad-ios-list.png`, animations: "disabled" });
  });
});
