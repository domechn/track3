import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge, seedDesktopAiSummary } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/overview";
const states = [
  { name: "overview", width: 1440 },
  { name: "overview-ai-off", width: 1440 },
  { name: "overview-expanded-1024", width: 1024 },
  { name: "overview-expanded-1440", width: 1440 },
  { name: "overview-hover", width: 1440 },
  { name: "overview-range", width: 1440 },
  { name: "overview-stale", width: 1440 },
  { name: "overview-sync", width: 1440 },
] as const;

for (const state of states) test(`Overview desktop captures ${state.name} with stored sample snapshots`, async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: state.width, height: 900 },
      colorScheme: "dark",
      reducedMotion: "reduce",
      timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await page.addInitScript((stale) => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(
        ["Binance", "OKX", "Ledger cold wallet", "0x4f…a91c", "Interactive Brokers"].map((label, index) => ({
          sourceId: `source:${index}`, label,
          kind: index < 2 ? "exchange" : index < 4 ? "wallet" : "broker",
          provider: index < 2 ? ["binance", "okx"][index] : index === 4 ? "ibkr" : "wallet",
          status: stale && index === 4 ? "failed" : "ok",
          startedAt: index === 2 || index === 3 ? "2026-10-31T09:39:00.000Z" : "2026-10-31T09:40:00.000Z",
          finishedAt: index === 2 || index === 3 ? "2026-10-31T09:40:00.000Z" : "2026-10-31T09:41:00.000Z",
          lastSuccessAt: stale && index === 4 ? "2026-10-31T08:12:00Z" : "2026-10-31T09:41:00Z",
          detail: stale && index === 4 ? "Source timed out" : undefined,
        })),
      )), state.name === "overview-stale");
      const syncPassphrase = "local fidelity sync passphrase";
      const s3 = new FakeS3();
      const { header } = await createSyncHeader(syncPassphrase);
      await writeSyncHeader(s3, header);
      await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: true, s3 });
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
      }));
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
      }));
      if (state.name === "overview-ai-off") await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM configuration WHERE id = 994", values: [],
      }));
      else await seedDesktopAiSummary(page);
      await page.goto("/#/overview");
      await page.getByLabel("Sync passphrase").fill(syncPassphrase);
      await page.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
      await expect(page.locator(".desktop-sync-status-indicator button")).toHaveAttribute("aria-label", "Sync idle");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      if (state.name !== "overview-ai-off") {
        await expect(page.locator(".t3-insights-summary")).toBeVisible();
      }
      if (state.name.includes("expanded")) {
        const toggle = page.getByRole("button", { name: "Expand sidebar" });
        const box = await toggle.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(900);
        await toggle.click();
      }
      if (state.name === "overview-expanded-1024") {
        const subtitle = await page.locator(".t3-overview-heading p").boundingBox();
        const controls = await page.locator(".t3-topbar-controls").boundingBox();
        expect(controls!.y).toBeGreaterThanOrEqual(subtitle!.y + subtitle!.height);
        const hero = await page.locator(".t3-grid-hero").boundingBox();
        const holdings = await page.locator(".t3-grid-holdings").boundingBox();
        expect(Math.abs(hero!.x - 244)).toBeLessThan(1);
        expect(Math.abs(hero!.y - 182)).toBeLessThan(1);
        expect(Math.abs(hero!.height - 457)).toBeLessThan(1);
        expect(Math.abs(holdings!.y - 655)).toBeLessThan(1);
        await expect(page.locator(".t3-live-label").first()).toBeVisible();
      }
      if (state.name === "overview-expanded-1440") {
        const subtitle = await page.locator(".t3-overview-heading p").boundingBox();
        const ranges = await page.locator(".t3-fidelity-ranges").boundingBox();
        expect(ranges!.y).toBeLessThan(subtitle!.y + subtitle!.height);
        const insights = page.locator(".t3-grid-insights");
        const hero = await page.locator(".t3-grid-hero").boundingBox();
        const insightsBox = await insights.boundingBox();
        expect(Math.abs(hero!.height - 457)).toBeLessThan(1);
        expect(Math.abs(insightsBox!.y - 605)).toBeLessThan(1);
        expect(await insights.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
      }
      if (state.name === "overview-range") {
        await page.getByRole("button", { name: "Choose date range" }).click();
        const popover = await page.locator(".t3-date-popover").boundingBox();
        expect(Math.abs(popover!.x - 852)).toBeLessThan(1);
        expect(Math.abs(popover!.y - 126)).toBeLessThan(1);
        await page.getByRole("textbox", { name: "From" }).fill("8 Oct 2026");
        await page.getByRole("textbox", { name: "To" }).fill("24 Oct 2026");
        await page.getByRole("textbox", { name: "To" }).blur();
        await expect(page.locator(".t3-date-fidelity-footer")).toContainText("17 snapshots");
        await page.getByRole("textbox", { name: "From" }).focus();
      }
      await page.waitForFunction(async () => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        return syncRuntime.status().mode === "ready" && syncRuntime.status().sync.lastSync !== undefined &&
          syncRuntime.status().sync.phase === "idle";
      }, undefined, { timeout: 60_000 });
      await expect(page.locator(".desktop-sync-status-indicator button").first())
        .toContainText("Synced 09:41", { timeout: 30_000 });
      if (state.name === "overview-sync") {
        await page.locator(".desktop-sync-status-indicator button").first().click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog")).toContainText("Backup & sync");
      }
      if (state.name === "overview-stale") {
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1551);
        const sources = page.locator(".t3-sources-panel");
        const lastSource = sources.locator(".t3-source-row").last();
        const cardBox = await sources.boundingBox();
        const rowBox = await lastSource.boundingBox();
        expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
      }
      if (state.name === "overview-ai-off") {
        await expect(page.locator(".t3-insights-card")).toContainText("Insights are turned off");
      }
      if (state.name === "overview") {
        const hero = await page.locator(".t3-grid-hero").boundingBox();
        expect(Math.abs(hero!.y - 132)).toBeLessThan(1);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1523);
        const sourceStatus = page.getByRole("button", { name: "Source status" });
        await expect(sourceStatus).toBeVisible({ timeout: 5_000 });
        await sourceStatus.click();
        await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
        await page.keyboard.press("Escape");
        await page.mouse.move(700, 20);
      }
      if (state.name === "overview-hover") {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: state.width, height });
        const chart = page.locator(".t3-hero-chart canvas");
        const box = await chart.boundingBox();
        await chart.hover({ position: { x: box!.width * 0.38, y: box!.height / 2 } });
        await page.waitForTimeout(150);
        const markerPixels = await chart.evaluate((canvas: HTMLCanvasElement) => {
          const { width, height } = canvas;
          const pixels = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
          const brightness = (x: number, y: number) => {
            const offset = (y * width + x) * 4;
            return pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
          };
          let longest = 0;
          for (let x = Math.floor(width * 0.8); x < width * 0.97; x++) {
            let hits = 0;
            for (let y = Math.floor(height * 0.1); y < height * 0.8; y += 5) {
              if (brightness(x, y) - brightness(x - 3, y) > 24 &&
                brightness(x, y) - brightness(x + 3, y) > 24) hits++;
            }
            longest = Math.max(longest, hits);
          }
          return longest;
        });
        expect(markerPixels).toBeGreaterThan(12);
      }
      await page.screenshot({ path: `${output}/${state.name}-desktop.png`, fullPage: state.name !== "overview-hover" });
      if (state.name === "overview") {
        await expect(page.locator(".t3-refresh-source-trigger")).toBeVisible();
        await page.locator(".t3-refresh-source-trigger").evaluate((button) => button.setAttribute("data-refreshed", ""));
        await expect(page.locator(".t3-refresh-source-trigger")).toBeVisible();
        const hero = await page.locator(".t3-grid-hero").boundingBox();
        expect(Math.round(hero!.x)).toBe(84);
        expect(Math.round(hero!.y)).toBe(132);
        expect(Math.round(hero!.width)).toBe(880);
        expect(Math.round(hero!.height)).toBe(449);
        const rail = await page.locator("aside").boundingBox();
        expect(Math.round(rail!.height)).toBeGreaterThan(1400);
        const heroValue = await page.locator(".t3-hero-value").evaluate((element) => {
          const box = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          return { y: box.y + window.scrollY, textWidth: range.getBoundingClientRect().width };
        });
        // The source HTML's .kpis .v.big starts at y=173 at this viewport.
        expect(heroValue.textWidth).toBeLessThan(216);
        expect(Math.round(heroValue.y)).toBeGreaterThanOrEqual(171);
        expect(Math.round(heroValue.y)).toBeLessThanOrEqual(175);
        const segment = await page.locator(".t3-fidelity-ranges").boundingBox();
        expect(Math.round(segment!.y)).toBeGreaterThanOrEqual(80);
        await expect(page.locator(".t3-fidelity-ranges button")).toHaveCount(6);
        await expect(page.locator(".t3-fidelity-ranges button[aria-pressed='true']")).toContainText("30D");
        await expect(page.locator(".t3-date-range-display")).toHaveAttribute("data-range", "1 Oct – 31 Oct 2026");
        await expect(page.locator(".t3-pnl-compact")).toContainText("Latest");
        await expect(page.locator(".t3-hero-change")).toContainText("Last snapshot");
        await expect(page.locator(".t3-overview-heading")).toContainText("7-day gain of $26,010.84");
        await expect(page.locator(".t3-overview-heading p b")).toHaveText("$26,010.84");
        await expect(page.locator(".t3-chart-end-value")).toHaveText("$763,809");
        const canvas = page.locator(".t3-hero-chart canvas");
        const endpoint = await canvas.evaluate((element: HTMLCanvasElement) => {
          const { width, height } = element;
          const pixels = element.getContext("2d")!.getImageData(0, 0, width, height).data;
          for (let x = width - 1; x > width * 0.7; x--) {
            for (let y = 0; y < height; y++) {
              const offset = (y * width + x) * 4;
              if (pixels[offset] > 50 && pixels[offset] < 130 &&
                pixels[offset + 1] > 90 && pixels[offset + 1] < 190 &&
                pixels[offset + 2] > 160) return { x, y };
            }
          }
          throw new Error("Chart endpoint not painted");
        });
        const canvasBox = await canvas.boundingBox();
        const endLabel = await page.locator(".t3-chart-end-value").boundingBox();
        expect(endLabel!.x).toBeGreaterThan(canvasBox!.x + endpoint.x);
        expect(Math.abs(endLabel!.y + endLabel!.height / 2 - canvasBox!.y - endpoint.y)).toBeLessThan(6);
        await expect(page.locator(".t3-chart-best-day"))
          .toHaveText("29 Oct: +$9,571, best day (ETH +$3,743)");
        await expect(page.locator(".t3-daily-panel")).toContainText("USD, last 30 days");
        await expect(page.locator(".t3-moved-list li").last()).toContainText("AAPL");
        const firstBar = await page.locator(".t3-moved-list li:first-child .t3-moved-track > span").boundingBox();
        const lastBar = await page.locator(".t3-moved-list li:last-child .t3-moved-track > span").boundingBox();
        expect(Math.abs(firstBar!.x - 1088.3)).toBeLessThan(2);
        expect(Math.abs(firstBar!.width - 197.2)).toBeLessThan(3);
        expect(Math.abs(lastBar!.x + lastBar!.width - 1088.3)).toBeLessThan(2);
        await expect(page.locator(".t3-top-head")).toContainText("24h");
        await expect(page.locator(".t3-top-head")).toContainText("7D");
        await expect(page.getByTestId("overview-coin-row").first()).toContainText("+6.4%");
        await expect(page.locator(".t3-topbar-bell")).toBeVisible();
        await expect(page.locator(".t3-overview-footer")).toContainText("Local database");
        await expect(page.locator(".t3-overview-footer")).not.toContainText("1 devices");
      }
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.screenshot({ path: `${output}/${state.name}-1600.png`, fullPage: true });
    } finally {
      await context.close();
    }
});
