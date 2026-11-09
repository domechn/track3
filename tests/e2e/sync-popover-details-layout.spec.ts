import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

async function openFixture(page: Page, width: number, height: number, theme: "light" | "dark", issues = false) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("track3-ui-theme", selectedTheme);
    localStorage.setItem("track3-ui-locale", "en");
  }, theme);
  await installTauriBridge(page, { seedLockedSync: true });
  await page.goto("/#/overview");
  await expect(page.locator("#app-main-content")).toContainText("$42,000.00", { timeout: 30_000 });
  await page.getByRole("button", { name: width <= 560 ? "Continue without sync" : "Skip for now" }).click();
  await page.evaluate(async (hasIssues) => {
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
      phase: hasIssues ? "error" : "idle", error: hasIssues ? "sync" : undefined,
      lastSync: Date.parse("2026-10-28T12:00:00Z"),
      report: { pulled: 2, pushed: 1, tombstonesApplied: 0, configChanges: 0,
        conflicts: hasIssues ? ["10", "snapshot:2a8e338b-8888-4444-aaaa-888888888888", "edit:76193a5b-8888-4444-aaaa-888888888888"] : [],
        errors: hasIssues ? ["Failed to read sync manifest", "Failed to read sync manifest", "Failed to pull snapshot object"] : [],
        devices: [{ id: "device-1", name: "This device" }] },
      diagnostics: { wallMs: 5040, phases, requests, retries: 2, retryWaitMs: 560,
        timeouts: 1, syncStateBytes: 18_422_103, snapshots: 5000, entries: 5245,
        knownTokens: 5200, slowest: [{ verb: "GET", phase: "pull", ms: 3200 }] },
    });
  }, issues);
  await page.locator(".t3-topbar-sync-button").click();
  const popover = page.locator(".t3-sync-popover");
  await expect(popover).toBeVisible();
  return popover;
}

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [[1280, 720], [1100, 640]] as const) {
    test(`Backup & sync Details fit and scroll at ${width}x${height} ${theme}`, async ({ page }) => {
      mkdirSync(".local/sync-details-again", { recursive: true });
      const popover = await openFixture(page, width, height, theme);
      const toggle = popover.getByRole("button", { name: "Details" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({ path: `.local/sync-details-again/${width}-${theme}-collapsed.png`, animations: "disabled" });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const box = (await popover.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y).toBeGreaterThanOrEqual(12);
      expect(box.y + box.height).toBeLessThanOrEqual(height + (width <= 560 ? 1 : -12));
      expect(box.height).toBeLessThanOrEqual(Math.min(height * .85, 760) + 1);
      if (width <= 560) {
        expect(Math.abs(box.y + box.height - height)).toBeLessThanOrEqual(1);
      }
      const details = popover.locator(".t3-sync-details");
      const statusRow = popover.locator(".t3-sync-fidelity > dl > div").first();
      if (await statusRow.count()) {
        const a = (await statusRow.boundingBox())!;
        const b = (await details.boundingBox())!;
        expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.x + a.width - b.x - b.width)).toBeLessThanOrEqual(1);
      }
      const rows = await details.locator(".t3-sync-details-section").filter({
        has: page.getByRole("heading", { name: "Phase timings" }),
      }).locator(".t3-sync-definition-row").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        const label = node.querySelector("dt")!.getBoundingClientRect();
        const value = node.querySelector("dd")!.getBoundingClientRect();
        return { y: box.y, height: box.height, divider: getComputedStyle(node).borderTopWidth,
          overlap: label.right > value.left };
      }));
      expect(rows).toHaveLength(11);
      for (let i = 0; i < rows.length; i++) {
        expect(Math.abs(rows[i].height - 32)).toBeLessThanOrEqual(1);
        expect(rows[i].overlap).toBe(false);
        if (i) {
          expect(Math.abs(rows[i].y - rows[i - 1].y - 32)).toBeLessThanOrEqual(1);
          expect(rows[i].divider).toBe("1px");
        }
      }
      const colours = await details.evaluate((node) => {
        const link = getComputedStyle(node.querySelector(".t3-sync-details-toggle")!).color;
        return [...node.querySelectorAll(".t3-sync-details-section h3, .t3-sync-definition-row dt, .t3-sync-definition-row dd")]
          .map((item) => ({ text: item.textContent, color: getComputedStyle(item).color, link }));
      });
      expect(colours.length).toBeGreaterThan(0);
      for (const item of colours) expect(item.color, item.text ?? "").not.toBe(item.link);
      const body = popover.locator(".t3-sync-popover-body");
      expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      await expect(popover.locator(".t3-sync-scroll-frame")).toHaveAttribute("data-more-below", "true");
      await expect(popover.locator(".t3-sync-scroll-rail")).toBeVisible();
      const fit = await popover.evaluate((node) => {
        const body = node.querySelector(".t3-sync-popover-body")!;
        const railLeft = node.querySelector(".t3-sync-scroll-rail")!.getBoundingClientRect().left;
        const values = [...node.querySelectorAll("dd")].map((value) => ({
          text: value.textContent ?? "",
          right: value.getBoundingClientRect().right,
          clipped: value.scrollWidth > value.clientWidth + 1,
        }));
        return { overflow: body.scrollWidth > body.clientWidth + 1, railLeft, values };
      });
      expect(fit.overflow).toBe(false);
      expect(fit.values.length).toBeGreaterThan(11);
      for (const value of fit.values) {
        expect(value.right, value.text).toBeLessThanOrEqual(fit.railLeft - 8);
        expect(value.clipped, value.text).toBe(false);
      }
      await page.screenshot({ path: `.local/sync-details-again/${width}-${theme}-expanded.png`, animations: "disabled" });
      const header = popover.locator(".t3-sync-fidelity > header");
      const headerY = await header.boundingBox().then((value) => value?.y);
      await body.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await expect(details.locator(".t3-sync-details-note")).toBeInViewport();
      expect(await header.boundingBox().then((value) => value?.y)).toBe(headerY);
      await page.screenshot({ path: `.local/sync-details-again/${width}-${theme}-requests.png`, animations: "disabled" });
    });
  }
  test(`Backup & sync issue badge and Requests remain reachable ${theme}`, async ({ page }) => {
    const popover = await openFixture(page, 1280, 720, theme, true);
    const toggle = popover.getByRole("button", { name: "Details, 6 issues" });
    await expect(toggle).toContainText("6");
    await toggle.click();
    await expect(popover.getByRole("heading", { name: "Errors" })).toBeVisible();
    await expect(popover.getByRole("heading", { name: "Conflicts" })).toBeVisible();
    await popover.locator(".t3-sync-popover-body").evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await expect(popover.locator(".t3-sync-details-note")).toBeInViewport();
  });
}
