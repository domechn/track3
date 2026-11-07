import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/track3-topbar-status";
const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
test.describe.configure({ mode: "parallel" });

test("configured 320px header keeps the live dot inside its reading", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 740 }, userAgent, isMobile: true, hasTouch: true,
    reducedMotion: "reduce", timezoneId: "UTC",
  });
  const page = await context.newPage();
  try {
    const s3 = new FakeS3();
    const { header } = await createSyncHeader("fixture sync passphrase");
    await writeSyncHeader(s3, header);
    await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: true, s3 });
    await page.goto("/#/overview");
    await page.reload();
    await page.getByLabel("Sync passphrase").fill("fixture sync passphrase");
    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(page.locator(".fd-overview-hero .fd-overview-value")).toHaveText("$763,809.27", { timeout: 30_000 });
    await expect(page.locator("#app-top-bar .t3-topbar-sync-button")).toBeVisible();
    const reading = page.locator("#app-top-bar .mobile-header-total-reading");
    await expect(reading.locator(".mobile-header-total-value")).toHaveText("$763,809.27");
    const dot = reading.locator(".mobile-header-live-dot");
    await expect(dot).toHaveCount(1);
    const rowBox = (await reading.boundingBox())!;
    const dotBox = (await dot.boundingBox())!;
    expect(dotBox.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(dotBox.x + dotBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    const amount = reading.locator(".mobile-header-total-value");
    await amount.evaluate((node) => { node.textContent = "¥1,234,567,890.12"; node.setAttribute("data-long", ""); });
    expect(await amount.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
    const longDotBox = (await dot.boundingBox())!;
    expect(longDotBox.x + longDotBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: `${output}/phone-320-long-configured.png`,
      clip: { x: 0, y: 0, width: 320, height: 80 } });
  } finally {
    await context.close();
  }
});

for (const configured of [false, true]) {
  for (const theme of ["dark", "light"] as const) {
    test(`phone Overview status controls ${configured ? "configured" : "unconfigured"} ${theme}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, userAgent, isMobile: true, hasTouch: true,
        colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC",
      });
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
          await page.getByRole("button", { name: "Unlock", exact: true }).click();
        }
        await expect(page.locator(".fd-overview-hero .fd-overview-value")).toHaveText("$763,809.27", { timeout: 30_000 });
        await expect(page.locator(".fd-overview-hero")).toBeVisible();
        const header = page.locator("#app-top-bar");
        const dot = header.locator(".t3-live-dot");
        await expect(header.locator(".mobile-header-total")).toBeVisible();
        await expect(dot).toHaveCount(1);
        await expect(dot).toBeVisible();
        await expect(dot).toHaveAttribute("title", /Live prices:/);
        const priceLabel = await dot.getAttribute("title");
        await header.locator(".mobile-header-total-reading").click();
        await expect(page.getByRole("dialog", { name: priceLabel! })).toBeVisible();
        await page.keyboard.press("Escape");
        await header.locator(".mobile-header-total-reading").evaluate((node) => (node as HTMLElement).blur());
        const longAmount = header.locator(".mobile-header-total-value");
        const savedAmount = await longAmount.textContent();
        await longAmount.evaluate((node) => { node.textContent = "¥1,234,567,890.12"; node.setAttribute("data-long", ""); });
        expect(await longAmount.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
        if (!configured) {
          await page.setViewportSize({ width: 375, height: 844 });
          expect(await longAmount.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
          if (theme === "dark") {
            mkdirSync(output, { recursive: true });
            await page.screenshot({ path: `${output}/phone-375-long-unconfigured.png`,
              clip: { x: 0, y: 0, width: 375, height: 80 } });
          }
          await page.setViewportSize({ width: 390, height: 844 });
          await longAmount.evaluate((node) => { node.textContent = "¥12,345,678,901,234.56"; node.setAttribute("data-very-long", ""); });
          for (const width of [375, 390]) {
            await page.setViewportSize({ width, height: 844 });
            expect(await longAmount.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
          }
        }
        await longAmount.evaluate((node, value) => { node.textContent = value; node.removeAttribute("data-long"); node.removeAttribute("data-very-long"); }, savedAmount);
        const source = header.locator(".t3-refresh-source-trigger");
        if (configured) {
          const sync = header.locator(".t3-topbar-sync-button");
          await expect(sync).toBeVisible();
          await expect(sync.locator("svg[data-icon]")).toBeVisible();
          await expect(sync.locator("svg[data-icon]")).toHaveCSS("width", "16px");
          await expect(sync).toHaveAttribute("title", /Sync|Synced|Not synced/);
          const liveBox = (await dot.boundingBox())!;
          const buttonBox = (await sync.boundingBox())!;
          const syncBox = (await sync.locator("svg").boundingBox())!;
          expect(buttonBox.x - liveBox.x - liveBox.width).toBeGreaterThanOrEqual(12);
          expect(syncBox.x - liveBox.x - liveBox.width).toBeGreaterThanOrEqual(12);
          const amount = header.locator(".mobile-header-total-value");
          const originalAmount = await amount.textContent();
          await amount.evaluate((node) => { node.textContent = "¥10,852,513.09"; });
          await expect(amount).toHaveCSS("display", "block");
          expect(await amount.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(false);
          await expect(header.locator(".mobile-header-total-label")).toBeHidden();
          const longDotBox = (await dot.boundingBox())!;
          expect(buttonBox.x - longDotBox.x - longDotBox.width).toBeGreaterThanOrEqual(12);
          if (theme === "dark") {
            mkdirSync(output, { recursive: true });
            await page.screenshot({ path: `${output}/phone-long-amount.png`,
              clip: { x: 0, y: 0, width: 390, height: 80 } });
          }
          await amount.evaluate((node, value) => { node.textContent = value; }, originalAmount);
          await expect(source).toBeHidden();
        } else {
          await expect(header.locator(".t3-topbar-sync-button")).toHaveCount(0);
          await expect(source.locator("svg[data-icon='source-info']")).toBeVisible();
          expect(await source.evaluate((node) => getComputedStyle(node, "::before").content)).toBe("none");
        }
        mkdirSync(output, { recursive: true });
        await page.screenshot({ path: `${output}/phone-${theme}-${configured ? "configured" : "unconfigured"}.png`,
          clip: { x: 0, y: 0, width: 390, height: 80 } });
        if (configured && theme === "dark") {
          await page.evaluate(async () => {
            const runtimeModule = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModule);
            await (syncRuntime as any).scheduler?.stop();
          });
          for (const [name, mode, syncStatus, icon] of [
            ["synced", "ready", { phase: "idle", lastSync: Date.parse("2026-10-31T09:41:00Z") }, "check"],
            ["syncing", "ready", { phase: "syncing" }, "sync"],
            ["error", "ready", { phase: "error", error: "network" }, "alert"],
            ["off", "disabled", { phase: "idle" }, "off"],
          ] as const) {
            await page.evaluate(async ({ mode, syncStatus }) => {
              const runtimeModule = "/src/middlelayers/sync/runtime.ts";
              const { syncRuntime } = await import(runtimeModule);
              (syncRuntime as any).publish(mode, syncStatus);
            }, { mode, syncStatus });
            await expect(header.locator(".t3-topbar-sync-button")).toHaveAttribute("data-sync-state", name);
            await expect(header.locator(`.t3-topbar-sync-button svg[data-icon='${icon}']`)).toBeVisible();
            await page.screenshot({ path: `${output}/phone-sync-${name}.png`, clip: { x: 0, y: 0, width: 390, height: 80 } });
          }
          await page.evaluate(async () => {
            const runtimeModule = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModule);
            (syncRuntime as any).publish("ready", { phase: "idle", lastSync: Date.now() - 120_000 });
          });
          const syncButton = header.locator(".t3-topbar-sync-button");
          await expect(syncButton).toHaveAttribute("title", "Synced 2 min ago");
          await syncButton.click();
          await expect(page.locator(".ios-d3-sync-popover")).toContainText("Synced 2 min ago");
          await page.keyboard.press("Escape");
          await context.setOffline(true);
          await page.evaluate(() => window.dispatchEvent(new Event("offline")));
          await expect(header.locator(".t3-topbar-sync-button")).toHaveAttribute("data-sync-state", "offline");
          await page.screenshot({ path: `${output}/phone-sync-offline.png`, clip: { x: 0, y: 0, width: 390, height: 80 } });
          await context.setOffline(false);
        }
        if (theme === "dark") {
          for (const [state, label] of [
            ["connecting", "Live prices: connecting"],
            ["live", "Live prices: connected"],
            ["stale", "Live prices: waiting for an update"],
            ["error", "Live prices: unavailable"],
          ] as const) {
            await dot.evaluate((node, next) => {
              node.setAttribute("data-state", next.state);
              node.setAttribute("aria-label", next.label);
              node.setAttribute("title", next.label);
            }, { state, label });
            await page.screenshot({ path: `${output}/phone-live-${state}-${configured ? "configured" : "unconfigured"}.png`,
              clip: { x: 0, y: 0, width: 390, height: 80 } });
          }
        }
        if (configured && theme === "dark") {
          await page.evaluate(async () => {
            const runtimeModule = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModule);
            (syncRuntime as any).publish("disabled", { phase: "idle" });
          });
          await header.locator(".t3-topbar-sync-button").click();
          await expect(page).toHaveURL(/#\/settings\/sync$/);
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
      } finally {
        await context.close();
      }
    });
  }
}
