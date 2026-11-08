import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { FakeS3, S3Error } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge, seedDesktopAiSummary, seedDesktopSourceStatuses } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/toasts";
const states = ["ok", "long", "stack"] as const;

class FailingS3 extends FakeS3 {
  failList = false;
  override async listObjectsV2(...args: Parameters<FakeS3["listObjectsV2"]>) {
    if (this.failList) throw new S3Error("local fixture access failure", 403);
    return super.listObjectsV2(...args);
  }
}

for (const state of states) test(`Toast desktop captures ${state} from the notification queue`, async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, colorScheme: "dark",
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      const failingStore = state === "long" ? new FailingS3() : undefined;
      await installTauriBridge(page, { fidelitySample: "full", quotaUsageFixture: state === "stack" ? "near" : undefined,
        ...(failingStore ? { s3: failingStore } : {}) });
      await seedDesktopSourceStatuses(page);
      if (state === "ok" || state === "stack") {
        // The UI runs its normal refresh path against a stable local service result.
        // A live refresh would replace the design snapshot with the bridge's NOVA data.
        await page.route("**/src/components/refresh-data.tsx*", async (route) => {
          const response = await route.fetch();
          const source = await response.text();
          expect(source).toContain("refreshInsights(insightStatuses, locale)");
          await route.fulfill({ response, body: source.replace(
            "refreshInsights(insightStatuses, locale)", "Promise.resolve(true)") });
        });
        await page.route("**/src/middlelayers/charts.ts*", async (route) => {
          const response = await route.fetch();
          const source = await response.text();
          expect(source).toContain("  refreshAllData,");
          await route.fulfill({
            response,
            body: source.replace("  refreshAllData,\n", "") + `
export async function refreshAllData(setProgress) {
  setProgress(100);
  const statuses = JSON.parse(localStorage.getItem("track3-refresh-source-statuses") || "[]")
    .map((source) => ({ ...source, status: "ok", category: undefined, detail: undefined }));
  if ("${state}" === "stack") {
    const call = window.__fidelityRefreshCount = (window.__fidelityRefreshCount || 0) + 1;
    if (call === 2) {
      const failed = statuses[1];
      failed.status = "failed";
      failed.category = "network";
      failed.detail = "Source timed out";
    }
  }
  return {
    persisted: true,
    sourceResults: [],
    sourceStatuses: statuses,
    usedLastKnownData: false,
  };
}`,
          });
        });
      }
      if (state === "stack") await page.route("**/src/components/historical-data.tsx*", async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        if (!source.includes("undoWindowMs: 5e3")) throw new Error("History undo interval was not found");
        await route.fulfill({ response, body: source.replaceAll("undoWindowMs: 5e3", "undoWindowMs: 6e4") });
      });
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
      }));
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
      }));
      if (state === "stack") await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "UPDATE configuration SET data = ? WHERE id = 11",
        values: ["btc: {addresses: []}\nerc20: {addresses: ['0x1111111111111111111111111111111111111111']}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n"],
      }));
      await seedDesktopAiSummary(page);
      if (state === "long") {
        await page.goto("/#/settings/sync");
        for (const [field, value] of Object.entries({
          endpoint: "https://s3.example.test", region: "us-east-1", bucket: "track3",
          accessKeyId: "fake-key", secretAccessKey: "fake-secret",
        })) await page.locator(`#sync-${field}`).fill(value);
        await page.getByRole("button", { name: "Test connection" }).click();
        await expect(page.locator(".desktop-toast-viewport")).toContainText("Connection successful.");
        await page.locator("#sync-passphrase").fill("local test passphrase");
        await page.locator("#sync-confirm").fill("local test passphrase");
        await page.getByRole("button", { name: "Enable sync" }).click();
        const syncNow = page.getByRole("button", { name: "Sync now" });
        await expect(syncNow).toBeEnabled({ timeout: 20_000 });
        failingStore!.failList = true;
        await syncNow.click();
        await expect(page.locator(".desktop-toast-viewport [data-sync-status='error']")).toBeVisible();
      }
      await page.goto("/#/overview");
      await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      await expect(page.locator(".t3-insights-summary")).toBeVisible();
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      if (state === "ok") {
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await expect(page.locator(".t3-fidelity-toast")).toHaveCount(1, { timeout: 30_000 });
        await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27");
        await expect(page.locator(".t3-fidelity-toast")).toContainText("5 of 5 sources refreshed at 09:41.");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(page.locator(".t3-insights-summary")).toBeVisible();
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
        const chartBox = await canvas.boundingBox();
        const labelBox = await page.locator(".t3-chart-end-value").boundingBox();
        expect(Math.abs(labelBox!.y + labelBox!.height / 2 - chartBox!.y - endpoint.y)).toBeLessThan(8);
        expect(Math.abs(labelBox!.x - chartBox!.x - endpoint.x - 6)).toBeLessThan(8);
      } else if (state === "stack") {
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await expect(page.locator(".t3-fidelity-toast")).toHaveCount(1);
        await expect(page.locator(".t3-fidelity-toast").first()).toContainText("Pro refresh limit nearly used");
        await expect(page.locator(".t3-fidelity-toast").first()).toContainText("48 of 50 ERC20 refreshes used. Resets 1 Nov.");
        await expect(page.getByRole("alertdialog", { name: "Refresh finished" })).toHaveCount(0);
        await page.getByRole("button", { name: "Source status" }).click();
        await expect(page.getByRole("alertdialog", { name: "Refresh finished" })).toBeVisible();
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "See usage" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled({ timeout: 10_000 });
        await page.getByRole("button", { name: "Refresh", exact: true }).click({ timeout: 5_000 });
        await expect(page.locator(".t3-fidelity-toast")).toHaveCount(2);
        await expect(page.locator(".t3-fidelity-toast").last()).toContainText("OKX refresh failed");
        await expect(page.locator(".t3-fidelity-toast").last()).toContainText("Source timed out");
        await expect(page.getByRole("alertdialog", { name: "Refresh finished" })).toHaveCount(0);
        await page.getByRole("button", { name: "Source status" }).click();
        await expect(page.getByRole("alertdialog", { name: "Refresh finished" })).toBeVisible();
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        await page.goto("/#/history");
        await page.getByTestId("history-snapshot-row").first().click();
        await page.getByTestId("history-desktop-detail").getByRole("button", { name: "Delete", exact: true }).click();
        await page.getByRole("alertdialog", { name: "Delete this snapshot?" })
          .getByRole("button", { name: "Delete snapshot" }).click();
        await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
        await page.goto("/#/overview");
        await expect(page.locator(".t3-fidelity-toast").filter({ hasText: "OKX refresh failed" })).toBeVisible();
        await expect(page.locator(".fidelity-history-undo-toast")).toContainText("Snapshot deleted");
        await expect(page.locator(".t3-grid-hero")).not.toContainText(/-9\d\.\d+%/);
        await expect.poll(() => page.locator(".t3-hero-chart canvas").evaluate((element: HTMLCanvasElement) => {
          const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
          let blue = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index] > 50 && pixels[index] < 130 &&
              pixels[index + 1] > 90 && pixels[index + 1] < 190 &&
              pixels[index + 2] > 160) blue++;
          }
          return blue;
        })).toBeGreaterThan(100);
      }
      if (state === "stack") {
        const openToasts = page.locator(".desktop-toast-viewport > li[data-state='open']");
        await expect(openToasts).toHaveCount(3);
        expect(await openToasts.allTextContents()).toEqual([
          expect.stringContaining("Pro refresh limit nearly used"),
          expect.stringContaining("OKX refresh failed"),
          expect.stringContaining("Snapshot deleted"),
        ]);
      } else await expect(page.locator(".desktop-toast-viewport > li[data-state='open']")).toHaveCount(1);
      if (state === "long") {
        const syncToast = page.locator(".desktop-toast-viewport [data-sync-status='error']");
        await expect(syncToast).toBeVisible();
        expect(await syncToast.evaluate((node) => parseFloat(getComputedStyle(node).paddingLeft))).toBeGreaterThanOrEqual(48);
        await expect(syncToast.getByRole("button", { name: "Copy details" })).toBeVisible();
        await expect(syncToast.getByRole("button", { name: "Details", exact: true })).toBeVisible();
        const copyBox = await syncToast.getByRole("button", { name: "Copy details" }).boundingBox();
        const detailsBox = await syncToast.getByRole("button", { name: "Details", exact: true }).boundingBox();
        expect(detailsBox!.x - copyBox!.x - copyBox!.width).toBeGreaterThanOrEqual(12);
      }
      if (state === "stack") {
        await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
      }
      const toastBox = await page.locator(".desktop-toast-viewport > li[data-state='open']").first().boundingBox();
      expect(Math.round(1600 - toastBox!.x - toastBox!.width)).toBe(24);
      await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
      await page.mouse.move(800, 20);
      await page.screenshot({ path: `${output}/toasts-${state}-desktop.png`, fullPage: true, animations: "disabled" });
    } finally {
      await context.close();
    }
});
