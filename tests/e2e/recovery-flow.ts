import { expect, type Page } from "@playwright/test";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge } from "./tauri-bridge";

export async function exerciseRecoveryFile(page: Page) {
  const syncPassphrase = "sync passphrase long enough";
  const filePassphrase = "separate file passphrase";
  const { header, key } = await createSyncHeader(syncPassphrase);
  const s3 = new FakeS3();
  await writeSyncHeader(s3, header);
  const bridge = await installTauriBridge(page, { seedLockedSync: true, s3 });
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await page.goto("/#/settings/sync");
  await expect(page.locator(".sync-settings-page")).toBeVisible();
  const skip = page.getByRole("button", { name: "Skip for now" });
  if (await skip.isVisible()) await skip.click();
  await page.locator(".sync-settings-page").getByLabel("Sync passphrase").fill(syncPassphrase);
  await page.locator(".sync-settings-page").getByRole("button", { name: "Unlock sync" }).click();
  await expect(page.locator(".sync-settings-page")).toContainText("Sync is unlocked for this app session");

  await page.evaluate(() => { location.hash = "#/settings/data?section=security"; });
  await expect(page.getByText("Sync recovery file", { exact: true })).toBeVisible();
  await page.getByLabel("Current sync passphrase").fill(syncPassphrase);
  await page.getByLabel("Recovery file passphrase", { exact: true }).fill(filePassphrase);
  await page.getByLabel("Confirm recovery file passphrase", { exact: true }).fill(filePassphrase);
  await page.getByRole("button", { name: "Export recovery file" }).click();
  await expect(page.getByText("Encrypted recovery file exported.")).toBeVisible();
  const file = bridge.exportedFile();
  expect(file).toBeTruthy();
  expect(JSON.parse(file!).format).toBe("track3-sync-recovery");
  const diagnostics = await page.evaluate(async () => {
    const runtimeModule = "/src/middlelayers/sync/runtime.ts";
    const { syncRuntime } = await import(runtimeModule);
    return JSON.stringify(syncRuntime.status().sync.diagnostics ?? {});
  });
  for (const secret of [
    syncPassphrase, filePassphrase, Buffer.from(key).toString("base64"), Buffer.from(key).toString("hex"),
    "e2e-access", "e2e-secret", "https://s3.example.test",
  ]) {
    expect(file).not.toContain(secret);
    expect(logs.join("\n")).not.toContain(secret);
    expect(diagnostics).not.toContain(secret);
  }

  if (/iPhone|iPad|iPod/.test(await page.evaluate(() => navigator.userAgent))) {
    expect(bridge.authentications()).toBe(1);
    expect(bridge.shares()).toBe(1);
  }
  bridge.setImportFile(file!, "track3-sync-recovery.t3key");
  await page.goto("/#/settings/sync");
  await page.reload();
  await expect(page.locator(".sync-settings-page")).toBeVisible();
  const skipAgain = page.getByRole("button", { name: "Skip for now" });
  if (await skipAgain.isVisible()) await skipAgain.click();
  await page.locator(".sync-settings-page").getByRole("button", { name: "Use recovery file" }).click();
  await page.locator(".sync-settings-page").getByRole("button", { name: "Choose .t3key file" }).click();
  await page.locator(".sync-settings-page").getByLabel("Recovery file passphrase", { exact: true }).fill(filePassphrase);
  await page.locator(".sync-settings-page").getByRole("button", { name: "Unlock with recovery file" }).click();
  await expect(page.locator(".sync-settings-page")).toContainText("Sync is unlocked for this app session");
  await page.getByRole("switch", { name: "Snapshot history" }).click();
  await page.locator(".t3-sync-categories").getByRole("button", { name: "Save sync settings" }).click();
  await expect(page.locator(".sync-settings-page").getByRole("status").filter({ hasText: "Sync settings saved." })).toBeVisible();
}
