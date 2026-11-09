import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const theme of ["light", "dark"] as const) {
  test(`phone sync Details stay inside the sheet ${theme}`, async ({ page }) => {
    mkdirSync(".local/sync-details-again", { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("track3-ui-theme", selectedTheme);
      localStorage.setItem("track3-ui-locale", "en");
    }, theme);
    await installTauriBridge(page, { seedLockedSync: true });
    await page.goto("/#/overview");
    await expect(page.locator("#app-main-content")).toContainText("$42,000.00", { timeout: 30_000 });
    await page.getByRole("button", { name: "Continue without sync" }).click();
    await page.evaluate(async () => {
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
        phase: "error", error: "sync", lastSync: Date.parse("2026-10-28T12:00:00Z"),
        report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0,
          conflicts: ["10", "snapshot:2a8e338b-8888-4444-aaaa-888888888888", "edit:76193a5b-8888-4444-aaaa-888888888888"],
          errors: ["Failed to read sync manifest", "Failed to read sync manifest", "Failed to pull snapshot object"] },
        diagnostics: { wallMs: 5040, phases, requests, retries: 2, retryWaitMs: 560,
          timeouts: 1, syncStateBytes: 18_422_103, snapshots: 5000, entries: 5245,
          knownTokens: 5200, slowest: [{ verb: "GET", phase: "pull", ms: 3200 }] },
      });
    });
    await page.locator(".t3-topbar-sync-button").click();
    const popover = page.locator(".t3-sync-popover");
    await expect(popover).toBeVisible();
    const toggle = popover.getByRole("button", { name: "Details, 6 issues" });
    await page.screenshot({ path: `.local/sync-details-again/phone-${theme}-collapsed.png`, animations: "disabled" });
    await toggle.click();
    const box = (await popover.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    expect(box.y).toBeGreaterThanOrEqual(12);
    expect(Math.abs(box.y + box.height - 844)).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(844 * .85 + 1);
    const details = popover.locator(".t3-sync-details");
    const rows = await details.locator(".t3-sync-definition-row").evaluateAll((nodes) => nodes.map((node) => {
      const label = node.querySelector("dt")!;
      const value = node.querySelector("dd")!;
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right,
        overlap: label.getBoundingClientRect().right > value.getBoundingClientRect().left,
        clipped: label.scrollWidth > label.clientWidth + 1 || value.scrollWidth > value.clientWidth + 1 };
    }));
    expect(rows.length).toBeGreaterThan(11);
    for (const row of rows) {
      expect(row.left).toBeGreaterThanOrEqual(12);
      expect(row.right).toBeLessThanOrEqual(378);
      expect(row.overlap).toBe(false);
      expect(row.clipped).toBe(false);
    }
    expect(await popover.locator(".t3-sync-popover-body").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(popover.locator(".t3-sync-scroll-rail")).toBeVisible();
    await page.screenshot({ path: `.local/sync-details-again/phone-${theme}-expanded.png`, animations: "disabled" });
    await popover.locator(".t3-sync-popover-body").evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(details.locator(".t3-sync-details-note")).toBeInViewport();
    await page.screenshot({ path: `.local/sync-details-again/phone-${theme}-requests.png`, animations: "disabled" });
  });
}
