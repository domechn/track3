import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("phone Wallets shows snapshot changes without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/wallets");
  await expect(page.locator(".analyze-wallets")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "30-day change by source" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset changes by source" })).toBeVisible();
  await expect(page.locator(".wallet-asset-change-mobile > div").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("phone analysis dates follow the selected Chinese language", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  await expect(page.locator(".ath-card")).toContainText(/10月\d+日/);
  await expect(page.locator(".ath-card")).toContainText("−$801.27 · −1.06%");
  await page.goto("/#/wallets");
  await expect(page.locator(".wallet-source-change-heading span").first()).toContainText(/2026年\d+月\d+日/);
});
