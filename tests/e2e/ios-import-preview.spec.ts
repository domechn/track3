import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("iOS reviews a 0.9.4 export in Chinese", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "逐条检查快照" }).click();
  const review = page.getByRole("dialog", { name: "逐条检查快照" });
  await expect(review).toBeVisible();
  await expect(review.getByText("新", { exact: true })).toHaveCount(2);
  const applyBounds = await review.getByRole("button", { name: "应用所选操作" }).boundingBox();
  expect(applyBounds).not.toBeNull();
  expect(applyBounds!.y + applyBounds!.height).toBeLessThanOrEqual(836);
  await review.getByRole("button", { name: "应用所选操作" }).click();
  await expect(review).toBeHidden();
  expect(bridge.historyIds()).toEqual(["snapshot-000000", "snapshot-000001", "snapshot-new", "snapshot-old"]);
});

test("iOS confirms before replacing a local snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  const originalValue = bridge.snapshotValue();
  const payload = {
    exportAt: "2024-01-03T00:00:00.000Z", client: "fixture", clientVersion: "0.9.4",
    historicalData: [{
      createdAt: "2024-01-01T00:00:00.000Z", total: 50000,
      assets: [{ id: 77, uuid: "snapshot-old", createdAt: "2024-01-01T00:00:00.000Z",
        wallet: "wallet-1", asset_type: "crypto", symbol: "BTC", amount: 1, value: 50000, price: 50000 }],
      transactions: [],
    }],
    configuration: undefined,
  };
  bridge.setImportFile(JSON.stringify({ ...payload, md5V2: md5(JSON.stringify({ data: JSON.stringify(payload) })) }));
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "逐条检查快照" }).click();
  const review = page.getByRole("dialog", { name: "逐条检查快照" });
  await review.getByRole("combobox").selectOption("replace");
  await review.getByRole("button", { name: "应用所选操作" }).click();
  const confirm = page.getByRole("alertdialog", { name: "替换本地快照？" });
  await expect(confirm).toContainText("已选 1 条");
  expect(bridge.snapshotValue()).toBe(originalValue);
  await confirm.getByRole("button", { name: "取消" }).click();
  expect(bridge.snapshotValue()).toBe(originalValue);
  await review.getByRole("button", { name: "应用所选操作" }).click();
  await confirm.getByRole("button", { name: "确认替换" }).click();
  await expect(review).toBeHidden();
  expect(bridge.snapshotValue()).toBe(50000);
});

test("iOS backup and review screens are captured in light and dark", async ({ page }) => {
  test.setTimeout(120_000);
  const bridge = await installTauriBridge(page, { appVersion: "0.9.4" });
  bridge.setImportFile(readFileSync(resolve("tests/golden/export-0.9.4.json"), "utf8"));
  mkdirSync("test-results/p5-screens", { recursive: true });
  await page.goto("/#/settings/data?section=backup");
  for (const width of [390, 834]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1112 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((next) => localStorage.setItem("track3-ui-theme", next), theme);
      await page.reload();
      await expect(page.getByRole("button", { name: "Review snapshots" })).toBeVisible();
      await page.screenshot({ path: `test-results/p5-screens/ios-${width}-${theme}-backup.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Review snapshots" }).click();
      const review = page.getByRole("dialog", { name: "Review snapshots" });
      await expect(review).toBeVisible();
      await page.screenshot({ path: `test-results/p5-screens/ios-${width}-${theme}-review.png`, animations: "disabled" });
      await review.getByRole("button", { name: "Cancel" }).click();
    }
  }
});
