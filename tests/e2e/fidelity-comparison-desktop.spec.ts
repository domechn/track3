import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";

const output = "/tmp/fidelity-desktop/comparison";

async function openComparison(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  const syncPassphrase = "local fidelity comparison passphrase";
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
  await page.goto("/#/comparison");
  await expect(page.locator(".t3-cmp-actions .desktop-sync-status-indicator button")).toBeVisible({ timeout: 30_000 });
  if (!await page.getByLabel("Sync passphrase").isVisible()) {
    await page.locator(".t3-cmp-actions .desktop-sync-status-indicator button").click();
  }
  await page.getByLabel("Sync passphrase").fill(syncPassphrase);
  await page.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
  await expect(page.getByRole("heading", { name: "Comparison" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(async () => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(runtimeModule);
    return syncRuntime.status().mode === "ready" && syncRuntime.status().sync.lastSync !== undefined &&
      syncRuntime.status().sync.phase === "idle";
  }, undefined, { timeout: 60_000 });
  await expect(page.locator(".t3-cmp-actions .desktop-sync-status-indicator button"))
    .toContainText("Synced 09:41", { timeout: 60_000 });
  await expect(page.locator(".t3-cmp-actions .t3-topbar-sync-button svg[data-icon='check']")).toBeVisible();
}

test.describe("Comparison desktop fidelity", () => {
  test("keeps unchanged USD 60000 cash ahead of 25 visible changing junk coins", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.evaluate(async () => {
        const run = (query: string, values: unknown[]) =>
          (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
        const insert = `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        for (const [uuid, at, isHead] of [
          ["fidelity-day-0", "2026-10-01T09:41:00.000Z", false],
          ["fidelity-day-30", "2026-10-31T09:41:00.000Z", true],
        ] as const) {
          await run(insert, [uuid, at, "22222222222222222222222222222222", "stock", "USD", 60000, 60000, 1]);
          for (let index = 0; index < 25; index++) {
            const base = index === 0 ? 10 : 2;
            const value = base + (isHead ? index === 0 ? 0.1 : (index + 1) / 1000 : 0);
            await run(insert, [uuid, at, "11111111111111111111111111111111",
              "crypto", `JUNK${index}`, 1, value, value]);
          }
        }
      });
      await page.goto("/#/comparison");
      const assets = page.locator(".t3-cmp-assets");
      await expect(assets.locator("tbody tr").filter({ hasText: "JUNK" })).toHaveCount(25);
      const symbols = await assets.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => row.querySelector("th")?.firstChild?.textContent?.trim() ?? ""));
      const cashIndex = symbols.indexOf("USD");
      expect(cashIndex).toBeGreaterThanOrEqual(0);
      expect(symbols.filter((symbol) => symbol.startsWith("JUNK"))).toHaveLength(25);
      for (const [index, symbol] of symbols.entries()) {
        if (symbol.startsWith("JUNK")) expect(index).toBeGreaterThan(cashIndex);
      }
      await assets.getByRole("combobox", { name: "Sort assets" }).selectOption("valueChange");
      const changed = await assets.locator("tbody tr").evaluateAll((rows) =>
        rows.map((row) => row.querySelector("th")?.firstChild?.textContent?.trim() ?? ""));
      expect(changed.indexOf("USD")).toBeGreaterThan(changed.indexOf("JUNK0"));
    } finally {
      await context.close();
    }
  });

  test("twenty saved dust rows are hidden until the footer toggle is used", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.evaluate(async () => {
        const run = (query: string, values: unknown[]) =>
          (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
        const insert = `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES ('fidelity-day-30', '2026-10-31T09:41:00.000Z', '11111111111111111111111111111111',
            'crypto', ?, 1, 0.4, 0.4)`;
        for (let index = 0; index < 20; index++) await run(insert, [`DUST${index}`]);
      });
      await page.goto("/#/comparison");
      const assets = page.locator(".t3-cmp-assets");
      await expect(assets.getByTestId("small-holdings-toggle")).toHaveText("Show 20 small holdings");
      await expect(assets.locator("tbody tr").filter({ hasText: "DUST" })).toHaveCount(0);
      const total = await assets.locator("tfoot").innerText();
      await assets.getByTestId("small-holdings-toggle").click();
      await expect(assets.locator("tbody tr").filter({ hasText: "DUST" })).toHaveCount(20);
      expect(await assets.locator("tfoot").innerText()).toBe(total);
    } finally {
      await context.close();
    }
  });
  test("1001px CNY legacy table keeps each amount on one line", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({ viewport: { width: 1001, height: 900 }, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.evaluate(async () => {
        const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
        await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
        await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
      });
      await page.goto("/#/comparison");
      const cells = page.locator(".comparison-assets-table tbody td");
      await expect(cells.first()).toBeVisible({ timeout: 40_000 });
      const measures = await cells.evaluateAll((elements) => elements.map((element) => {
        const range = document.createRange();
        range.selectNode(element.firstChild ?? element);
        const style = getComputedStyle(element);
        return { text: element.textContent ?? "", lines: range.getBoundingClientRect().height / parseFloat(style.lineHeight) };
      }));
      expect(measures.some(({ text }) => text.includes("¥"))).toBe(true);
      for (const cell of measures) expect(cell.text).not.toMatch(/[+−-]?¥\s/);
      for (const cell of measures) expect(cell.lines, cell.text).toBeLessThanOrEqual(1.2);
    } finally { await context.close(); }
  });

  test("shows the sync unlock prompt from the visible page indicator", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { seedLockedSync: true });
      await page.goto("/#/comparison");
      await expect(page.getByLabel("Sync passphrase")).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".t3-cmp-actions .desktop-sync-status-indicator")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("calendar uses the selected Chinese locale", async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name !== "desktop");
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.goto("/#/comparison");
      await page.locator(".t3-cmp-picker-trigger").first().click();
      await expect(page.locator(".t3-cmp-calendar-head strong")).toContainText("2026年10月");
      await expect(page.locator(".t3-cmp-calendar-weekdays")).toContainText("周一");
    } finally {
      await context.close();
    }
  });
  for (const picker of [false, true]) {
    test(picker ? "picker" : "default", async ({ browser }, testInfo) => {
      test.setTimeout(120_000);
      test.skip(testInfo.project.name !== "desktop");
      mkdirSync(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1600, height: 900 }, colorScheme: "dark",
        reducedMotion: "reduce", timezoneId: "UTC",
      });
      try {
        const page = await context.newPage();
        await openComparison(page);
        await expect(page.locator(".t3-cmp-legacy")).toHaveCount(0);
        if (await page.getByRole("radio", { name: "1M" }).count()) {
          await page.getByRole("radio", { name: "1M" }).click();
        }
        await expect(page.locator(".analyze-comparison")).toContainText(/\$\s?729,167\.79/);
        await expect(page.locator(".t3-cmp-info")).toBeVisible();
        if (!picker) {
          await page.locator(".t3-cmp-assets").hover();
          const caption = await page.locator(".t3-cmp-assets .t3-cmp-card-head > span").boundingBox();
          const eye = await page.locator(".t3-cmp-mask").boundingBox();
          expect(caption!.x + caption!.width).toBeLessThanOrEqual(eye!.x);
        }
        if (picker) {
          await page.getByRole("button", { name: /Base Date|Snapshot A/ }).click();
          await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
        }
        await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
        if (!picker) await page.mouse.move(800, 20);
        await page.screenshot({ path: `${output}/comparison${picker ? "-picker" : ""}-desktop.png`, fullPage: true });
        await expect(page.getByRole("heading", { name: "Snapshots" })).toBeVisible();
        if (picker) await expect(page.getByRole("dialog")).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
});
