import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("rebalance suggestion reaches a confirmed action and updates the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/rebalance");
  await page.getByRole("button", { name: "Set BTC 40%, ETH 30%, USDT 30%" }).click();
  await expect(page).toHaveURL(/#\/assistant$/);
  await expect(page.getByText("Set BTC 40%, ETH 30%, USDT 30%", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Confirm assistant action" })).toBeVisible();
  await expect(page).toHaveURL(/#\/assistant\/[^/]+$/, { timeout: 10_000 });
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("link", { name: "Open Rebalance" }).click();
  await expect(page).toHaveURL(/#\/rebalance$/);
  await expect(page.getByRole("img", { name: /BTC:.*40\.0%.*Target/ }).first()).toBeVisible();
});
