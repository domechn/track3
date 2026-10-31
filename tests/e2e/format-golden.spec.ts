// Regenerate the export fixture only from 0.9.4: UPDATE_GOLDEN=1 corepack yarn vitest run src/middlelayers/golden-export.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

const exportGolden = JSON.parse(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
const storageKeys = JSON.parse(readFileSync(resolve("src/test/golden/storage-keys.json"), "utf8")) as {
  exact: string[]; prefixes: string[];
};
const frozenStorageKeys = new Set(storageKeys.exact);
const frozenStorageKeyPrefixes = storageKeys.prefixes;

test("Settings export keeps the 0.9.4 JSON shape", async ({ page }) => {
  const bridge = await installTauriBridge(page, { goldenHistory: true, appVersion: "0.9.4" });
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText("Export data successfully", { exact: true })).toBeVisible();
  const written = bridge.exportedFile();
  expect(written).not.toBeNull();
  const actual = JSON.parse(written!);
  actual.exportAt = exportGolden.exportAt;
  actual.md5V2 = exportGolden.md5V2;
  expect(actual).toStrictEqual(exportGolden);
});

test("Settings imports the committed 0.9.4 file into History", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  // Current no-conflict flow reads the previous React state; a second click imports the selected file.
  await expect(page.getByText("No data to import", { exact: true })).toBeVisible();
  expect(bridge.historyIds()).toStrictEqual(["snapshot-new", "snapshot-old"]);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
  expect(bridge.historyIds()).toStrictEqual(["snapshot-000000", "snapshot-000001", "snapshot-new", "snapshot-old"]);
  await page.reload();
  await page.goto("/#/history");
  await page.getByRole("button", { name: "Choose date range" }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Total 4 records")).toBeVisible();
  await expect(page.getByRole("button", { name: "View snapshot from 2022-1-1 01:00:00" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View snapshot from 2022-1-1 00:00:00" })).toBeVisible();
});

test("visiting every desktop and mobile route writes only frozen storage keys", async ({ browser }) => {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    } : {});
    try {
      const page = await context.newPage();
      await installTauriBridge(page);
      for (const route of [
        "/overview", "/summary", "/wallets", "/comparison", "/rebalance",
        "/goals", "/history", "/cost-basis", "/assistant", "/assistant/session-golden",
        "/settings/configuration", "/settings/appearance", "/settings/data",
        "/settings/systemInfo", "/settings/assistant", "/settings/sync", "/coins/BTC",
        ...(mobile ? ["/more"] : []),
      ]) {
        await page.goto(`/#${route}`);
        await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-current-date-range")))
          .not.toBeNull();
        const keys = await page.evaluate(() => Object.keys(localStorage));
        expect(keys.filter((key) => !frozenStorageKeys.has(key) && !frozenStorageKeyPrefixes.some((prefix) => key.startsWith(prefix))),
          `${mobile ? "mobile" : "desktop"} ${route}`).toStrictEqual([]);
      }
    } finally {
      await context.close();
    }
  }
});

test("desktop and iPhone shells write the exact current date range JSON", async ({ browser }) => {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    } : {});
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { goldenHistory: true });
      await page.goto("/#/history");
      await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-current-date-range")), { timeout: 15_000 })
        .toBe('{"from":"2022-01-01","to":"2022-01-01"}');
    } finally {
      await context.close();
    }
  }
});
