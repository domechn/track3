import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge } from "./tauri-bridge";

test("sync snapshot import restores prices with remapped asset IDs", async ({ page }) => {
  const bridge = await installTauriBridge(page);
  await page.goto("/#/settings/data");
  const imported = await page.evaluate(() => (window as any).__TAURI_INTERNALS__.invoke("import_sync_snapshot", {
    snapshot: {
      uuid: "priced-import",
      assets: [{ id: 77, uuid: "priced-import", createdAt: "2024-01-01T00:00:00.000Z",
        wallet: "wallet-1", asset_type: "crypto", symbol: "BTC", amount: 1, value: 10, price: 10 }],
      prices: [
        { uuid: "priced-import", assetID: 77, symbol: "BTC", price: 8, assetCreatedAt: "2024-01-01", updatedAt: "2024-01-02" },
        { uuid: "priced-import", assetID: 999, symbol: "ETH", price: 3, assetCreatedAt: "2024-01-01", updatedAt: "2024-01-02" },
      ],
      transactions: [],
    },
  }));
  expect(imported).toBe(true);
  expect(bridge.snapshotPrices("priced-import")).toEqual([8]);
});

test("the fake rejects file prices when replacing local cost prices", async ({ page }) => {
  const bridge = await installTauriBridge(page);
  await page.goto("/#/settings/data");
  await expect(page.evaluate(() => (window as any).__TAURI_INTERNALS__.invoke("replace_import_snapshot", {
    snapshot: {
      uuid: "snapshot-old",
      assets: [{ id: 77, uuid: "snapshot-old", createdAt: "2024-01-01T00:00:00.000Z",
        wallet: "wallet-1", asset_type: "crypto", symbol: "BTC", amount: 1, value: 10, price: 10 }],
      prices: [{ uuid: "snapshot-old", assetID: 77, symbol: "BTC", price: 8, assetCreatedAt: "2024-01-01", updatedAt: "2024-01-02" }],
      transactions: [],
    },
  }))).rejects.toThrow("Import file cannot replace local cost prices");
  expect(bridge.snapshotPrices("snapshot-old")).toEqual([]);
});

test("reviews a 0.9.4 export and imports its new snapshots in one action", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Review snapshots" }).click();
  const review = page.getByRole("dialog", { name: "Review snapshots" });
  await expect(review).toBeVisible();
  await expect(review.getByText("New", { exact: true })).toHaveCount(2);
  await review.getByRole("button", { name: "Apply selected choices" }).click();
  await expect(review).toBeHidden();
  expect(bridge.historyIds()).toEqual(["snapshot-000000", "snapshot-000001", "snapshot-new", "snapshot-old"]);
});

test("known-bug: legacy Ignore import drops a file transaction when its ID belongs to another snapshot", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.seedTransactionIdCollision();
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Review snapshots" }).click();
  const review = page.getByRole("dialog", { name: "Review snapshots" });
  await expect(review.getByRole("alert")).toContainText("1 transaction ID");
  await review.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
  expect(bridge.transactionUuids()).toEqual(["snapshot-old"]);
  expect(bridge.historyIds()).toEqual(["snapshot-000000", "snapshot-000001", "snapshot-new", "snapshot-old"]);
});

test("Replace with file retains the local cost price", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.seedCostPrice();
  const payload = {
    exportAt: "2024-01-03T00:00:00.000Z", client: "fixture", clientVersion: "0.9.4",
    historicalData: [{
      createdAt: "2024-01-01T00:00:00.000Z", total: 50000,
      assets: [{
        id: 77, uuid: "snapshot-old", createdAt: "2024-01-01T00:00:00.000Z",
        wallet: "wallet-1", asset_type: "crypto", symbol: "BTC", amount: 1, value: 50000, price: 50000,
      }],
      transactions: [],
    }],
    configuration: undefined,
  };
  bridge.setImportFile(JSON.stringify({ ...payload, md5V2: md5(JSON.stringify({ data: JSON.stringify(payload) })) }));
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Review snapshots" }).click();
  const review = page.getByRole("dialog", { name: "Review snapshots" });
  await expect(review.getByText("Different", { exact: true })).toBeVisible();
  await review.getByRole("combobox").selectOption("replace");
  await review.getByRole("button", { name: "Apply selected choices" }).click();
  await expect(page.getByText(/1 selected/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(review).toBeHidden();
  expect(bridge.snapshotValue()).toBe(50000);
  expect(bridge.costPrice()).toBe(123);
});

test("a failed snapshot is reported while an earlier snapshot stays imported", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  const asset = (uuid: string, id: number) => ({
    id, uuid, createdAt: "2024-01-01T00:00:00.000Z", wallet: "wallet-1",
    asset_type: "crypto", symbol: "BTC", amount: 1, value: 1, price: 1,
  });
  const payload = {
    exportAt: "2024-01-03T00:00:00.000Z", client: "fixture", clientVersion: "0.9.4",
    historicalData: [
      { createdAt: "2024-01-01T00:00:00.000Z", total: 1, assets: [asset("import-ok", 31)], transactions: [] },
      { createdAt: "2024-01-02T00:00:00.000Z", total: 1, assets: [asset("import-fails", 32)], transactions: [{
        id: 90, uuid: "import-fails", assetID: 999, asset_type: "crypto", wallet: "wallet-1",
        symbol: "BTC", amount: 1, price: 1, txnType: "buy", txnCreatedAt: "2024-01-02T00:00:00.000Z",
        createdAt: "2024-01-02T00:00:00.000Z", updatedAt: "2024-01-02T00:00:00.000Z",
      }] },
    ],
    configuration: undefined,
  };
  bridge.setImportFile(JSON.stringify({ ...payload, md5V2: md5(JSON.stringify({ data: JSON.stringify(payload) })) }));
  await page.goto("/#/settings/data");
  await page.getByRole("button", { name: "Review snapshots" }).click();
  const review = page.getByRole("dialog", { name: "Review snapshots" });
  await review.getByRole("button", { name: "Apply selected choices" }).click();
  await expect(review.getByRole("status")).toContainText("1 imported");
  await expect(review.getByText(/import-fails: The file has a transaction without a matching asset/)).toBeVisible();
  expect(bridge.historyIds()).toEqual(["import-ok", "snapshot-new", "snapshot-old"]);
  await review.getByRole("button", { name: "Apply selected choices" }).click();
  await expect(review.getByRole("status")).toContainText("1 skipped");
  await expect(review.getByText(/import-fails: The file has a transaction without a matching asset/)).toBeVisible();
  await expect(review.getByText(/import-ok: Import choice no longer matches/)).toHaveCount(0);
});

test("desktop backup and review screens are captured in light and dark", async ({ page }) => {
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  mkdirSync("test-results/p5-screens", { recursive: true });
  await page.goto("/#/settings/data");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((next) => localStorage.setItem("track3-ui-theme", next), theme);
      await page.reload();
      await expect(page.getByRole("button", { name: "Review snapshots" })).toBeVisible();
      await page.screenshot({ path: `test-results/p5-screens/desktop-${width}-${theme}-backup.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Review snapshots" }).click();
      const review = page.getByRole("dialog", { name: "Review snapshots" });
      await expect(review).toBeVisible();
      await page.screenshot({ path: `test-results/p5-screens/desktop-${width}-${theme}-review.png`, animations: "disabled" });
      await review.getByRole("button", { name: "Cancel" }).click();
    }
  }
});
