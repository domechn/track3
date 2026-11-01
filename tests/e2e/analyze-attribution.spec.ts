import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("Summary presents attribution from existing snapshot data", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  await page.getByRole("radio", { name: "Attribution" }).click();
  await expect(page.getByRole("columnheader", { name: "Market" })).toHaveCount(1);
});

test("desktop Cost basis keeps Export in the page header at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/cost-basis");
  const header = page.locator(".analyze-cost-basis > div").first();
  const exportButton = page.getByRole("button", { name: "Export", exact: true });
  await expect(exportButton).toBeVisible();
  const headerBox = (await header.boundingBox())!;
  const exportBox = (await exportButton.boundingBox())!;
  expect(exportBox.y).toBeGreaterThanOrEqual(headerBox.y - 2);
  expect(exportBox.y + exportBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 2);
});
