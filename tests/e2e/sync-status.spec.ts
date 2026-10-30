import { expect, test } from "@playwright/test";
import { captureSyncStates, captureSyncStatusWithToast } from "./sync-status-captures";
import { installTauriBridge } from "./tauri-bridge";

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "zh"] as const) {
    test(`desktop sync status captures ${theme} ${locale}`, async ({ page }) => {
      await captureSyncStates(page, "desktop", theme, locale);
    });
  }
}

test("desktop locked prompt dismisses and turn-off requires confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const pill = page.getByRole("button", { name: "Sync locked" });
  await expect(page.getByLabel("Sync passphrase")).toBeVisible();
  await expect(page.getByLabel("Sync passphrase")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Sync passphrase")).toHaveCount(0);
  await expect(pill).toBeFocused();
  await pill.click();
  await page.mouse.click(500, 100);
  await expect(page.getByLabel("Sync passphrase")).toHaveCount(0);
  await pill.click();
  await page.getByRole("button", { name: "Turn off sync on this device" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(pill).toBeVisible();
  if (!await page.getByRole("button", { name: "Turn off sync on this device" }).isVisible()) await pill.click();
  await page.getByRole("button", { name: "Turn off sync on this device" }).click();
  await page.getByRole("button", { name: "Turn off sync", exact: true }).click();
  await expect(pill).toHaveCount(0);
});

test("desktop pill clears the toast and sidebar collapse control", async ({ page }) => {
  await captureSyncStatusWithToast(page, "desktop");
});
