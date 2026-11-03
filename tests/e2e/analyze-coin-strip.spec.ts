import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("coin hero keeps price and position metrics distinct", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/coins/BTC");
  const hero = page.locator(".coin-fidelity-hero");
  await expect(hero).toContainText("BTC price");
  await expect(hero).toContainText("Holdings value");
  await expect(hero.locator(".coin-fidelity-metrics.bottom")).toContainText("Positions");
});
