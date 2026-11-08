import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const sources = [
  ["erc20:0", "Tangam"], ["erc20:1", "Cold"], ["cex:0", "Binance"], ["cex:1", "OKX"],
  ["btc:0", "Main"], ["btc:1", "Main"], ["btc:2", "Tangam"], ["stock:0", "Interactive Brokers"],
];
const output = "/tmp/refresh-single-progress";

export function registerRefreshSingleProgressScenarios(phone: boolean) {
  for (const theme of ["light", "dark"] as const) {
    test(`${phone ? "phone 390" : "desktop 1280"} ${theme} refresh has one bar and a user-opened truthful status`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== (phone ? "mobile" : "desktop"));
      test.setTimeout(120_000);
      mkdirSync(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: phone ? 390 : 1280, height: phone ? 844 : 800 },
        colorScheme: theme, isMobile: phone, hasTouch: phone, reducedMotion: "reduce",
        ...(phone ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" } : {}),
        timezoneId: "UTC",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
        await installTauriBridge(page, { fidelitySample: "full" });
        await page.evaluate(async () => {
          const invoke = (window as any).__e2eInvoke;
          await invoke("plugin:sql|execute", {
            query: "UPDATE configuration SET data = ? WHERE id = 11",
            values: ["btc:\n  addresses:\n    - {address: bc1qonewallet, alias: Main}\n    - {address: bc1qtwowallet, alias: Main}\n    - {address: bc1qthreewallet, alias: Tangam}\nerc20:\n  addresses:\n    - {address: '0x1111111111111111111111111111111111111111', alias: Tangam}\n    - {address: '0x2222222222222222222222222222222222222222', alias: Cold}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n"],
          });
          await invoke("plugin:sql|execute", {
            query: "UPDATE configuration SET data = ? WHERE id = 12",
            values: ["configs:\n  groupUSD: false\nothers: []\n"],
          });
        });
        await page.route("**/src/middlelayers/charts.ts*", async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          expect(body).toContain("  refreshAllData,");
          await route.fulfill({ response, body: body.replace("  refreshAllData,\n", "") + `
export async function refreshAllData(setProgress, options) {
  window.__fakeRefreshStarted = (window.__fakeRefreshStarted || 0) + 1;
  const rows = ${JSON.stringify(sources)};
  const results = await Promise.all(rows.map(([sourceId, label], index) => new Promise((resolve) => {
    let startedAt;
    setTimeout(() => {
      startedAt = new Date().toISOString();
    }, index * 900);
    setTimeout(() => {
      const status = index === 3 ? "stale" : "ok";
      const result = { sourceId, label, status, category: status === "stale" ? "network" : undefined,
        detail: status === "stale" ? "Source timed out" : undefined,
        kind: sourceId.startsWith("cex") ? "exchange" : sourceId.startsWith("stock") ? "broker" : "wallet",
        walletIdentities: [], coins: [], startedAt, finishedAt: new Date().toISOString() };
      options?.onSourceResult?.(result);
      setProgress(5 + (index + 1) * 10);
      resolve(result);
    }, (index + 1) * 900);
  })));
  return { persisted: true, failedSources: [], requiresDataSourceAction: false,
    usedLastKnownData: true, sourceResults: results, sourceStatuses: results };
}` });
        });
        await page.goto("/#/overview");
        await expect(page.locator(phone ? ".fd-overview-hero .fd-overview-value" : ".t3-overview-grid"))
          .toBeVisible({ timeout: 30_000 });
        const refresh = phone ? page.locator(".fd-overview-refresh, .fd-partial-refresh") : page.getByRole("button", { name: "Refresh", exact: true });
        await expect(refresh).toBeVisible({ timeout: 30_000 });
        await page.clock.pauseAt(new Date("2026-10-31T09:41:00Z"));
        await page.evaluate(() => {
          (window as any).__refreshAutoOpened = false;
          const observer = new MutationObserver(() => {
            if (document.querySelector('[role="alertdialog"]')) (window as any).__refreshAutoOpened = true;
          });
          observer.observe(document.body, { childList: true, subtree: true });
        });
        await refresh.click();
        await expect.poll(() => page.evaluate(() => (window as any).__fakeRefreshStarted || 0)).toBe(1);
        const dialog = page.getByRole("alertdialog", { name: /Refreshing sources|Source status|Refresh finished/ });
        const bar = page.locator('[role="progressbar"][aria-label="Refresh progress"]');
        await expect(bar).toHaveCount(1);
        if (phone) await expect(page.locator(".fd-pull-progress")).toHaveCount(0);
        expect((await bar.boundingBox())?.height).toBeLessThanOrEqual(3);
        await expect(dialog).toHaveCount(0);
        await page.clock.runFor(4_000);
        await expect(dialog).toHaveCount(0);
        await expect(bar).toHaveCount(1);
        const progress = Number(await bar.getAttribute("aria-valuenow"));
        expect(progress).toBeGreaterThan(0);
        expect(progress).toBeLessThan(100);
        await expect(bar).toHaveAttribute("aria-valuemax", "100");
        await page.clock.runFor(6_000);
        await expect(dialog).toHaveCount(0);
        await expect(bar).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__refreshAutoOpened)).toBe(false);
        const status = page.getByRole("button", { name: "Source status" });
        await expect(status).toHaveAttribute("title", "1 failed");
        if (!phone) {
          const icon = (await status.locator('[data-icon="source-info"]').boundingBox())!;
          const badge = (await status.locator(".t3-refresh-failed-count").boundingBox())!;
          expect(badge.y).toBeLessThan(icon.y + icon.height);
          expect(badge.x).toBeLessThan(icon.x + icon.width);
        }
        await status.click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[role="progressbar"]')).toHaveCount(0);
        await expect(dialog.getByRole("status")).toHaveAttribute("aria-live", "polite");
        await expect(dialog.getByRole("status")).toHaveAttribute("aria-busy", "false");
        await expect(dialog.locator("[data-source-status-row]")).toHaveCount(8);
        if (phone) expect((await dialog.locator(".ios-d3-refresh-status-list").boundingBox())?.height).toBeGreaterThanOrEqual(132);
        const names = await dialog.locator("[data-source-status-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label")));
        expect(new Set(names).size).toBe(8);
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeLessThanOrEqual(phone ? 844 * 0.9 : 420);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(phone ? 390 : 1280);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(phone ? 844 : 800);
        await page.screenshot({ path: `${output}/${phone ? "phone" : "desktop"}-${theme}.png` });
        await page.mouse.click(phone ? 10 : 700, phone ? 10 : 700);
        await expect(dialog).toHaveCount(0);
        await status.click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await refresh.click();
        await expect.poll(() => page.evaluate(() => (window as any).__fakeRefreshStarted || 0)).toBe(2);
        await expect(bar).toHaveCount(1);
        await expect(dialog).toHaveCount(0);
        await page.clock.runFor(2_000);
        if (phone) await status.click();
        else await page.locator(".t3-refresh-progress-pill").click();
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-source-status-row]")).toHaveCount(8);
        await expect(dialog.getByRole("status")).toHaveAttribute("aria-busy", "true");
        if (phone && theme === "light") {
          const colors = await dialog.evaluate((node) => ({
            background: getComputedStyle(node).backgroundColor.match(/\d+/g)?.map(Number) ?? [],
            text: getComputedStyle(node).color.match(/\d+/g)?.map(Number) ?? [],
          }));
          expect(colors.background.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3).toBeGreaterThan(180);
          expect(colors.text.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3).toBeLessThan(120);
        }
        await expect(dialog).toContainText("2 of 8 finished");
        await expect(dialog).not.toContainText("This partial refresh was saved");
        await expect(dialog.getByRole("group", { name: "Tangam (1)" })).toContainText("Done in");
        await expect(dialog.getByRole("group", { name: "Main (1)" })).not.toContainText("Done in");
        await page.screenshot({ path: `${output}/${phone ? "phone" : "desktop"}-${theme}-running.png` });
        await dialog.getByRole("button", { name: "Hide" }).click();
        await expect(dialog).toHaveCount(0);
        if (phone) await status.click();
        else await page.locator(".t3-refresh-progress-pill").click();
        await expect(dialog).toBeVisible();
        await page.clock.runFor(2_000);
        await expect(dialog).toContainText("1 failed");
        const ordered = await dialog.locator("[data-source-status-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label")));
        expect(ordered[0]).toBe("OKX");
        await expect(dialog.getByRole("group", { name: "OKX" })).toContainText(/Network or timeout|Source timed out/);
        await expect(dialog.getByRole("group", { name: "OKX" }).getByRole("button", { name: /Retry/ })).toBeEnabled();
        await expect(dialog.locator('[role="progressbar"]')).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
}
