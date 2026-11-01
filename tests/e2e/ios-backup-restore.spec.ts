import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
test.beforeAll(() => mkdirSync("test-results/backup-restore", { recursive: true }));

for (const [width, height] of [[390, 844], [834, 1112]] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`iOS restore list and merge preview ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { backupFolderFixture: true, configuredBackupFixture: true });
      await page.goto("/#/settings/data?section=backup");
      const review = page.getByRole("button", { name: "Review backup from device-a" });
      await expect(review).toBeVisible();
      await review.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/backup-restore/ios-${width}-${theme}-list.png`, animations: "disabled" });
      await review.click();
      await expect(page.getByText("2024-02: 1 snapshot")).toBeVisible();
      await expect(page.getByText("New: 1 · Same: 0 · Different: 0")).toBeVisible();
      await page.screenshot({ path: `test-results/backup-restore/ios-${width}-${theme}-preview.png`, animations: "disabled" });
      await page.getByRole("button", { name: "Apply selected choices" }).click();
      await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
