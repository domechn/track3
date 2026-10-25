import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({ isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
test.beforeAll(() => mkdirSync("test-results/mobile", { recursive: true }));

test("imports from a selected Files backup folder", async ({ page }) => {
  await installTauriBridge(page, { backupFolderFixture: true });
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "Import from backup folder" }).click();
  await expect(page.getByText("device-a", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 month · Last backup:/)).toBeVisible();
  await expect(page.getByText("cloud", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Import device-a" }).click();
  await expect(page.getByRole("alertdialog", { name: "Restore data?" })).toBeVisible();
  await page.getByRole("alertdialog", { name: "Restore data?" }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("alertdialog", { name: "Restore data?" })).toHaveCount(0);
  await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
});

test("normalizes a picked backup client and keeps its review inside a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTauriBridge(page, { backupFolderFixture: true, backupFolderPick: "/e2e/cloud/track3-backup/device-a" });
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "Import from backup folder" }).click();
  await expect(page.getByText("Using the parent folder cloud because it contains track3-backup.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import device-a" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator(".ios-d3-folder-client").first().evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect.poll(async () => (await page.locator(".ios-d3-folder-client").first().boundingBox())?.y).toBeLessThan(440);
  await page.screenshot({ path: "test-results/mobile/backup-folder-review.png", animations: "disabled" });
});

test("explains an unrelated folder", async ({ page }) => {
  await installTauriBridge(page, { backupFolderPick: "/e2e/unrelated" });
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "Import from backup folder" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose the folder that contains the track3-backup folder");
});

test("shows a revoked folder state and a choose again action", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTauriBridge(page, { backupFolderFailure: "Backup folder is unavailable. Choose the folder again." });
  await page.goto("/#/settings/data?section=backup");
  await expect(page.getByRole("alert")).toHaveText("Backup folder old is unavailable.");
  await expect(page.getByRole("button", { name: "Choose folder again" })).toBeVisible();
  await page.getByRole("alert").evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect.poll(async () => (await page.getByRole("alert").boundingBox())?.y).toBeLessThan(440);
  await page.screenshot({ path: "test-results/mobile/backup-folder-failure.png", animations: "disabled" });
});
