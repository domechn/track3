import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });

test("imports from a selected Files backup folder", async ({ page }) => {
  await installTauriBridge(page, { backupFolderFixture: true });
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "Import from backup folder" }).click();
  await expect(page.getByText(/^device-a · 1 month · /)).toBeVisible();
  await page.getByRole("button", { name: "Import device-a" }).click();
  await expect(page.getByRole("alertdialog", { name: "Restore data?" })).toBeVisible();
  await page.getByRole("alertdialog", { name: "Restore data?" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("alertdialog", { name: "Restore data?" })).toHaveCount(0);
  await expect(page.getByText("Import data successfully")).toBeVisible();
  await expect(page.getByText("/e2e/cloud")).toBeVisible();
});
