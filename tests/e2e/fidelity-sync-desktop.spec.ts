import { expect, test } from "@playwright/test";
import { fidelitySyncSettings, seedSettingsB, settingsBSql, settingsBRoute, settingsBShot } from "./fidelity-settings-b-scenes";
import { FakeS3 } from "../../src/middlelayers/sync/object-store";
import { expectSettingsCardsFitContent } from "./settings-card-layout-scenes";

test.use({ viewport: { width: 1600, height: 777 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

for (const state of ["default", "setup", "locked", "loading", "testing", "test-fail", "rename", "confirm-use", "disable", "forget", "toast", "pop-never", "pop-syncing", "pop-ok", "pop-error", "pop-locked", "pop-stopped"] as const) {
  test(`Sync ${state} desktop fidelity`, async ({ page }) => {
    const realConflict = state === "default" || state === "confirm-use" || state === "disable" || state.startsWith("pop-") && state !== "pop-locked";
    const bucket = realConflict ? new FakeS3() : undefined;
    if (bucket) {
      const other = await page.context().newPage();
      await seedSettingsB(other, "sync", "default", "dark", bucket);
      await settingsBSql(other, "INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'EUR'), (6, '50')");
      await settingsBSql(other, "UPDATE sync_state SET data = ? WHERE id = 1",
        [JSON.stringify({ deviceId: "abcdef01-2345-6789-abcd-ef0123456789", known: [] })]);
      await other.goto(settingsBRoute.sync);
      await other.waitForFunction(async () => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        return (await import(runtimeModule)).syncRuntime.status().mode !== "loading";
      });
      await other.evaluate(async (settings) => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        const outcome = await syncRuntime.configure(settings, "sample-passphrase-long-enough");
        if (outcome !== "ok") throw new Error(`Fake other device could not connect: ${outcome}`);
        await syncRuntime.syncNow();
      }, { ...fidelitySyncSettings, categories: { history: false, settings: true, secrets: false, rebalance: false, chat: false } });
      await other.waitForFunction(async () => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        const sync = syncRuntime.status().sync;
        return sync.phase === "idle" && !!sync.report?.pushed;
      });
      await other.close();
    }
    await seedSettingsB(page, "sync", state, "dark", bucket);
    if (realConflict) await settingsBSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'USD'), (6, '30')");
    if (state === "loading") {
      await page.goto("/#/overview");
      await page.evaluate(async () => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        (syncRuntime as any).devices = () => new Promise(() => {});
        (syncRuntime as any).configConflicts = () => new Promise(() => {});
        window.location.hash = "#/settings/sync";
      });
    } else await page.goto(settingsBRoute.sync);
    await expect(page.locator(".sync-settings-page")).toBeVisible({ timeout: 20000 });
    if (state !== "setup" && state !== "locked" && state !== "pop-locked") {
      const skip = page.getByRole("button", { name: "Skip for now" });
      await expect(skip).toBeVisible({ timeout: 10000 });
      await skip.click();
      if (realConflict) {
        await page.evaluate(async () => {
          const runtimeModule = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModule);
          const outcome = await syncRuntime.unlock("sample-passphrase-long-enough");
          if (outcome !== "ok") throw new Error(`Fake current device could not unlock: ${outcome}`);
          await syncRuntime.syncNow();
        });
      }
      const phase = state === "pop-syncing" ? "syncing" : state === "pop-error" || state === "pop-stopped" ? "error" : "idle";
      await page.evaluate(async ({ phase, state }) => {
        const runtimeModule = "/src/middlelayers/sync/runtime.ts";
        const { syncRuntime } = await import(runtimeModule);
        const failures = state === "pop-error" || state === "pop-stopped";
        const errors = failures ? [
          ...Array.from({ length: 14 }, () => "Failed to push snapshot object"),
          ...Array.from({ length: 6 }, () => "Failed to write sync manifest"),
          ...Array.from({ length: 2 }, () => "Failed to verify snapshot object"),
        ] : [];
        const report = { pulled: 0, pushed: 312, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors,
          devices: [
            { id: "01234567-89ab-cdef-0123-456789abcdef", name: "Dom’s MacBook Pro", lastUpload: "2026-10-31T09:41:00.000Z" },
            { id: "abcdef01-2345-6789-abcd-ef0123456789", name: "iPhone 15 Pro", lastUpload: "2026-10-30T22:07:00.000Z" },
          ] };
        const diagnostics = failures ? (() => {
          const phases = Object.fromEntries([
            "headerRead", "keyDerivation", "discover", "manifestsDownload", "pull",
            "localScan", "stateSave", "push", "manifestWrite", "prune",
          ].map((name) => [name, 0]));
          phases.localScan = 900;
          phases.keyDerivation = 6200;
          phases.push = 252000;
          const outcomes = [
            "ok", "notModified", "notFound", "preconditionFailed", "conflict",
            "rateLimited", "serverError", "timeout", "retry", "otherError",
          ];
          const requests = Object.fromEntries(["GET", "PUT", "LIST", "DELETE", "HEAD"].map((verb) =>
            [verb, { count: 0, bytesSent: 0, bytesReceived: 0,
              outcomes: Object.fromEntries(outcomes.map((outcome) => [outcome, { count: 0, bytesSent: 0, bytesReceived: 0 }])) }]));
          requests.PUT.count = 3924;
          requests.PUT.outcomes.ok.count = 3902;
          requests.PUT.outcomes.timeout.count = 14;
          requests.PUT.outcomes.otherError.count = 8;
          requests.GET.count = 52;
          requests.GET.outcomes.ok.count = 52;
          requests.LIST.count = 6;
          requests.LIST.outcomes.ok.count = 6;
          return { wallMs: 259100, phases, requests, retries: 2, retryWaitMs: 240000,
            timeouts: 14, syncStateBytes: 38200000, snapshots: 312, entries: 4567, knownTokens: 4567,
            slowest: [{ verb: "PUT", phase: "push", ms: 30000 }, { verb: "PUT", phase: "push", ms: 30000 },
              { verb: "PUT", phase: "manifestWrite", ms: 8400 }] };
        })() : undefined;
        (syncRuntime as any).publish("ready", {
          phase,
          ...(state === "pop-never" ? {} : { report }),
          ...(phase === "syncing" ? { startedAt: Date.now() - 134000, progress: { phase: "push", completed: 1240, total: 4567 } } : {}),
          ...(phase === "error" ? { error: "timeout", retryStopped: state === "pop-stopped", diagnostics } : {}),
          ...(state === "pop-never" ? {} : { lastSync: Date.parse("2026-10-31T09:41:00.000Z") }),
        });
      }, { phase, state });
    }
    await expect(page.getByText("What to sync", { exact: true })).toBeVisible({ timeout: 15000 });
    if (state === "loading") {
      await expect(page.locator(".t3-sync-devices .t3-b-sync-skeleton").first()).toBeVisible();
      await expect(page.locator(".t3-sync-categories [role=switch]")).toHaveCount(5);
    }
    if (realConflict) {
      await expect(page.locator(".t3-sync-conflicts")).toContainText("Base currency");
      await expect(page.locator(".t3-sync-conflicts")).toContainText("History count");
    }
    if (["pop-ok", "pop-syncing", "pop-stopped"].includes(state)) {
      await expect(page.locator(".sync-device-row")).toHaveCount(2);
      await expect(page.locator(".t3-sync-categories [role=switch]")).toHaveCount(5);
      await expect(page.locator(".t3-sync-devices .t3-b-sync-skeleton")).toHaveCount(0);
    }
    if (state === "default") {
      await expect(page.locator(".t3-sync-connection .t3-b-pill.connected")).toHaveText("Connected");
      await expect(page.locator(".t3-sync-passphrase .t3-b-pill.connected")).toHaveText("Unlocked");
      await expect(page.locator(".t3-sync-conflicts")).toContainText("Base currency");
      await expect(page.locator(".t3-sync-conflicts")).toContainText("History count");
      await expect(page.locator(".t3-sync-conflicts")).toContainText("2 to resolve");
      const conflictRow = page.locator(".t3-b-sync-conflict-row").first();
      await expect(conflictRow).toContainText("Base currency");
      await expect(conflictRow).toBeVisible();
      const conflictName = await conflictRow.locator("p").boundingBox();
      const conflictAction = await conflictRow.getByRole("button", { name: /Use this device.s value/ }).boundingBox();
      expect(conflictName && conflictAction && conflictAction.x > conflictName.x + 300).toBeTruthy();
      await expect(page.locator("#sync-endpoint")).toHaveCSS("font-size", "22px");
      await expect(page.locator(".t3-sync-categories").getByText("Snapshots and transactions")).toBeVisible();
      await expect(page.locator(".t3-sync-devices").getByText("Device", { exact: true })).toBeVisible();
      await expect(page.locator(".t3-sync-devices").getByText("This device", { exact: true })).toBeVisible();
      await expect(page.locator(".t3-sync-connection").getByRole("button", { name: "Save sync settings" })).toHaveCount(0);
      await expect(page.locator(".t3-sync-connection").getByRole("button", { name: "Show secret access key" })).toBeVisible();
      await expect(page.locator(".t3-sync-passphrase").getByText("You would have to forget remote data and upload again.", { exact: false })).toBeVisible();
      await expectSettingsCardsFitContent(page, ".sync-settings-page [data-ui-card]");
      await expect(page.locator(".t3-sync-status")).toContainText("9:41");
      await expect(page.getByText("Path-style addressing", { exact: true })).toBeVisible();
      await expect(page.locator(".t3-b-sync-local-note b")).toHaveText("Goals and alerts stay on this device");
      const syncAction = page.locator(".t3-sync-status").getByRole("button", { name: "Sync now" });
      await expect(syncAction).toBeEnabled();
      await expect(syncAction.locator("svg:visible")).toHaveCount(1);
      const icon = await syncAction.locator("svg:visible").boundingBox();
      const labelX = await syncAction.evaluate((button) => {
        const text = Array.from(button.querySelectorAll("span")).flatMap((span) =>
          Array.from(span.childNodes)).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === "Sync now");
        if (!text) return null;
        const range = document.createRange();
        range.selectNodeContents(text);
        return range.getBoundingClientRect().x;
      });
      expect(icon && labelX !== null && icon.x + icon.width <= labelX).toBeTruthy();
      await expect(page.locator(".sync-device-actions").getByRole("button", { name: "Forget remote data" })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
    const connection = await page.locator(".t3-sync-connection").boundingBox();
    expect(connection?.width).toBeGreaterThan(700);
    expect(connection?.width).toBeLessThan(740);
    if (state.startsWith("pop-")) {
      if (state === "pop-locked") {
        await expect(page.locator("#sync-status-passphrase")).toBeVisible();
      } else {
        await page.locator(".t3-fidelity-settings-topbar .desktop-sync-status-indicator button").click();
        if (state === "pop-ok") await expect(page.getByRole("dialog").getByText("Up to date", { exact: true })).toBeVisible();
        if (state === "pop-syncing") await expect(page.getByRole("dialog").getByText("Uploading 1,240 / 4,567", { exact: true })).toBeVisible();
        if (state === "pop-never") await expect(page.getByRole("dialog").getByText("Never synced", { exact: true })).toBeVisible();
        if (state === "pop-error") {
          await expect(page.locator(".t3-b-sync-pop-diagnostics").getByText("Phase timings", { exact: true })).toBeVisible();
          await expect(page.getByRole("dialog").getByText("Network timeout", { exact: true })).toBeVisible();
          await expect(page.getByRole("dialog").getByText("PUT succeeded", { exact: true })).toBeVisible();
          await expect(page.getByRole("dialog").getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
        }
        if (state === "pop-stopped") {
          await expect(page.getByRole("dialog").getByText("Network timeout", { exact: true })).toBeVisible();
          await expect(page.locator(".t3-fidelity-settings-topbar").getByRole("button", { name: /Sync failed - open Backup & sync/ })).toBeVisible();
        }
      }
    } else if (state === "rename") {
      await page.getByRole("button", { name: "Rename Dom’s MacBook Pro" }).click();
      await expect(page.locator(".sync-device-row input").first()).toBeFocused();
    } else if (state === "testing" || state === "test-fail") {
      await page.evaluate((scenario) => {
        const original = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (command: string, args: unknown, options: unknown) => {
          if (command !== "plugin:http|fetch_send") return original(command, args, options);
          if (scenario === "testing") return new Promise(() => {});
          const response = await original(command, args, options);
          return { ...response, status: 403, statusText: "AccessDenied" };
        };
      }, state);
      await page.getByRole("button", { name: "Test connection" }).click();
      await expect(state === "testing" ? page.getByRole("button", { name: "Testing…" })
        : page.getByText("Connection failed", { exact: true }).first()).toBeVisible();
    } else if (state === "disable") {
      await page.getByRole("button", { name: "Disable sync" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expect(page.getByRole("alertdialog")).toContainText("Track3 stops uploading and downloading on this device.");
      await expect(page.getByRole("alertdialog")).toContainText("Other devices keep syncing until you disable them.");
    } else if (state === "forget") {
      await page.getByRole("button", { name: "Forget remote data" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    } else if (state === "confirm-use") {
      await page.locator(".t3-sync-conflicts").getByText("Base currency").locator("..").getByRole("button", { name: "Use the other device's value" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expect(page.getByRole("alertdialog")).toContainText("Use the other device's value?");
      await expect(page.getByRole("alertdialog")).toContainText("Base currency will take the value set on iPhone 15 Pro.");
      await expect(page.getByRole("alertdialog")).toContainText("It cannot be restored from here.");
    } else if (state === "toast") {
      await page.getByRole("button", { name: "Sync now" }).click();
      await expect(page.getByText("312 items uploaded, 0 downloaded.", { exact: true })).toBeVisible();
      const close = page.locator(".desktop-toast-viewport > li").filter({ hasText: "312 items uploaded" }).locator("[toast-close]");
      await expect(close).toBeVisible();
      const closeBox = await close.boundingBox();
      expect(closeBox?.width).toBeGreaterThanOrEqual(44);
      expect(closeBox?.height).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    } else if (state === "locked") {
      await page.keyboard.press("Escape");
    }
    await settingsBShot(page, "sync", state);
    if (state === "disable" || state === "forget" || state === "confirm-use") {
      expect(page.viewportSize()?.height).toBe(1111);
      expect(await page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
    }
    if (state === "default") {
      await page.locator(".t3-sync-connection").getByRole("button", { name: "Show secret access key" }).click();
      await expect(page.locator("#sync-secretAccessKey")).toHaveAttribute("type", "text");
      await page.locator(".t3-sync-connection").getByRole("button", { name: "Hide secret access key" }).click();
      await expect(page.locator("#sync-secretAccessKey")).toHaveAttribute("type", "password");
      await page.locator("#sync-bucket").fill("track3-sync-edited");
      await expect(page.locator(".t3-sync-connection").getByRole("button", { name: "Save sync settings" })).toBeVisible();
    }
    if (state === "pop-error") {
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
        value: { writeText: async (value: string) => { (window as any).__copiedDiagnostics = value; } } }));
      await page.getByRole("dialog").getByRole("button", { name: "Copy diagnostics" }).click();
      await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Diagnostics copied.");
      expect(JSON.parse(await page.evaluate(() => (window as any).__copiedDiagnostics)).timeouts).toBe(14);
    }
  });
}
