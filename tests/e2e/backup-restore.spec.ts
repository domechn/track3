import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.beforeAll(() => mkdirSync("test-results/backup-restore", { recursive: true }));

for (const [width, height] of [[1440, 900], [1024, 768]] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`desktop restore list and merge preview ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { backupFolderFixture: true, configuredBackupFixture: true });
      await page.goto("/#/settings/data?section=backup");
      const review = page.getByRole("button", { name: "Review backup from device-a" });
      await expect(review).toBeVisible();
      await expect(page.getByText(/Months: 1 · Snapshots: 1/)).toBeVisible();
      await review.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/backup-restore/desktop-${width}-${theme}-list.png`, animations: "disabled" });
      await review.click();
      await expect(page.getByText("2024-02: 1 snapshot")).toBeVisible();
      await expect(page.getByText("New: 1 · Same: 0 · Different: 0")).toBeVisible();
      await page.screenshot({ path: `test-results/backup-restore/desktop-${width}-${theme}-preview.png`, animations: "disabled" });
      await page.getByRole("button", { name: "Apply selected choices" }).click();
      await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
    });
  }
}
