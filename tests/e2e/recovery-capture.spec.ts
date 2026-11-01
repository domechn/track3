import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const output = "/tmp/track3-p9-screenshots";
mkdirSync(output, { recursive: true });

for (const [size, width, height, mobile] of [
  ["desktop-1440", 1440, 900, false],
  ["desktop-1024", 1024, 768, false],
  ["phone-390", 390, 844, true],
  ["tablet-834", 834, 1194, true],
] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`capture recovery screens ${size} ${theme}`, async ({ browser }) => {
      test.skip(process.env.TRACK3_CAPTURE !== "1");
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce",
        ...(mobile ? {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          isMobile: true, hasTouch: true,
        } : {}),
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        const bridge = await installTauriBridge(page, { seedLockedSync: true, richPortfolio: true });
        bridge.setImportFile("{}");
        await page.goto("/#/overview");
        await expect(page.getByRole("button", { name: "Sync locked" })).toBeVisible();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "Use recovery file" }).click({ force: true });
        await page.getByRole("dialog").getByRole("button", { name: "Choose .t3key file" }).click({ force: true });
        await expect(page.getByRole("dialog").getByLabel("Recovery file passphrase")).toBeVisible();
        await page.screenshot({ path: `${output}/${size}-${theme}-unlock-popover.png`, animations: "disabled" });

        await page.goto("/#/settings/sync");
        await expect(page.locator(".sync-settings-page")).toBeVisible();
        const skip = page.getByRole("button", { name: "Skip for now" });
        if (await skip.isVisible()) await skip.click();
        await page.locator(".sync-settings-page").getByRole("button", { name: "Use recovery file" }).click();
        await page.locator(".sync-settings-page").getByRole("button", { name: "Choose .t3key file" }).click();
        await expect(page.locator(".sync-settings-page").getByLabel("Recovery file passphrase")).toBeVisible();
        await page.screenshot({ path: `${output}/${size}-${theme}-sync-locked.png`, fullPage: true, animations: "disabled" });

        await page.goto("/#/settings/data?section=security");
        await page.evaluate(async () => {
          const runtimeModule = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          (syncRuntime as any).publish("ready");
        });
        await expect(page.getByText("Sync recovery file", { exact: true })).toBeVisible();
        await page.screenshot({ path: `${output}/${size}-${theme}-security.png`, fullPage: true, animations: "disabled" });
      } finally {
        await context.close();
      }
    });
  }
}
