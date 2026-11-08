import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function openPop(page: Page, width: number, height: number, theme: "light" | "dark", mobile = false, withIssues = false) {
  mkdirSync(".local/sync-details", { recursive: true });
  await page.setViewportSize({ width, height });
  await page.addInitScript((theme) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", "en");
  }, theme);
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  await expect(page.locator("#app-main-content")).toContainText("$42,000.00", { timeout: 30_000 });
  await page.getByRole("button", { name: mobile || width >= 1400 ? "Continue without sync" : "Skip for now" }).click();
  await page.evaluate(async (withIssues) => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(/* @vite-ignore */ runtimeModule);
    const phases = Object.fromEntries([
      "headerRead", "keyDerivation", "discover", "manifestsDownload", "pull",
      "localScan", "stateSave", "push", "manifestWrite", "prune",
    ].map((phase, index) => [phase, 100 + index * 500]));
    const outcomes = Object.fromEntries([
      "ok", "notModified", "notFound", "preconditionFailed", "conflict",
      "rateLimited", "serverError", "timeout", "retry", "otherError",
    ].map((outcome) => [outcome, { count: 0, bytesSent: 0, bytesReceived: 0 }]));
    const requests = Object.fromEntries(["GET", "PUT", "LIST", "DELETE", "HEAD"].map((verb) =>
      [verb, { count: verb === "GET" ? 1234 : 6, bytesSent: verb === "PUT" ? 12_500 : 0,
        bytesReceived: verb === "GET" ? 1_200_000 : 0, outcomes: structuredClone(outcomes) }]));
    (syncRuntime as any).publish("ready", {
      phase: withIssues ? "error" : "idle", error: withIssues ? "sync" : undefined,
      lastSync: Date.parse("2026-10-28T12:00:00Z"),
      report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0,
        conflicts: withIssues ? ["10", "snapshot:2a8e338b-8888-4444-aaaa-888888888888", "edit:76193a5b-8888-4444-aaaa-888888888888"] : [],
        errors: withIssues ? ["Failed to read sync manifest", "Failed to read sync manifest", "Failed to pull snapshot object"] : [],
        devices: [{ id: "device-1", name: "This device" }] },
      diagnostics: { wallMs: 5040, phases, requests, retries: 2, retryWaitMs: 560,
        timeouts: 1, syncStateBytes: 18_422_103, snapshots: 5000, entries: 5245,
        knownTokens: 5200, slowest: [{ verb: "GET", phase: "pull", ms: 3200 }] },
    });
  }, withIssues);
  await page.locator(".t3-topbar-sync-button").click();
  const popover = page.locator(".t3-sync-popover");
  await expect(popover).toBeVisible();
  await popover.locator(".t3-sync-details-toggle").first().click();
  await popover.evaluate((node) => { node.scrollTop = 0; });
  return popover;
}

export async function checkTextContrast(popover: ReturnType<Page["locator"]>) {
  const values = await popover.evaluate((node) => {
    const background = getComputedStyle(node).backgroundColor;
    const root = node.querySelector(".t3-sync-details")!;
    const link = getComputedStyle(root.querySelector(".t3-sync-details-toggle")!).color;
    const elements = root.querySelectorAll(".t3-sync-details-section h3, .t3-sync-definition-row dt, .t3-sync-definition-row dd");
    const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    const luminance = (color: string) => {
      const [r, g, b] = channels(color);
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    };
    return [...elements].map((element) => {
      const color = getComputedStyle(element).color;
      return { tag: element.tagName, text: element.textContent, link, color, ratio: contrast(color, background) };
    });
  });
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value.color, value.text ?? "").not.toBe(value.link);
    expect(value.ratio, value.text ?? "").toBeGreaterThanOrEqual(4.5);
  }
}
