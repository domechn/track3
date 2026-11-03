import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge, seedDesktopAiSummary, seedDesktopSourceStatuses } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/startup";
const states = ["error", "migrate", "recovery", "syncunlock", "syncunlock-error"] as const;

test("Startup desktop captures only real available states", async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  for (const state of states) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      const syncPassphrase = "local example passphrase";
      const s3 = new FakeS3();
      const { header } = await createSyncHeader(syncPassphrase);
      await writeSyncHeader(s3, header);
      await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: state !== "error" && state !== "migrate",
        routeDemoR2ToFakeS3: true, s3 });
      await seedDesktopSourceStatuses(page);
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
      }));
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
      }));
      await seedDesktopAiSummary(page);
      if (state === "error") await page.route("**/src/components/overview.tsx*", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const needle = "  _s();\n  const { t } = useTranslation();";
        if (!body.includes(needle)) throw new Error("Could not inject the test renderer failure");
        await route.fulfill({ response, body: body.replace(needle,
          '  _s();\n  throw new TypeError("Cannot read properties of undefined (reading value)");') });
      });
      if (state === "migrate") await page.addInitScript(() => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (cmd: string, args: { query?: string }, ...rest: unknown[]) => {
          if (cmd === "plugin:sql|select" && /assets_v2/i.test(args.query ?? "")) {
            await new Promise((resolve) => setTimeout(resolve, 8000));
          }
          return original(cmd, args, ...rest);
        };
      });
      if (state === "syncunlock" || state === "syncunlock-error") await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "UPDATE configuration SET data = ? WHERE id = 991",
        values: ['!ent:e2e:{"enabled":true,"endpoint":"https://demo.r2.cloudflarestorage.com","bucket":"track3","region":"us-east-1","accessKeyId":"e2e-access","secretAccessKey":"e2e-secret"}'],
      }));
      await page.goto("/#/overview");
      if (state === "error") {
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("button", { name: "Copy details" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
      } else if (state === "migrate") await expect(page.getByRole("status", { name: "Loading overview" })).toBeVisible({ timeout: 30_000 });
      else await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      if (state === "recovery" || state === "syncunlock" || state === "syncunlock-error") {
        await expect(page.getByRole("heading", { name: "Sync is locked" })).toBeVisible();
        await expect(page.getByLabel("Sync passphrase")).toBeVisible();
        if (state === "syncunlock-error") {
          await page.getByLabel("Sync passphrase").fill("incorrect test passphrase");
          await page.getByRole("button", { name: "Unlock", exact: true }).click();
          await expect(page.getByRole("alert")).toContainText("That passphrase does not unlock this bucket.");
        }
        if (state === "recovery") {
          await page.getByLabel("Sync passphrase").fill(syncPassphrase);
          await page.getByRole("button", { name: /^Unlock( sync)?$/ }).click();
          await expect(page.getByRole("heading", { name: "Sync is locked" })).toHaveCount(0);
          await page.locator(".desktop-sync-status-indicator button").first().click();
          const exportRecovery = page.getByRole("button", { name: "Save recovery file" });
          await expect(exportRecovery).toBeVisible({ timeout: 5_000 });
          await exportRecovery.click();
          await expect(page.getByRole("dialog", { name: "Save your recovery file" })).toBeVisible();
          await expect(page.getByLabel("Current sync passphrase")).toBeVisible();
          await expect(page.getByLabel("Recovery file passphrase", { exact: true })).toBeVisible();
          const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          expect(a11y.violations).toEqual([]);
        }
        if (state === "syncunlock") await page.getByLabel("Sync passphrase").fill(syncPassphrase);
      }
      await page.screenshot({ path: `${output}/startup-${state}-desktop.png`, fullPage: true, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});
