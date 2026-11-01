import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("coin price strip leaves Positions and Profit to their detail cards", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/coins/BTC");
  const strip = page.locator(".coin-price-strip");
  await expect(strip).toContainText("Price");
  await expect(strip).toContainText("Total Value");
  await expect(strip).not.toContainText("Positions");
  await expect(strip).not.toContainText("Profit");
});
