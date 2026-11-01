import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("Wallets derives a 30-day source and asset matrix from snapshots", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/wallets");
  await expect(page.getByTestId("wallet-treemap-container")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "30-day change by source" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Asset changes by source" })).toBeVisible();
  await expect(page.locator(".wallet-asset-change-scroll tbody tr").first()).toBeVisible();
  await expect(page.locator(".wallet-source-change-list > div").first()).toBeVisible();
});
