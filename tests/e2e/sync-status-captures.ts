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
    const { syncRuntime } = await import("/src/middlelayers/sync/runtime.ts");
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
    { name: "error", phase: "error", pill: pill[locale].error, sync: { phase: "error", error: "bucket", lastSync: Date.parse("2026-10-28T12:00:00Z") } },
    { name: "up-to-date", phase: "idle", pill: pill[locale].idle, sync: { phase: "idle", report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }, lastSync: Date.parse("2026-10-28T12:00:00Z") } },
    { name: "changed", phase: "idle", pill: pill[locale].idle, sync: { phase: "idle", report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }, lastSync: Date.parse("2026-10-28T12:00:00Z") } },
  ];
  for (const item of cases) {
    await publish(page, item.sync);
    await button(item.pill).click();
    await capture(item.name);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
}
