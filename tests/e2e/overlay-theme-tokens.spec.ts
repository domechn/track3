import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge } from "./fidelity-scenes";
import { contrast, expectFocusRing, expectOverlayTheme } from "./overlay-theme-scenes";

const output = "/tmp/track3-overlay-theme";
const passphrase = "local theme fixture passphrase";
const themes = [
  { stored: "light", scheme: "light" },
  { stored: "dark", scheme: "dark" },
  { stored: "system", scheme: "light" },
] as const;

for (const width of [1280, 1440]) for (const { stored, scheme } of themes) {
  test(`desktop ${width} overlays follow ${stored} with ${scheme} preference`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    test.setTimeout(600_000);
    mkdirSync(output, { recursive: true });
    const context = await browser.newContext({
      viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), stored);
      await page.addInitScript(() => {
        const schedule = window.setTimeout;
        window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
          schedule(handler, delay === 30_000 ? 300_000 : delay, ...args)) as typeof window.setTimeout;
      });
      const s3 = new FakeS3();
      const { header } = await createSyncHeader(passphrase);
      await writeSyncHeader(s3, header);
      await installTauriBridge(page, {
        fidelitySample: "full", appVersion: "0.9.5",
        seedLockedSync: true, routeDemoR2ToFakeS3: true, s3,
      });
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "UPDATE configuration SET data = ? WHERE id = 991",
        values: ['!ent:e2e:{"enabled":true,"endpoint":"https://demo.r2.cloudflarestorage.com","bucket":"track3","region":"us-east-1","accessKeyId":"e2e-access","secretAccessKey":"e2e-secret"}'],
      }));
      await page.addInitScript(() => {
        const tauri = (window as any).__TAURI_INTERNALS__;
        const invoke = tauri.invoke;
        tauri.invoke = (command: string, args: unknown, options: unknown) =>
          command === "plugin:updater|check"
            ? Promise.resolve({ rid: 84, currentVersion: "0.9.5", version: "0.9.6", date: "2026-11-01", body: "## Theme fixes" })
            : invoke(command, args, options);
      });
      await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
      const locked = page.getByRole("dialog", { name: "Sync is locked" });
      await expect(locked).toBeVisible({ timeout: 120_000 });
      if (width >= 1400) {
        await expect(page.locator(".t3-sync-lock-scrim")).toHaveCSS("position", "fixed");
        expect(await page.evaluate(() => [
          [8, 8], [40, 240], [300, 30],
        ].map(([x, y]) => document.elementFromPoint(x, y)?.classList.contains("t3-sync-lock-scrim"))))
          .toEqual([true, true, true]);
      }
      const lockedContrast = await expectOverlayTheme(locked, locked.getByRole("button", { name: /^Unlock( sync)?$/ }));
      await expectFocusRing(locked.getByLabel("Sync passphrase"), width >= 1400 ? "Show passphrase" : "Unlock sync");
      await page.screenshot({ path: `${output}/desktop-${width}-${stored}-locked.png`, animations: "disabled" });
      if (stored === "system") {
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator("html")).toHaveClass(/dark/);
        await expectOverlayTheme(locked, locked.getByRole("button", { name: /^Unlock( sync)?$/ }));
        await page.screenshot({ path: `${output}/desktop-${width}-system-dark-locked.png`, animations: "disabled" });
        await page.emulateMedia({ colorScheme: "light" });
      }
      await page.keyboard.press("Escape");
      await expect(locked).toHaveCount(0);
      await page.getByRole("button", { name: "Sync locked - unlock sync" }).click();
      await locked.getByLabel("Sync passphrase").fill(passphrase);
      await locked.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
      await expect(locked).toHaveCount(0, { timeout: 60_000 });
      await page.locator(".desktop-sync-status-indicator button").first().click();
      const saveRecovery = page.getByRole("button", { name: "Save recovery file" });
      await expect(saveRecovery).toBeVisible({ timeout: 240_000 });
      await saveRecovery.click();
      const recovery = page.getByRole("dialog", { name: "Save your recovery file" });
      await expect(recovery).toBeVisible();
      const recoveryContrast = await expectOverlayTheme(recovery, recovery.getByRole("button", { name: "Export recovery file" }));
      await page.screenshot({ path: `${output}/desktop-${width}-${stored}-recovery.png`, animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(recovery).toHaveCount(0);

      const updateToast = page.locator(".t3-update-fidelity-toast").first();
      await expect(updateToast).toBeVisible({ timeout: 120_000 });
      await expectOverlayTheme(updateToast, undefined, "--radius", "--popover");
      await updateToast.getByRole("button", { name: "See what's new" }).click();
      const update = page.locator(".t3-update-fidelity-dialog");
      await expect(update).toBeVisible();
      const updateContrast = await expectOverlayTheme(update, update.getByRole("button", { name: "Download and install" }));
      await page.screenshot({ path: `${output}/desktop-${width}-${stored}-update.png`, animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(update).toHaveCount(0);
      await page.evaluate(async () => {
        const moduleUrl: string = "/src/components/ui/use-toast.ts";
        const { toast } = await import(moduleUrl);
        toast({ title: "Theme toast", tone: "success" });
      });
      const toast = page.locator(".desktop-toast-viewport .t3-fidelity-toast-success").first();
      await expect(toast).toBeVisible();
      await expectOverlayTheme(toast, undefined, "--radius", width >= 1400 ? "--popover" : "--raised");
      await page.screenshot({ path: `${output}/desktop-${width}-${stored}-toast.png`, animations: "disabled" });
      console.log(`desktop ${width} ${stored}: locked ${lockedContrast.textContrast.toFixed(2)}:1, recovery ${recoveryContrast.textContrast.toFixed(2)}:1, update ${updateContrast.textContrast.toFixed(2)}:1; actions ${lockedContrast.actionContrast?.toFixed(2)}, ${recoveryContrast.actionContrast?.toFixed(2)}, ${updateContrast.actionContrast?.toFixed(2)}:1`);
    } finally {
      await context.close();
    }
  });
}

for (const width of [390, 820]) for (const { stored, scheme } of themes) {
  test(`update dialog at ${width}px follows ${stored} with ${scheme} preference`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    test.setTimeout(300_000);
    mkdirSync(output, { recursive: true });
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1112 },
      colorScheme: scheme, reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), stored);
      await installTauriBridge(page, { fidelitySample: "full", appVersion: "0.9.5" });
      await page.addInitScript(() => {
        const tauri = (window as any).__TAURI_INTERNALS__;
        const invoke = tauri.invoke;
        tauri.invoke = (command: string, args: unknown, options: unknown) =>
          command === "plugin:updater|check"
            ? Promise.resolve({ rid: 84, currentVersion: "0.9.5", version: "0.9.6", date: "2026-11-01", body: "## Theme fixes" })
            : invoke(command, args, options);
      });
      await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
      const updateToast = page.locator(".t3-update-fidelity-toast");
      await expect(updateToast).toBeVisible({ timeout: 120_000 });
      await updateToast.getByRole("button", { name: "See what's new" }).click();
      const update = page.locator(".t3-update-fidelity-dialog");
      await expect(update).toBeVisible();
      await expectOverlayTheme(update, update.getByRole("button", { name: "Download and install" }));
      await page.screenshot({ path: `${output}/update-${width}-${stored}.png`, animations: "disabled" });
      if (stored === "system") {
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator("html")).toHaveClass(/dark/);
        await expectOverlayTheme(update, update.getByRole("button", { name: "Download and install" }));
      }
      await page.keyboard.press("Escape");
      await expect(update).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

for (const theme of ["light", "dark"]) test(`desktop ${theme} coin detail has readable page controls`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/coins/BTC");
  const card = page.locator(".coin-fidelity-card").first();
  await expect(card).toBeVisible();
  if (theme === "light") await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const colors = await page.locator(".coin-fidelity").evaluate((root) => {
    const title = root.querySelector(".coin-fidelity-heading h1")!;
    const button = root.querySelector(".coin-fidelity-heading > button")!;
    const card = root.querySelector(".coin-fidelity-card")!;
    return {
      title: getComputedStyle(title).color,
      button: getComputedStyle(button).color,
      card: getComputedStyle(card).backgroundColor,
    };
  });
  expect(contrast(colors.title, colors.card)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.button, colors.card)).toBeGreaterThanOrEqual(4.5);
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/desktop-${theme}-coin.png`, animations: "disabled" });
});
