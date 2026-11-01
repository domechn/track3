import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("phone Hide values masks every mover figure", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/comparison");
  const movers = page.locator(".comparison-movers");
  await expect(movers).toBeVisible();
  await page.getByRole("button", { name: "Hide values" }).click();
  await expect(movers).toContainText("***");
  await expect(movers).not.toContainText(/\d|\$/);
});
