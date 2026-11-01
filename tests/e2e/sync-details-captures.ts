import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function captureSyncDetails(page: Page, platform: "desktop" | "mobile",
  theme: "light" | "dark", locale: "en" | "zh", width: 1280 | 390 | 320) {
  const height = width === 1280 ? 900 : width === 390 ? 844 : 700;
  const output = ".local/sync-details";
  mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ theme, locale }) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", locale);
  }, { theme, locale });
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  await expect(page.locator("#app-main-content")).toContainText("$42,000.00");
  await page.getByRole("button", { name: locale === "en" ? "Skip for now" : "暂时跳过" }).click();
  await page.evaluate(async () => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(/* @vite-ignore */ runtimeModule);
    (syncRuntime as any).configConflicts = async () => [{ id: "10" }];
    const phases = Object.fromEntries([
      "headerRead", "keyDerivation", "discover", "manifestsDownload", "pull", "localScan",
      "stateSave", "push", "manifestWrite", "prune",
    ].map((phase, index) => [phase, [84, 1280, 2450, 1380, 750, 4100, 900, 3120, 870, 180][index]]));
    const outcomes = Object.fromEntries([
      "ok", "notModified", "notFound", "preconditionFailed", "conflict",
      "rateLimited", "serverError", "timeout", "retry", "otherError",
    ].map((outcome) => [outcome, { count: 0, bytesSent: 0, bytesReceived: 0 }]));
    const requests = Object.fromEntries(["GET", "PUT", "LIST", "DELETE", "HEAD"].map((verb) =>
      [verb, { count: verb === "GET" ? 12 : verb === "PUT" ? 6 : 2,
        bytesSent: verb === "PUT" ? 200_000 : 0, bytesReceived: verb === "GET" ? 1_200_000 : 350_000,
        outcomes: structuredClone(outcomes) }]));
    (syncRuntime as any).publish("ready", {
      phase: "error", error: "sync", lastSync: Date.parse("2026-10-28T12:00:00Z"),
      report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0,
        conflicts: ["10", "snapshot:2a8e338b-8888-4444-aaaa-888888888888", "edit:76193a5b-8888-4444-aaaa-888888888888"],
        errors: ["Failed to read sync manifest", "Failed to read sync manifest", "Failed to pull snapshot object"] },
      diagnostics: { wallMs: 14_924, phases, requests, retries: 2, retryWaitMs: 560,
        timeouts: 1, syncStateBytes: 18_422_103, snapshots: 5_000, entries: 5_245, knownTokens: 5_200,
        slowest: [{ verb: "GET", phase: "pull", ms: 3200 }, { verb: "LIST", phase: "discover", ms: 2450 }] },
    });
  });
  await page.getByRole("button", { name: locale === "en" ? "Sync error" : "同步错误" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("summary").filter({ hasText: locale === "en" ? "Details" : "详细信息" }).click();
  await expect(dialog).toContainText(locale === "en" ? "Phase timings" : "阶段耗时");
  await page.screenshot({ path: `${output}/${platform}-${width}-${theme}-${locale}-top.png`, animations: "disabled" });
  await dialog.locator("table").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/${platform}-${width}-${theme}-${locale}-timings.png`, animations: "disabled" });
  await dialog.getByRole("button", { name: locale === "en" ? "Copy diagnostics" : "复制诊断信息" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/${platform}-${width}-${theme}-${locale}-requests.png`, animations: "disabled" });
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  await dialog.getByRole("button", { name: locale === "en" ? "Use this device's value" : "使用本设备的值" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(locale === "en" ? "overwrite the other side" : "覆盖另一端");
  await page.getByRole("button", { name: locale === "en" ? "Cancel" : "取消" }).click();
}
