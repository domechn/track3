import { expect, test } from "@playwright/test";
import { fidelityRecoverySettings, seedSettingsB, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "lock-off", "recovery-missing", "rotate", "rotating", "rotated"] as const) {
  test(`Security ${state} desktop fidelity`, async ({ page }) => {
    await seedSettingsB(page, "security", state);
    await page.goto(settingsBRoute.security);
    if (state !== "recovery-missing") {
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForFunction(async () => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        return (await import(runtimeModule)).syncRuntime.status().mode !== "loading";
      });
      await page.evaluate(async (settings) => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        const outcome = await syncRuntime.configure(settings, "sample-passphrase-long-enough");
        if (outcome !== "ok") throw new Error(`Could not configure fake recovery bucket: ${outcome}`);
      }, fidelityRecoverySettings);
    }
    await expect(page.getByText("Encryption key", { exact: true })).toBeVisible();
    if (state === "default") {
      await expect(page.locator(".t3-b-security-list")).toContainText("track3-sync");
      await expect(page.getByRole("button", { name: "Export recovery file" })).toBeEnabled();
      await expect(page.locator(".t3-b-sync-scrim")).toHaveCount(0);
    }
    if (state === "rotate" || state === "rotating" || state === "rotated") {
      await page.getByRole("button", { name: "Rotate encryption key" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      if (state !== "rotate") {
        await page.evaluate((scenario) => {
          const original = (window as any).__e2eInvoke;
          (window as any).__e2eInvoke = (command: string, args: unknown, options: unknown) => {
            if (command === "rotate_encryption_key")
              return scenario === "rotating" ? new Promise(() => {}) : Promise.resolve(null);
            return original(command, args, options);
          };
        }, state);
        await page.locator("#security-new-key").fill("sample-new-key-7");
        await page.locator("#security-confirm-key").fill("sample-new-key-7");
        await page.getByRole("alertdialog").getByRole("button", { name: "Rotate key" }).click();
        if (state === "rotating") await expect(page.getByText("Saving", { exact: false })).toBeVisible();
        else await expect(page.getByText("New key is active", { exact: true })).toBeVisible();
      }
    }
    await settingsBShot(page, "security", state);
  });
}
