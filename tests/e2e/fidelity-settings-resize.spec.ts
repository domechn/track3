import { expect, test } from "@playwright/test";
import { seedSettingsB } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC" });

test("Pro switches layouts as the window crosses the desktop design width", async ({ page }) => {
  await seedSettingsB(page, "pro", "default");
  await page.goto("/#/settings/systemInfo?section=pro");
  await expect(page.locator(".t3-b-pro")).toBeVisible();
  expect((await page.locator(".t3-b-pro-plan").boundingBox())?.y).toBeLessThan(130);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.locator(".t3-b-pro")).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.locator(".t3-b-pro")).toBeVisible();
});

test("wide settings keep refresh and date range reachable with sync status", async ({ page }) => {
  await seedSettingsB(page, "sync", "default");
  await page.goto("/#/settings/sync");
  const topbar = page.locator(".t3-fidelity-settings-topbar");
  await expect(topbar).toBeVisible();
  await expect(topbar.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(topbar.getByRole("button", { name: "Choose date range" })).toBeVisible();
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
  const status = await topbar.locator(".desktop-sync-status-indicator button").boundingBox();
  const date = await topbar.getByRole("button", { name: "Choose date range" }).boundingBox();
  const refresh = await topbar.getByRole("button", { name: "Refresh" }).boundingBox();
  expect(status!.x).toBeGreaterThan(date!.x);
  expect(status!.x).toBeGreaterThan(refresh!.x);
  expect(1600 - status!.x - status!.width).toBeGreaterThanOrEqual(24);
  expect(1600 - status!.x - status!.width).toBeLessThanOrEqual(32);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(topbar.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(topbar.getByRole("button", { name: "Choose date range" })).toBeVisible();
});

test("resizing sync settings keeps one status pill", async ({ page }) => {
  await seedSettingsB(page, "sync", "default");
  await page.goto("/#/settings/sync");
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
});

test("wide sync reports an unchanged round as up to date", async ({ page }) => {
  await seedSettingsB(page, "sync", "default");
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.evaluate(async () => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(runtimeModule);
    (syncRuntime as any).publish("ready", {
      phase: "idle",
      report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [], devices: [] },
      lastSync: Date.now(),
    });
  });
  await page.locator(".sync-device-actions").getByRole("button", { name: "Sync now" }).click();
  await expect(page.locator(".desktop-toast-viewport")).toContainText("Up to date");
});
