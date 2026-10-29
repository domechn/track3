import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { captureSyncStates } from "./sync-status-captures";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const theme of ["light", "dark"] as const) {
  for (const locale of ["en", "zh"] as const) {
    test(`mobile sync status captures ${theme} ${locale}`, async ({ page }) => {
      await captureSyncStates(page, "mobile", theme, locale);
    });
  }
}

test("locked sync popover and controls fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  for (const name of ["Unlock sync", "Skip for now", "Turn off sync on this device"]) {
    expect((await page.getByRole("button", { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test("mobile locked prompt dismisses and turn-off requires confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  const pill = page.getByRole("button", { name: "Sync locked" });
  await expect(page.getByLabel("Sync passphrase")).toBeVisible();
  await expect(page.getByLabel("Sync passphrase")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Sync passphrase")).toHaveCount(0);
  await expect(pill).toBeFocused();
  await pill.click();
  await page.touchscreen.tap(20, 100);
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
