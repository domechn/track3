import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { installTauriBridge as installFidelityBridge } from "./fidelity-desktop-scenes";

test("Summary presents attribution from existing snapshot data", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const attribution = page.getByRole("table", { name: "Profit attribution" });
  await expect(attribution.getByRole("columnheader", { name: "Market", exact: true })).toBeVisible();
  await expect(attribution.getByRole("columnheader", { name: "Quantity", exact: true })).toBeVisible();
  await expect(attribution.getByRole("rowheader", { name: "BTC" })).toBeVisible();
  await expect(attribution.getByRole("row", { name: /BTC/ }).getByRole("cell")).toHaveCount(5);
  await expect(attribution.getByRole("rowheader", { name: "Total" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Top profit and loss coins" }).getByRole("rowheader", { name: "BTC" })).toBeVisible();
});

test("Summary explains unmatched attribution and exposes grouping choices", async ({ page }) => {
  await installFidelityBridge(page, { fidelityDesktop: "summary" });
  await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "DELETE FROM transactions WHERE uuid = 'fidelity-2025-07' AND symbol = 'BTC'",
    values: [],
  }));
  await page.goto("/#/summary");
  await expect(page.getByText("Unexplained", { exact: true })).toBeVisible({ timeout: 40_000 });
  const attribution = page.getByRole("table", { name: "Profit attribution" });
  await expect(attribution.getByRole("columnheader", { name: "Unexplained" })).toBeVisible({ timeout: 40_000 });
  const btc = attribution.getByRole("row", { name: /BTC/ });
  await expect(btc.getByRole("cell")).toHaveCount(5);
  await expect(btc.getByRole("cell").nth(3)).not.toHaveText("$0");
  await expect(btc.getByRole("cell").nth(3)).toHaveText("+$5,736");
  await expect(btc.getByRole("cell").nth(3)).toHaveAttribute("title", "+$5,735.85");
  const options = page.locator(".fidelity-attribution-options");
  await expect(options.locator("summary")).toContainText("Group by");
  await expect(options.locator("summary")).toHaveAttribute("title", "Group attribution by");
  await expect(options.locator("summary").getByText("⌄")).toBeVisible();
  await options.locator("summary").click();
  await options.getByRole("button", { name: "Source" }).click();
  await expect(options.getByRole("button", { name: "Source" })).toHaveAttribute("aria-pressed", "true");
});

test("desktop Cost basis keeps Export in the page header at 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/cost-basis");
  const header = page.locator(".analyze-cost-basis > header").first();
  const exportButton = page.getByRole("button", { name: "Export", exact: true });
  await expect(exportButton).toBeVisible();
  const headerBox = (await header.boundingBox())!;
  const exportBox = (await exportButton.boundingBox())!;
  expect(exportBox.y).toBeGreaterThanOrEqual(headerBox.y - 2);
  expect(exportBox.y + exportBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 2);
});
