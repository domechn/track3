import { expect, test } from "@playwright/test";
import { seedSettingsB, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "no-folder", "exporting", "conflicts", "restore", "toast-ok", "toast-err"] as const) {
  test(`Backup ${state} desktop fidelity`, async ({ page }) => {
    if (state === "conflicts") test.setTimeout(90_000);
    await seedSettingsB(page, "backup", state);
    await page.goto(settingsBRoute.backup);
    await expect(page.getByText("Automatic backup folder", { exact: true })).toBeVisible();
    if (state === "default") {
      await expect(page.locator(".t3-b-backup-stats")).toContainText("1,284");
      await expect(page.locator(".t3-b-backup-stats")).toContainText("1 Oct 2026");
      await expect(page.locator(".t3-b-backup-restore")).not.toContainText("3/1/2024");
    }
    if (state === "exporting") {
      await page.evaluate(() => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = (command: string, args: unknown, options: unknown) =>
          command === "plugin:dialog|save" ? new Promise(() => {}) : original(command, args, options);
      });
      await page.getByRole("button", { name: "Export JSON" }).click();
      await expect(page.getByRole("button", { name: "Exporting…" })).toBeDisabled();
    } else if (state === "restore") {
      await page.getByRole("button", { name: "Review backup from device-a" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    } else if (state === "toast-ok" || state === "conflicts") {
      await page.getByRole("button", { name: "Export JSON" }).click();
      await expect(page.getByText("Export data successfully", { exact: true })).toBeVisible();
      if (state === "conflicts") {
        await page.getByRole("button", { name: "Choose file and review" }).click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 60_000 });
      }
    } else if (state === "toast-err") {
      await page.evaluate(() => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = (command: string, args: unknown, options: unknown) =>
          command === "plugin:dialog|open" ? Promise.resolve("/e2e/documents/missing.json") : original(command, args, options);
      });
      await page.getByRole("button", { name: "Choose file and review" }).click();
      await expect(page.locator(".desktop-toast-viewport").getByText("Error: file missing: /e2e/documents/missing.json", { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("status", { name: "Backing up data" })).toBeHidden({ timeout: 20_000 });
    await settingsBShot(page, "backup", state);
    if (state === "restore") {
      expect(page.viewportSize()?.height).toBe(1222);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const overlay = await page.locator('div[data-state="open"].fixed.inset-0').first().boundingBox();
      expect(overlay?.y).toBe(0);
      expect(overlay?.height).toBe(1222);
    }
  });
}
