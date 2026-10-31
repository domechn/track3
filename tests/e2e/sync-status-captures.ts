import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

type Theme = "light" | "dark";
type Locale = "en" | "zh";
type Platform = "desktop" | "mobile";

const pill = {
  en: { locked: "Sync locked", skipped: "Sync locked — tap to unlock", idle: "Sync idle", syncing: "Syncing", error: "Sync error" },
  zh: { locked: "同步已锁定", skipped: "同步已锁定，点按以解锁", idle: "同步空闲", syncing: "正在同步", error: "同步错误" },
};
const skip = { en: "Skip for now", zh: "暂时跳过" };

async function publish(page: Page, sync: Record<string, unknown>) {
  await page.evaluate(async (sync) => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(runtimeModule);
    (syncRuntime as any).publish("ready", sync);
  }, sync);
}

export async function captureSyncStates(page: Page, platform: Platform, theme: Theme, locale: Locale) {
  mkdirSync(".local/sync-status", { recursive: true });
  await page.setViewportSize({ width: platform === "mobile" ? 390 : 1280, height: platform === "mobile" ? 844 : 800 });
  await page.addInitScript(({ theme, locale }) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", locale);
  }, { theme, locale });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
  await expect(page.locator("#app-main-content")).toContainText("$42,000.00");
  const button = (name: string) => page.getByRole("button", { name });
  const capture = async (state: string) => {
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: `.local/sync-status/${platform}-${theme}-${locale}-${state}.png`, animations: "disabled" });
  };
  await expect(button(pill[locale].locked)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture("locked");
  await button(skip[locale]).click();
  await expect(button(pill[locale].skipped)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: `.local/sync-status/${platform}-${theme}-${locale}-skipped.png`, animations: "disabled" });

  const cases = [
    { name: "never", phase: "idle", pill: pill[locale].idle, sync: { phase: "idle" } },
    { name: "running", phase: "syncing", pill: pill[locale].syncing, sync: { phase: "syncing", startedAt: Date.now() - 5000 } },
    { name: "uploading", phase: "syncing", pill: pill[locale].syncing, sync: {
      phase: "syncing", startedAt: Date.now() - 5000, progress: { phase: "push", completed: 1240, total: 4567 },
    } },
    { name: "downloading", phase: "syncing", pill: pill[locale].syncing, sync: {
      phase: "syncing", startedAt: Date.now() - 5000, progress: { phase: "pull", completed: 82, total: 400 },
    } },
    { name: "error", phase: "error", pill: pill[locale].error, sync: { phase: "error", error: "bucket", lastSync: Date.parse("2026-10-28T12:00:00Z") } },
    { name: "up-to-date", phase: "idle", pill: pill[locale].idle, sync: { phase: "idle", report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }, lastSync: Date.parse("2026-10-28T12:00:00Z") } },
    { name: "changed", phase: "idle", pill: pill[locale].idle, sync: { phase: "idle", report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }, lastSync: Date.parse("2026-10-28T12:00:00Z") } },
  ];
  for (const item of cases) {
    await publish(page, item.sync);
    await button(item.pill).click();
    if (item.name === "uploading" || item.name === "downloading") {
      await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow",
        item.name === "uploading" ? "1240" : "82");
      await expect(page.getByRole("dialog")).toContainText(item.name === "uploading"
        ? locale === "en" ? "Uploading 1,240 / 4,567" : "正在上传 1,240 / 4,567"
        : locale === "en" ? "Downloading 82 / 400" : "正在下载 82 / 400");
    }
    await capture(item.name);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  if (platform === "mobile") {
    await page.setViewportSize({ width: 320, height: 700 });
    await publish(page, { phase: "syncing", startedAt: Date.now() - 5000,
      progress: { phase: "push", completed: 1240, total: 4567 } });
    await button(pill[locale].syncing).click();
    const box = (await page.getByRole("dialog").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await capture("uploading-320");
  }
}

export async function captureSyncStatusWithToast(page: Page, platform: Platform) {
  const mobile = platform === "mobile";
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: mobile ? 844 : 800 });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await publish(page, { phase: "error", error: "bucket" });
  await page.evaluate(async (mobile) => {
    const { toast } = await import(/* @vite-ignore */ (mobile
      ? "/src/mobile/components/ui/use-toast.ts" : "/src/components/ui/use-toast.ts"));
    toast({ title: "Sync failed", description: "The sync store did not finish the request.",
      variant: "destructive", syncStatus: "error", duration: 8000 });
  }, mobile);
  const toast = page.locator(mobile ? ".ios-d3-toast-viewport .sync-toast" : ".desktop-toast-viewport .sync-toast");
  const pill = page.locator(mobile ? ".ios-d3-sync-indicator button[aria-label]" : ".desktop-sync-status-indicator button[aria-label]");
  await expect(toast).toBeVisible();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute("aria-label", "Sync error");
  const toastBox = (await toast.boundingBox())!;
  const pillBox = (await pill.boundingBox())!;
  expect(pillBox.x < toastBox.x + toastBox.width && pillBox.x + pillBox.width > toastBox.x &&
    pillBox.y < toastBox.y + toastBox.height && pillBox.y + pillBox.height > toastBox.y).toBe(false);
  if (!mobile) {
    for (const name of ["Expand sidebar", "Collapse sidebar"]) {
      const currentPill = (await pill.boundingBox())!;
      const collapse = (await page.getByRole("button", { name }).boundingBox())!;
      expect(currentPill.x < collapse.x + collapse.width && currentPill.x + currentPill.width > collapse.x &&
        currentPill.y < collapse.y + collapse.height && currentPill.y + currentPill.height > collapse.y).toBe(false);
      await page.getByRole("button", { name }).click();
    }
  }
  mkdirSync(".local/sync-status", { recursive: true });
  await page.screenshot({ path: `.local/sync-status/${platform}-pill-toast-${mobile ? 390 : 1280}.png`, animations: "disabled" });
}
