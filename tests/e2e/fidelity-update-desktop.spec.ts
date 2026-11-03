import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge, seedDesktopAiSummary, seedDesktopSourceStatuses } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/update";
const states = ["toast", "notes", "downloading", "ready", "failed", "toasts"] as const;
const body = [
  "## New",
  "- Refresh shows progress for each source, with a reason and Retry for any that fail.",
  "- Totals say which source is missing instead of leaving it out silently.",
  "- Sync status lists errors grouped by cause, with Copy diagnostics.",
  "## Fixed",
  "- History keeps its page after you delete a snapshot and undo.",
  "- Cost basis CSV exports use the selected tax year.",
  "## Under the hood",
  "- Database format moves from schema 14 to 15. Track3 saves a backup before it migrates.",
].join("\n");

test("Update desktop captures real updater controls using a local plugin fixture", async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  for (const state of states) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, colorScheme: "dark",
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await installTauriBridge(page, { fidelitySample: "full", appVersion: "2.3.1" });
      await seedDesktopSourceStatuses(page);
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
      }));
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
      }));
      await seedDesktopAiSummary(page);
      await page.addInitScript(({ state, body }) => {
        const tauri = (window as any).__TAURI_INTERNALS__;
        const original = tauri.invoke;
        tauri.invoke = (cmd: string, args: any, options: unknown) => {
          if (cmd === "plugin:updater|check") {
            return Promise.resolve({ rid: 84, currentVersion: "2.3.1", version: "2.4.0", date: "2026-10-29", body });
          }
          if (cmd === "plugin:updater|download_and_install") {
            args.onEvent.onmessage({ event: "Started", data: { contentLength: 84_200_000 } });
            args.onEvent.onmessage({ event: "Progress", data: { chunkLength: 38_000_000 } });
            if (state === "downloading") return new Promise(() => {});
            if (state === "failed") return Promise.reject(new Error("local fixture connection reset"));
            return Promise.resolve(null);
          }
          return original(cmd, args, options);
        };
      }, { state, body });
      await page.goto("/#/overview");
      await expect(page.getByRole("button", { name: "See what's new" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      if (state === "notes" || state === "downloading" || state === "ready" || state === "failed") {
        await page.getByRole("button", { name: "See what's new" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
      if (state === "downloading" || state === "ready" || state === "failed") {
        await page.getByRole("button", { name: "Download and install" }).click();
        await expect(page.getByRole("heading", { name: state === "ready" ? "Ready to restart" :
          state === "failed" ? "Update failed" : "Downloading Track3 2.4.0" })).toBeVisible();
      }
      await page.screenshot({ path: `${output}/update-${state}-desktop.png`, fullPage: true, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});
