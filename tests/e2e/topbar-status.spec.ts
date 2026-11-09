import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/track3-topbar-status";
test.describe.configure({ mode: "parallel" });

test("non-Pro Overview keeps Source status clear of Refresh", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "binance", label: "Binance", kind: "exchange", provider: "Binance", status: "ok",
        lastSuccessAt: "2026-10-31T09:41:00.000Z" },
    ])));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "DELETE FROM configuration WHERE id = 997", values: [] }));
    await page.goto("/#/overview");
    await expect(page.locator(".t3-overview-grid")).toBeVisible();
    await expect(page.locator(".t3-live-trigger")).toHaveCount(0);
    const source = page.locator(".t3-refresh-source-trigger");
    await expect(source).toBeVisible();
    const refresh = page.locator(".t3-refresh-button");
    const [sourceBox, refreshBox] = await Promise.all([source.boundingBox(), refresh.boundingBox()]);
    expect(sourceBox!.x).toBeGreaterThanOrEqual(refreshBox!.x + refreshBox!.width);
    await expect(source).not.toHaveCSS("position", "fixed");
    expect(await refresh.evaluate((button) => {
      const icon = button.querySelector("svg")!.getBoundingClientRect();
      return button.contains(document.elementFromPoint(icon.x + icon.width / 2, icon.y + icon.height / 2));
    })).toBe(true);
  } finally {
    await context.close();
  }
});

test("first refresh keeps Source status clear when no results are stored", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/overview");
    await expect(page.locator(".t3-overview-grid")).toBeVisible();
    await expect(page.locator(".t3-refresh-source-trigger")).toHaveCount(0);
    await page.locator(".t3-refresh-button").click();
    const source = page.locator(".t3-refresh-source-trigger");
    await expect(source).toBeVisible();
    const refresh = page.locator(".t3-refresh-button");
    const [sourceBox, refreshBox] = await Promise.all([source.boundingBox(), refresh.boundingBox()]);
    expect(sourceBox!.x).toBeGreaterThanOrEqual(refreshBox!.x + refreshBox!.width);
    await expect(source).not.toHaveCSS("position", "fixed");
  } finally {
    await context.close();
  }
});

for (const configured of [false, true]) {
  for (const theme of ["dark", "light"] as const) {
  test(`desktop Overview status controls ${configured ? "configured" : "unconfigured"} ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop");
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme,
      reducedMotion: "reduce", timezoneId: "UTC" });
    const page = await context.newPage();
    try {
      const s3 = configured ? new FakeS3() : undefined;
      if (s3) {
        const { header } = await createSyncHeader("fixture sync passphrase");
        await writeSyncHeader(s3, header);
      }
      await page.clock.setFixedTime(new Date("2026-10-31T09:43:00Z"));
      await page.addInitScript((savedTheme) => {
        localStorage.setItem("track3-ui-theme", savedTheme);
        localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
          { sourceId: "binance", label: "Binance", kind: "exchange", provider: "Binance",
            status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
        ]));
      }, theme);
      await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: configured, s3 });
      await page.goto("/#/overview");
      await page.reload();
      if (configured) {
        await page.getByLabel("Sync passphrase").fill("fixture sync passphrase");
        await page.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
      }
      await expect(page.locator(".t3-overview-grid")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".t3-live-trigger")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      await page.locator(".t3-live-trigger").click();
      await expect(page.locator(".t3-live-dot")).toHaveAttribute("data-state", "live", { timeout: 30_000 });
      await expect(page.locator(".t3-live-popover")).toContainText("Live prices: connected");
      await page.mouse.click(450, 70);
      await expect(page.locator(".t3-live-popover")).toHaveCount(0);
      await expect(page.locator(".t3-hero-value")).toBeVisible();
      if (configured) {
        await page.evaluate(async () => {
          const runtimeModule = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          await (syncRuntime as any).scheduler?.stop();
          (syncRuntime as any).publish("ready", { phase: "idle", lastSync: Date.now() - 120_000,
            report: { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] } });
        });
        await expect(page.locator(".t3-topbar-sync-button")).toHaveAttribute("data-sync-state", "synced");
      }
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/desktop-${theme}-${configured ? "configured" : "unconfigured"}.png`,
        clip: { x: 0, y: 0, width: 1280, height: 70 } });
      await expect(page.locator(".t3-live-trigger .t3-live-dot")).toHaveCount(1);
      await expect(page.locator(".t3-live-dot")).toHaveAttribute("title", "Live prices: connected");
      await expect(page.locator(".t3-refresh-source-trigger .t3-refresh-source-icon")).toBeVisible();
      await expect(page.locator(".t3-refresh-source-trigger")).toHaveAttribute("title", "Source status");
      expect(await page.locator(".t3-refresh-source-trigger").evaluate((el) => getComputedStyle(el, "::after").content)).toBe("none");
      const dotBox = (await page.locator(".t3-live-dot").boundingBox())!;
      const sourceBox = (await page.locator(".t3-refresh-source-trigger .t3-refresh-source-icon").boundingBox())!;
      await expect(page.locator(".t3-refresh-source-trigger")).toHaveCSS("position", "fixed");
      expect(sourceBox.x - dotBox.x - dotBox.width).toBeGreaterThanOrEqual(12);
      expect(Math.abs(sourceBox.y + sourceBox.height / 2 - dotBox.y - dotBox.height / 2)).toBeLessThanOrEqual(2);
      const amount = page.locator(".t3-live-amount");
      const originalAmount = await amount.textContent();
      await amount.evaluate((node) => { node.textContent = "¥1,234,567,890.12"; });
      await expect.poll(async () => {
        const trigger = (await page.locator(".t3-live-trigger").boundingBox())!;
        const source = (await page.locator(".t3-refresh-source-trigger").boundingBox())!;
        return source.x - trigger.x - trigger.width;
      }).toBeGreaterThanOrEqual(12);
      await amount.evaluate((node, value) => { node.textContent = value; }, originalAmount);
      if (theme === "dark" && !configured) {
        await page.getByRole("button", { name: "Expand sidebar" }).click();
        await expect.poll(async () => (await page.locator(".t3-live-trigger").boundingBox())!.x).toBeGreaterThan(243);
        const expandedLive = (await page.locator(".t3-live-trigger").boundingBox())!;
        const expandedSource = (await page.locator(".t3-refresh-source-trigger").boundingBox())!;
        expect(expandedSource.x - expandedLive.x - expandedLive.width).toBeGreaterThanOrEqual(12);
      }
      if (configured) {
        const sync = page.locator(".desktop-sync-status-indicator .t3-topbar-sync-button");
        await expect(sync.locator("svg[data-icon='check']")).toBeVisible();
        await expect(sync.locator("svg[data-icon='check']")).toHaveCSS("width", "16px");
        await expect(sync).toHaveAttribute("title", "Synced 2 min ago");
        const syncBox = (await sync.locator("svg").boundingBox())!;
        expect(syncBox.x - dotBox.x - dotBox.width).toBeGreaterThanOrEqual(12);
        expect(syncBox.x - sourceBox.x - sourceBox.width).toBeGreaterThanOrEqual(12);
      } else {
        await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(0);
      }
      if (theme === "dark" && !configured) {
        for (const [state, label] of [
          ["connecting", "Live prices: connecting"],
          ["live", "Live prices: connected"],
          ["stale", "Live prices: waiting for an update"],
          ["error", "Live prices: unavailable"],
        ] as const) {
          await page.locator(".t3-live-dot").evaluate((node, next) => {
            node.setAttribute("data-state", next.state);
            node.setAttribute("aria-label", next.label);
            node.setAttribute("title", next.label);
          }, { state, label });
          await page.locator(".glass-subtle").screenshot({ path: `${output}/desktop-live-${state}.png` });
        }
        const amount = page.locator(".t3-live-amount");
        await amount.evaluate((node) => { node.textContent = ""; });
        const emptyBox = (await amount.boundingBox())!;
        const emptyDot = (await page.locator(".t3-live-dot").boundingBox())!;
        expect(emptyDot.x - emptyBox.x - emptyBox.width).toBeGreaterThanOrEqual(0);
        expect(emptyDot.x - emptyBox.x - emptyBox.width).toBeLessThanOrEqual(8);
        await expect(page.locator(".t3-live-dot")).toHaveCSS("transform", "none");
        await page.locator(".glass-subtle").screenshot({ path: `${output}/desktop-live-empty.png` });
        await amount.evaluate((node) => { node.innerHTML = '<span class="t3-live-skeleton"></span>'; });
        await page.locator(".t3-live-dot").evaluate((node) => { node.setAttribute("data-state", "connecting"); });
        await page.locator(".glass-subtle").screenshot({ path: `${output}/desktop-live-skeleton.png` });
      }
      if (theme === "dark" && configured) {
        for (const [name, mode, syncStatus, icon] of [
          ["synced", "ready", { phase: "idle", lastSync: Date.parse("2026-10-31T09:41:00Z") }, "check"],
          ["syncing", "ready", { phase: "syncing", startedAt: Date.now() }, "sync"],
          ["error", "ready", { phase: "error", error: "network" }, "alert"],
          ["off", "disabled", { phase: "idle" }, "off"],
        ] as const) {
          await page.evaluate(async ({ mode, syncStatus }) => {
            const runtimeModule = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModule);
            (syncRuntime as any).publish(mode, syncStatus);
          }, { mode, syncStatus });
          await expect(page.locator(".t3-topbar-sync-button")).toHaveAttribute("data-sync-state", name);
          await expect(page.locator(`.t3-topbar-sync-button svg[data-icon='${icon}']`)).toBeVisible();
          await page.locator(".glass-subtle").screenshot({ path: `${output}/desktop-sync-${name}.png` });
        }
        await page.evaluate(async () => {
          const runtimeModule = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          (syncRuntime as any).publish("ready", { phase: "idle", lastSync: Date.now() - 120_000 });
        });
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
        await expect(page.locator(".t3-topbar-sync-button")).toHaveAttribute("data-sync-state", "offline");
        await page.locator(".glass-subtle").screenshot({ path: `${output}/desktop-sync-offline.png` });
        await context.setOffline(false);
        await page.evaluate(async () => {
          const runtimeModule = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          (syncRuntime as any).publish("disabled", { phase: "idle" });
        });
        await page.locator(".t3-topbar-sync-button").click();
        await expect(page).toHaveURL(/#\/settings\/sync$/);
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });
  }
}
