import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";

const output = "/tmp/fidelity-desktop/wallets";

async function openWallets(page: Page, failedOkx: boolean, s3?: FakeS3) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await page.addInitScript((failed) => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(
    ["Binance", "OKX", "Ledger cold wallet", "0x4f…a91c", "Interactive Brokers"].map((label, index) => ({
      sourceId: `source:${index}`, label,
      kind: index < 2 ? "exchange" : index < 4 ? "wallet" : "broker",
      provider: index < 2 ? ["binance", "okx"][index] : index === 4 ? "ibkr" : "wallet",
      status: failed && index === 1 ? "failed" : "ok",
      startedAt: "2026-10-31T09:39:00.000Z",
      finishedAt: index === 2 || index === 3 ? "2026-10-31T09:40:00.000Z" : "2026-10-31T09:41:00.000Z",
      lastSuccessAt: failed && index === 1 ? "2026-10-31T09:12:00Z"
        : index === 2 || index === 3 ? "2026-10-31T09:40:00Z" : "2026-10-31T09:41:00Z",
      category: failed && index === 1 ? "rateLimit" : undefined,
      detail: failed && index === 1 ? "Rate limit exceeded (HTTP 429)" : undefined,
    })),
  )), failedOkx);
  await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: Boolean(s3), s3 });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
  }));
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
  }));
  await page.goto("/#/wallets");
  await expect(page.getByRole("heading", { name: "Wallets" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    const schedulerModule = "/src/middlelayers/refresh-retry-scheduler.ts";
    const statusModule = "/src/middlelayers/ui-state/source-status-store.ts";
    const [{ refreshRetryScheduler }, { readStoredStatuses }] = await Promise.all([
      import(schedulerModule), import(statusModule),
    ]);
    refreshRetryScheduler.complete(readStoredStatuses());
  });
}

test.describe("Wallets desktop fidelity", () => {
  test("keeps backup and sync accessible from Wallets when sync is configured", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, colorScheme: "dark",
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const passphrase = "wallets sync access test passphrase";
      const s3 = new FakeS3();
      const { header } = await createSyncHeader(passphrase);
      await writeSyncHeader(s3, header);
      const page = await context.newPage();
      await openWallets(page, false, s3);
      await page.getByLabel("Sync passphrase").fill(passphrase);
      await page.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
      const indicator = page.locator(".t3-wallet-actions .desktop-sync-status-indicator button");
      await expect(indicator).toBeVisible();
      await indicator.click();
      await expect(page.getByRole("dialog")).toContainText("Backup & sync");
    } finally {
      await context.close();
    }
  });

  for (const state of ["all", "binance", "okx"] as const) {
    test(state, async ({ browser }, testInfo) => {
      test.setTimeout(120_000);
      test.skip(testInfo.project.name !== "desktop");
      mkdirSync(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1600, height: 900 }, colorScheme: "dark",
        reducedMotion: "reduce", timezoneId: "UTC",
      });
      try {
        const page = await context.newPage();
        await openWallets(page, true);
        await expect(page.locator(".t3-wallet-legacy")).toHaveCount(0);
        if (state !== "all") {
          await page.locator(".analyze-source-picker").getByRole("button", { name: state === "okx" ? "OKX" : "Binance" }).click();
        }
        await page.screenshot({ path: `${output}/wallets-${state}-desktop.png`, fullPage: true });
        await expect(page.getByRole("heading", { name: state === "all" ? "Allocation by source" : state === "okx" ? "OKX" : "Binance" })).toBeVisible();
        const valueBottoms = await page.locator(".t3-wallet-kpis strong").evaluateAll((values) =>
          values.map((value) => Math.round(value.getBoundingClientRect().bottom)));
        expect(Math.max(...valueBottoms) - Math.min(...valueBottoms)).toBeLessThanOrEqual(4);
        if (state === "all") {
          const allocation = await page.locator(".t3-wallet-allocation").boundingBox();
          const balances = await page.locator(".t3-wallet-balances").boundingBox();
          expect(Math.abs(allocation!.y - 140)).toBeLessThan(1);
          expect(Math.abs(balances!.y - 374)).toBeLessThan(1);
          const headerCells = await page.locator(".t3-wallet-balances thead th").evaluateAll((cells) =>
            cells.map((cell) => cell.getBoundingClientRect().x));
          expect(headerCells.every((x, index) => Math.abs(x - [105, 427.3, 615.3, 737, 921.4][index]) < 1)).toBe(true);
          const matrixCells = await page.locator(".t3-wallet-matrix thead th").evaluateAll((cells) =>
            cells.map((cell) => cell.getBoundingClientRect().x));
          expect(matrixCells.every((x, index) => Math.abs(x - [105, 155.8, 297.4, 426.6, 595.7, 724.8, 897.9][index]) < 1)).toBe(true);
          await expect(page.locator(".t3-wallet-status-list")).toContainText(
            "Rate limit exceeded. Showing the last good balances from 09:12.");
          const failedMessage = await page.locator(".t3-wallet-status-list .failed p").boundingBox();
          expect(failedMessage!.height).toBeGreaterThan(28);
          const split = await page.locator(".t3-wallet-split").boundingBox();
          expect(Math.abs(split!.y - 289)).toBeLessThan(1);
          const rows = page.locator(".t3-wallet-balances tbody tr");
          const first = await rows.nth(0).boundingBox();
          const second = await rows.nth(1).boundingBox();
          expect(Math.round(second!.y - first!.y)).toBe(52);
        } else {
          const selectedRow = await page.locator(".t3-wallet-balances tbody tr").first().boundingBox();
          expect(Math.abs(selectedRow!.height - (state === "okx" ? 58.5 : 51.1))).toBeLessThan(1);
          const movers = await page.locator(".t3-wallet-movers").boundingBox();
          const facts = await page.locator(".t3-wallet-facts").boundingBox();
          expect(Math.abs(movers!.y - (state === "okx" ? 500 : 429))).toBeLessThan(1);
          expect(Math.abs(movers!.height - (state === "okx" ? 120 : 200))).toBeLessThan(1);
          expect(Math.abs(facts!.y - (state === "okx" ? 649 : 658))).toBeLessThan(1);
          const amountCell = await page.locator(".t3-wallet-balances tbody tr:first-child td:first-of-type").boundingBox();
          expect(Math.abs(amountCell!.x + amountCell!.width - 400)).toBeLessThan(5);
          const footnote = await page.locator(".t3-wallet-side > p").boundingBox();
          await expect(page.locator(".t3-wallet-side > p")).toHaveText(
            "Amounts did not change in this range, so every change is price movement.");
          expect(footnote!.height).toBeLessThan(35);
          expect(await page.locator(".t3-wallet-side > p").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        }
      } finally {
        await context.close();
      }
    });
  }
});
