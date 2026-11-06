import { expect, test } from "@playwright/test";
import { seedSettingsB } from "./fidelity-settings-b-scenes";
import { expectSettingsCardsFitContent } from "./settings-card-layout-scenes";

test.use({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC", reducedMotion: "reduce" });

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
  await page.locator(".t3-sync-status").getByRole("button", { name: "Sync now" }).click();
  await expect(page.locator(".desktop-toast-viewport")).toContainText("Up to date");
});

for (const width of [1600, 1280, 1100]) {
  for (const mode of ["locked", "ready", "setup"] as const) {
    test(`sync cards fit their content at ${width}px in ${mode} state`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedSettingsB(page, "sync", mode === "setup" ? "setup" : "locked");
      await page.goto("/#/settings/sync");
      await expect(page.locator(".t3-sync-connection")).toBeVisible({ timeout: 15_000 });
      if (mode === "ready") {
        await page.getByRole("button", { name: "Skip for now" }).click();
        await page.evaluate(async () => {
          const runtimeModule: string = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          (syncRuntime as any).publish("ready", { phase: "idle" });
        });
      } else if (mode === "locked") {
        await page.getByRole("button", { name: "Skip for now" }).click();
      }
      await expectSettingsCardsFitContent(page, ".sync-settings-page [data-ui-card]");
      const { left, right } = await page.evaluate(() => ({
        left: document.querySelector(".t3-sync-connection")!.getBoundingClientRect().height,
        right: document.querySelector(".t3-sync-top-right")!.getBoundingClientRect().height,
      }));
      if (width < 1500) {
        expect(Math.max(left, right) / Math.min(left, right), `left ${left}px, right ${right}px`).toBeLessThanOrEqual(1.3);
      }
      await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
      await expect(page.locator(".t3-sync-connection")).toBeInViewport();
      await page.screenshot({ path: `/tmp/track3-sync-${width}-${mode}-dark.png`, animations: "disabled" });
    });
  }
}

for (const width of [1280, 1100]) {
  test(`sync status and passphrase fit in light theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedSettingsB(page, "sync", "locked", "light");
    await page.goto("/#/settings/sync");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expectSettingsCardsFitContent(page, ".sync-settings-page [data-ui-card]");
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    await expect(page.locator(".t3-sync-connection")).toBeInViewport();
    await page.screenshot({ path: `/tmp/track3-sync-${width}-locked-light.png`, animations: "disabled" });
  });
}

test("sync status does not repeat transfer values in the device card", async ({ page }) => {
  await seedSettingsB(page, "sync", "locked");
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator(".t3-sync-status")).toContainText("Last successful sync");
  await expect(page.locator(".t3-sync-devices")).not.toContainText("Uploaded");
  await expect(page.locator(".t3-sync-devices")).not.toContainText("Downloaded");
});

for (const width of [1280, 1100]) test(`secrets caption keeps its lock inline at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seedSettingsB(page, "sync", "locked");
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Skip for now" }).click();
  const caption = page.locator(".t3-b-sync-category-description.secret");
  await expect(caption).toBeVisible();
  const { iconTop, textTop } = await caption.evaluate((node) => {
    const iconTop = node.querySelector("svg")!.getBoundingClientRect().top;
    const text = Array.from(node.childNodes).find((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())!;
    const range = document.createRange();
    range.selectNodeContents(text);
    return { iconTop, textTop: range.getBoundingClientRect().top };
  });
  expect(Math.abs(iconTop - textTop)).toBeLessThanOrEqual(3);
});
