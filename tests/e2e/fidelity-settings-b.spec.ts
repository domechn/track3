/// <reference types="vite/client" />
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, S3Error, type S3Store } from "../../src/middlelayers/sync/object-store";
import { SyncEngine, type SyncRepository, type SyncState } from "../../src/middlelayers/sync/engine";
import { expectSettingsCardsFitContent } from "./settings-card-layout-scenes";

async function seedRemoteSyncDevice(s3: FakeS3, passphrase: string) {
  const prefix = "dom/";
  const store: S3Store = {
    putObject: (path, body, conditions, signal) => s3.putObject(prefix + path, body, conditions, signal),
    getObject: ((path: string, signal?: AbortSignal, ifNoneMatch?: string) =>
      ifNoneMatch === undefined ? s3.getObject(prefix + path, signal)
        : s3.getObject(prefix + path, signal, ifNoneMatch)) as S3Store["getObject"],
    headObject: (path, signal) => s3.headObject(prefix + path, signal),
    deleteObject: (path, signal) => s3.deleteObject(prefix + path, signal),
    listObjectsV2: async (options) => {
      const page = await s3.listObjectsV2({ ...options, prefix: prefix + (options?.prefix ?? "") });
      return { ...page, objects: page.objects.map((item) => ({ ...item, key: item.key.slice(prefix.length) })),
        commonPrefixes: page.commonPrefixes?.map((path) => path.slice(prefix.length)) };
    },
  };
  let state: SyncState = {};
  const config = new Map([["6", "90"], ["7", "EUR"], ["12", "configs:\n  groupUSD: true\nothers: []\n"]]);
  const repo: SyncRepository = {
    loadState: async () => structuredClone(state),
    saveState: async (next) => { state = structuredClone(next); },
    listSnapshotIds: async () => [],
    readSnapshot: async () => { throw new Error("No remote snapshots"); },
    importSnapshot: async () => false,
    replaceSnapshot: async () => {},
    deleteSnapshot: async () => {},
    listConfig: async () => Object.fromEntries(config),
    writeConfig: async (id, value) => { if (value === null) config.delete(id); else config.set(id, value); },
    listSessions: async () => [],
    listSessionIds: async () => [],
    writeSession: async () => {},
    deleteSession: async () => {},
    dataChanged: () => {},
  };
  const engine = new SyncEngine(store, repo, passphrase, { now: () => Date.parse("2026-10-30T22:07:00.000Z") });
  const report = await engine.syncOnce({ manual: true, deviceName: "iPhone 15 Pro" });
  expect(report.errors).toEqual([]);
  expect(report.pushed).toBeGreaterThan(0);
  engine.dispose();
}

const output = "/tmp/fidelity/settings-b";
const states = [
  "about-check-error", "about-downloading", "about-guide", "about", "about-ready", "about-update",
  "ai-fail", "ai-json-error", "ai", "backup-conflicts", "backup-no-folder", "backup", "backup-restore",
  "backup-toast-err", "backup-toast-ok", "pro-activating", "pro-deactivate", "pro-exhausted", "pro-expired",
  "pro-free", "pro-invalid", "pro-ios-free", "pro-ios", "pro", "security-lock-off", "security",
  "security-rotate", "security-rotated", "sync-confirm-use", "sync-disable", "sync-forget", "sync-loading",
  "sync-locked", "sync", "sync-pop-error", "sync-pop-locked", "sync-pop-never", "sync-pop-ok",
  "sync-pop-stopped", "sync-pop-syncing", "sync-setup", "sync-test-fail",
] as const;

test.use({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  colorScheme: "dark", reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
});

async function seed(page: Page, state: string) {
  await page.clock.setFixedTime(new Date(state.startsWith("ai")
    ? "2026-10-31T09:42:00.000Z" : "2026-10-31T09:45:00.000Z"));
  const needsSync = state === "sync" || state.startsWith("sync-");
  const passphrase = "fixture sync words for local testing";
  const s3 = needsSync && state !== "sync-setup" ? new FakeS3() : undefined;
  if (s3) {
    const { header } = await createSyncHeader(passphrase);
    await s3.putObject("dom/sync-header", new TextEncoder().encode(JSON.stringify(header)), { ifNoneMatch: "*" });
    await seedRemoteSyncDevice(s3, passphrase);
  }
  const bridge = await installTauriBridge(page, {
    fidelitySample: "full", appVersion: "0.9.4", proUsageFixture: true,
    fidelityPro: state.startsWith("pro"),
    fidelityProExpired: state === "pro-expired",
    fidelityLicenseInvalid: state === "pro-invalid",
    fidelityLicenseDelay: state === "pro-activating",
    preflightExhaustedFixture: state === "pro-exhausted",
    appLockEnabledFixture: state.startsWith("security") && state !== "security-lock-off",
    fidelityAiProbe: state.startsWith("ai"),
    fidelityAiProbeFail: state === "ai-fail",
    licenseDevices: "present", quotaExhaustedFixture: state === "pro-exhausted",
    checkoutFixture: state === "pro-free" || state === "pro-ios-free" ||
      state === "pro-invalid" || state === "pro-activating",
    configuredBackupFixture: state.startsWith("backup") && state !== "backup-no-folder",
    backupFolderFixture: state.startsWith("backup"),
    seedLockedSync: (state.startsWith("sync-") || state === "sync") && state !== "sync-setup",
    s3, fidelitySync: needsSync,
  });
  await page.evaluate(async ({ state }) => {
    const invoke = (window as any).__e2eInvoke as (cmd: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
    const run = (query: string, values: unknown[] = []) => invoke("plugin:sql|execute", { query, values });
    await run("UPDATE configuration SET data = ? WHERE id = 994", [
      `!ent:e2e:${JSON.stringify({ endpoint: "https://openrouter.ai/api/v1", apiKey: "fixture-model-key",
        model: "anthropic/claude-sonnet-4.5", contextSize: 128000, inputPricePerMillionTokens: 3,
        outputPricePerMillionTokens: 15, allowActions: true, proactiveInsightsSummary: true,
        advanced: { temperature: 0.2, top_p: 0.9, headers: { "HTTP-Referer": "https://track3.dev", "X-Title": "Track3" },
          extra_body: { reasoning: { effort: "low" } }, provider: { order: ["anthropic"], allow_fallbacks: true } },
      })}`,
    ]);
    if (state.startsWith("pro") && !["pro-free", "pro-ios-free", "pro-invalid", "pro-activating"].includes(state)) {
      await run("UPDATE configuration SET data = ? WHERE id = 997",
        ["!ent:e2e:T3P-8F2K-N4VD-6WXA-Q7M4"]);
    }
    if (state === "backup-no-folder") await run("DELETE FROM configuration WHERE id = 3");
    if (state === "sync" || state.startsWith("sync-")) {
      if (state !== "sync-setup") {
        await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '60'), (7, 'USD')");
      }
      if (state !== "sync-setup") await run("UPDATE configuration SET data = ? WHERE id = 991", [
        `!ent:e2e:${JSON.stringify({ enabled: true,
          endpoint: "https://3f9a1c7e2b4d.r2.cloudflarestorage.com",
          bucket: "track3-sync", region: "auto", prefix: "dom/", pathStyle: true,
          accessKeyId: "fixture-access-id", secretAccessKey: "fixture-secret",
        })}`,
      ]);
    }
  }, { state });
  return { passphrase, bridge, s3 };
}

for (const state of states) {
  test(`settings B ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    const { passphrase, bridge, s3 } = await seed(page, state);
    const area = state.split("-")[0];
    const route = area === "pro" ? "/settings/systemInfo?section=pro"
      : area === "about" ? "/settings/systemInfo?section=about"
        : area === "ai" ? "/settings/assistant"
          : area === "backup" ? "/settings/data?section=backup"
            : area === "security" ? "/settings/data?section=security" : "/settings/sync";
    await page.goto(`/#${route}`);
    expect(await page.evaluate(() => navigator.userAgent)).toContain("iPhone");
    await expect(page.locator("#app-main-content")).toBeVisible({ timeout: 20_000 });
    if (area === "sync" && state !== "sync-setup") {
      await page.evaluate(async () => {
        const schedulerUrl: string = "/src/middlelayers/sync/scheduler.ts";
        const { SyncScheduler } = await import(schedulerUrl);
        const trigger = SyncScheduler.prototype.trigger;
        SyncScheduler.prototype.trigger = function (kind: Parameters<typeof trigger>[0]) {
          if (kind !== "start") trigger.call(this, kind);
        };
      });
      const skip = page.getByRole("button", { name: "Continue without sync" });
      await expect(skip).toBeVisible({ timeout: 20_000 });
      if (state === "sync-locked" || state === "sync-pop-locked") {
        await skip.click();
      } else {
        await page.getByRole("dialog").getByLabel("Sync passphrase").fill(passphrase);
        await page.getByRole("dialog").getByRole("button", { name: "Unlock", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
        await page.evaluate(async () => {
          const runtimeModuleUrl: string = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModuleUrl);
          await syncRuntime.syncNow();
        });
        try {
          await expect.poll(async () => page.evaluate(async () => {
            const runtimeModuleUrl: string = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModuleUrl);
            return { phase: syncRuntime.status().sync.phase,
              devices: syncRuntime.status().sync.report?.devices?.length ?? 0,
              conflicts: (await syncRuntime.configConflicts()).length };
          }), { timeout: 40_000 }).toEqual({ phase: "idle", devices: 2, conflicts: 3 });
        } catch (error) {
          const state = await page.evaluate(async () => {
            const runtimeModuleUrl: string = "/src/middlelayers/sync/runtime.ts";
            const { syncRuntime } = await import(runtimeModuleUrl);
            const report = syncRuntime.status().sync.report;
            return { pushed: report?.pushed, pulled: report?.pulled, reportedConflicts: report?.conflicts,
              errors: report?.errors, devices: report?.devices?.length };
          });
          console.log("sync fixture state", JSON.stringify(state));
          throw error;
        }
        const syncFixture = await page.evaluate(async (state) => {
          const runtimeModuleUrl: string = "/src/middlelayers/sync/runtime.ts";
          const { syncRuntime } = await import(runtimeModuleUrl);
          const discovered = syncRuntime.status().sync.report;
          const diagnostics = syncRuntime.status().sync.diagnostics;
          await (syncRuntime as any).scheduler?.stop();
          const lastSync = Date.parse("2026-10-31T09:41:00.000Z");
          const baseReport = { pulled: 0, pushed: 312, tombstonesApplied: 0, configChanges: 0,
            conflicts: ["6", "7", "12"], errors: [], devices: discovered?.devices ?? [] };
          const sync = state === "sync-pop-never" ? { phase: "idle" as const, report: { ...baseReport, pulled: 0, pushed: 0 } }
            : state === "sync-pop-syncing" ? { phase: "syncing" as const, startedAt: Date.now() - 134_000,
              progress: { phase: "push" as const, completed: 1240, total: 4567 }, report: baseReport }
              : state === "sync-pop-error" || state === "sync-pop-stopped"
                ? { phase: "error" as const, error: "bucket" as const, lastSync, report: baseReport,
                  diagnostics,
                  retryStopped: state === "sync-pop-stopped" }
                : { phase: "idle" as const, lastSync, report: baseReport };
          (syncRuntime as any).publish("ready", sync);
          return { before: discovered?.devices?.length, after: syncRuntime.status().sync.report?.devices?.length,
            devices: (await syncRuntime.devices()).length };
        }, state);
        expect(syncFixture).toEqual({ before: 2, after: 2, devices: 2 });
      }
      if (state.startsWith("sync-pop-")) {
        if (state === "sync-pop-syncing") {
          await expect(page.locator(".fidelity-b-sync-status")).toContainText("Syncing 27%");
        }
        await page.locator(".fidelity-b-sync-status").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        if (state === "sync-pop-error") {
          await expect(page.getByRole("dialog").getByText("Phase timings")).toBeVisible();
          expect((await page.getByRole("dialog").getByText("Phase timings").boundingBox())!.y).toBeLessThan(700);
        }
        if (state === "sync-pop-stopped") {
          await expect(page.locator(".fidelity-b-sync-status")).toContainText("Sync stopped");
          await expect(page.getByRole("dialog").getByRole("heading", { name: "Sync stopped" })).toBeVisible();
          await expect(page.getByRole("dialog")).toContainText("Needs attention");
          await expect(page.getByRole("dialog").locator(".t3-sync-details-toggle"))
            .toHaveAttribute("aria-expanded", "false");
        }
      }
      if (state === "sync-confirm-use") {
        await expect(page.locator(".t3-sync-conflicts .rounded-md").first()).toContainText("Base currency");
        await page.locator(".t3-sync-conflicts").getByRole("button", { name: "Use the other device's value" }).first().click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await expect(page.getByRole("alertdialog").getByRole("heading", { name: "Use the other device's value?" })).toBeVisible();
        await expect(page.getByRole("alertdialog").getByRole("heading", { name: "Use the other device's value?" })).toHaveCSS("text-align", "left");
      }
      if (state === "sync-pop-never") {
        await expect(page.locator(".fidelity-sync-sheet-backdrop")).toBeVisible();
        await expect(page.getByRole("dialog")).toContainText("Never synced");
        await expect(page.getByRole("dialog").getByText(/conflict needs review/)).toHaveCount(0);
        await expect(page.getByRole("dialog").getByRole("button", { name: "Sync now" }).locator("svg")).toHaveCount(1);
        await expect(page.getByRole("dialog").getByRole("link", { name: "Settings" })).toBeVisible();
      }
      if (state === "sync-pop-ok") {
        await expect(page.getByRole("dialog").getByText(/conflict needs review/)).toHaveCount(0);
      }
      if (state === "sync-pop-locked") {
        await expect(page.getByRole("dialog")).toHaveCSS("height", "227px");
      }
      if (state === "sync-forget") {
        await page.locator(".t3-sync-devices").getByRole("button", { name: /Forget remote/i }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>("*")) {
            if (element.scrollTop) element.scrollTop = 0;
          }
          document.getElementById("app-main-content")!.scrollTo(0, 0);
        });
      }
      if (state === "sync-disable") {
        await page.locator(".t3-sync-devices").getByRole("button", { name: "Disable sync" }).click();
        await expect(page.getByRole("alertdialog")).toContainText("Disable sync?");
        await page.evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>("*")) {
            if (element.scrollTop) element.scrollTop = 0;
          }
          document.getElementById("app-main-content")!.scrollTo(0, 0);
        });
      }
      if (state === "sync-test-fail") {
        if (!s3) throw new Error("Missing local S3 test service");
        s3.listObjectsV2 = async () => { throw new S3Error("Access denied", 403); };
        await page.locator(".t3-sync-connection").getByRole("button", { name: "Test connection" }).click();
        await expect(page.locator(".t3-sync-connection").getByLabel("Endpoint")).not.toHaveAttribute("aria-invalid", "true");
        await expect(page.locator(".ios-d3-toast-viewport")).toContainText("Access denied");
        await expect(page.locator(".t3-sync-connection .fidelity-b-pill")).toHaveText("Failed");
        await page.locator(".ios-d3-toast-viewport li[data-state='open']").waitFor({ state: "hidden", timeout: 15_000 });
        await page.evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>("*")) {
            if (element.scrollTop) element.scrollTop = 0;
          }
          document.getElementById("app-main-content")!.scrollTo(0, 0);
        });
      }
    }
    const readyText = area === "about" ? "0.9.4"
      : area === "ai" ? "Test connection"
        : area === "backup" ? "Export"
          : area === "pro" ? "Track3 Pro"
            : area === "security" ? "App lock" : "Endpoint";
    await expect(page.locator("#app-main-content")).toContainText(readyText, { timeout: 20_000 });
    await expect(page.locator("#app-main-content")).not.toContainText("Loading...", { timeout: 20_000 });
    if (state === "ai") {
      await expect(page.getByRole("heading", { name: "Connection" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Context and cost" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Behaviour" })).toBeVisible();
    }
    if (state === "pro") {
      await expect(page.locator("#app-main-content h1")).toHaveText("Pro & license");
      await expect(page.getByRole("heading", { name: "What Pro includes" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "License key" })).toBeVisible();
    }
    if (state === "pro-exhausted") {
      await expect(page.getByRole("alert")).toContainText("300 of 300 used this month");
      await expect(page.getByRole("alert")).toContainText("TRON refreshes still work");
      await expect(page.locator(".fidelity-b-pro-actions").getByRole("button", { name: "Deactivate license" })).toHaveCount(0);
      await expect(page.locator(".fidelity-b-pro-device-card").getByRole("button", { name: "Deactivate license" })).toHaveCount(1);
    }
    if (state === "pro-expired") {
      await expect(page.getByRole("alert")).toContainText("Pro expired on 14 Oct 2026");
      await expect(page.getByText("Yearly, not renewed")).toBeVisible();
      await expect(page.locator(".fidelity-b-pro [data-ui-system-card] > div:first-child > div:first-child > div:first-child > span"))
        .toHaveCSS("color", "rgb(238, 106, 130)");
    }
    if (state === "pro-free" || state === "pro-ios-free") {
      await expect(page.locator(".fidelity-b-pro [data-ui-system-card] > div:first-child > div:first-child > div:first-child > span"))
        .toHaveCSS("color", "rgb(180, 182, 188)");
    }
    if (state === "about") {
      await expect(page.getByRole("heading", { name: "Track3", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Help and links" })).toBeVisible();
    }
    if (state === "security") {
      await expect(page.getByRole("heading", { name: "Encryption key" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Recovery" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "App lock" })).toBeVisible();
    }
    if (state === "backup") {
      await expect(page.locator("#app-main-content h1")).toHaveText("Backup & data");
      await expect(page.getByRole("heading", { name: "Export", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible();
    }
    if (state === "sync") {
      await expect(page.getByRole("heading", { name: "Connection", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "What to sync" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Backup & sync" })).toBeVisible();
      await expect(page.locator(".t3-sync-devices .sync-device-row")).toHaveCount(2);
      await expect(page.locator(".t3-sync-conflicts")).toBeVisible();
      await expect(page.locator(".t3-sync-connection input").first()).toHaveCSS("background-color", "rgb(10, 10, 11)");
    }
    if (["sync", "sync-locked", "sync-setup"].includes(state)) {
      await expectSettingsCardsFitContent(page, ".fidelity-b-sync > [data-ui-card]");
      const layout = await page.evaluate(() => ({
        connection: document.querySelector(".fidelity-b-sync .t3-sync-connection")!.getBoundingClientRect().top,
        passphrase: document.querySelector(".fidelity-b-sync .t3-sync-passphrase")!.getBoundingClientRect().top,
        columns: getComputedStyle(document.querySelector(".fidelity-b-sync")!).gridTemplateColumns.split(" ").length,
      }));
      expect(layout.columns).toBe(1);
      if (state === "sync-locked") expect(layout.passphrase).toBeLessThan(layout.connection);
      if (state === "sync-setup") expect(layout.connection).toBeLessThan(layout.passphrase);
      if (state === "sync" || state === "sync-locked") {
        await page.locator(".fidelity-b-sync .t3-sync-status").screenshot({ path: `/tmp/track3-sync-390-${state}-status-dark.png` });
        await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
      }
    }
    if (area === "ai") {
      await page.getByRole("button", { name: "Test connection" }).click();
      if (state === "ai-fail") {
        await expect(page.getByTestId("assistant-probe-error")).toBeVisible();
        await expect(page.getByTestId("assistant-probe-error").locator("svg")).toHaveCount(1);
      }
      else await expect(page.locator(".fidelity-b-ai-connection")).toContainText("Connected");
      if (state === "ai") {
        await expect(page.locator(".fidelity-b-ai-test")).toContainText("Connected in");
        await expect(page.locator(".fidelity-b-ai-test")).toContainText("anthropic/claude-sonnet-4.5 replied");
        await expect(page.locator(".fidelity-b-model-input svg")).toHaveCount(1);
        await expect(page.locator(".fidelity-b-result.is-positive svg")).toHaveCount(1);
      }
      await page.locator(".ios-d3-toast-viewport li[data-state='open']").waitFor({ state: "hidden" });
    }
    if (state === "ai-json-error") {
      await page.getByTestId("assistant-advanced").fill("{bad json");
      await page.getByTestId("assistant-save").click();
      await expect(page.getByTestId("assistant-advanced-error")).toBeVisible();
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>("*")) {
          if (element.scrollTop) element.scrollTop = 0;
        }
        document.getElementById("app-main-content")!.scrollTo(0, 0);
      });
      await expect(page.getByRole("heading", { name: "Connection" })).toBeInViewport();
    }
    if (state === "pro-deactivate") {
      await page.getByRole("button", { name: "Deactivate license" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>("*")) {
          if (element.scrollTop) element.scrollTop = 0;
        }
        document.getElementById("app-main-content")!.scrollTo(0, 0);
      });
      await expect(page.locator("#app-main-content h1")).toBeInViewport();
    }
    if (state === "about-guide") {
      await page.getByRole("button", { name: "Replay" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (state === "pro-invalid" || state === "pro-activating") {
      await page.locator("#license").fill("T3P-INVALID-FIXTURE");
      await page.getByRole("button", { name: "Verify" }).click();
      if (state === "pro-invalid") {
        await expect(page.locator(".ios-d3-toast-viewport")).toBeVisible();
        await page.evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>("*")) {
            if (element.scrollTop) element.scrollTop = 0;
          }
          document.getElementById("app-main-content")!.scrollTo(0, 0);
        });
      }
      else await expect(page.getByRole("button", { name: "Activating…" })).toBeVisible();
    }
    if (state === "security-rotate" || state === "security-rotated") {
      await page.getByRole("button", { name: "Rotate encryption key" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      if (state === "security-rotated") {
        await page.locator("#new-encryption-key").fill("fixture-rotation-key");
        await page.locator("#confirm-encryption-key").fill("fixture-rotation-key");
        await page.getByRole("dialog").getByRole("button", { name: "Update encryption key" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText("New key is active")).toBeVisible();
      }
    }
    if (state === "backup-restore" || state === "backup-conflicts") {
      await page.getByRole("button", { name: "Review backup from device-a" }).click();
      await expect(page.getByText("2024-02: 1 snapshot")).toBeVisible();
      if (state === "backup-conflicts") await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>("*")) {
          if (element.scrollTop && !element.closest('[role="dialog"]')) element.scrollTop = 0;
        }
        document.getElementById("app-main-content")!.scrollTo(0, 0);
      });
    }
    if (state === "backup-toast-ok") {
      await page.getByRole("button", { name: "Import from backup folder" }).click();
      await page.getByRole("button", { name: "Import device-a" }).click();
      await page.getByRole("alertdialog", { name: "Restore data?" }).getByRole("button", { name: "Restore" }).click();
      await expect(page.getByText("Import data successfully", { exact: true })).toBeVisible();
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>("*")) {
          if (element.scrollTop) element.scrollTop = 0;
        }
        document.getElementById("app-main-content")!.scrollTo(0, 0);
      });
    }
    if (state === "backup-toast-err") {
      bridge.setImportFile("{bad json", "invalid.json");
      await page.locator(".fidelity-b-backup-import").getByRole("button", { name: "Review snapshots" }).click();
      await expect(page.locator(".ios-d3-toast-viewport")).toBeVisible();
    }
    if (state === "backup") await expect(page.getByText("Backing up data", { exact: true })).toBeHidden({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const smallInputs = await page.locator("input, textarea, select").evaluateAll((fields) =>
      fields.filter((field) => field.getClientRects().length && Number.parseFloat(getComputedStyle(field).fontSize) < 16)
        .map((field) => `${field.tagName.toLowerCase()}#${field.id}`));
    expect(smallInputs).toEqual([]);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png`, animations: "disabled" });
    await page.screenshot({ path: `${output}/${state}-long.png`, fullPage: true, animations: "disabled" });
  });
}

test("locked sync cards fit on a light phone", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Phone layout");
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await seed(page, "sync-locked");
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Continue without sync" }).click();
  await expect(page.locator(".fidelity-b-sync .t3-sync-passphrase")).toBeVisible();
  await expectSettingsCardsFitContent(page, ".fidelity-b-sync > [data-ui-card]");
  await expect(page.locator('label[for="sync-passphrase"]')).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".fidelity-b-sync .t3-sync-status")).toHaveCSS("background-color", "rgb(19, 18, 23)");
  await expect(page.locator(".fidelity-b-sync .t3-sync-status-rows > div").first()).toHaveCSS("border-top-color", "rgb(34, 34, 36)");
  await expect(page.locator(".fidelity-b-sync .t3-sync-status button")).toHaveCSS("color", "rgb(180, 182, 188)");
  await page.locator(".fidelity-b-sync .t3-sync-status").screenshot({ path: "/tmp/track3-sync-390-locked-status-light.png" });
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/track3-sync-390-locked-light.png", fullPage: true });
});

for (const state of ["sync-locked", "sync-setup"] as const) {
  test(`${state} starts with the right card on iPad`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "iPad layout");
    await page.setViewportSize({ width: 820, height: 1080 });
    await seed(page, state);
    await page.goto("/#/settings/sync");
    if (state === "sync-locked") await page.getByRole("button", { name: "Continue without sync" }).click();
    await expect(page.locator(".sync-settings-page .t3-sync-connection")).toBeVisible();
    const layout = await page.evaluate(() => ({
      connection: document.querySelector(".sync-settings-page .t3-sync-connection")!.getBoundingClientRect().top,
      passphrase: document.querySelector(".sync-settings-page .t3-sync-passphrase")!.getBoundingClientRect().top,
      columns: getComputedStyle(document.querySelector(".sync-settings-page")!).gridTemplateColumns.split(" ").length,
    }));
    expect(layout.columns).toBe(1);
    if (state === "sync-locked") expect(layout.passphrase).toBeLessThan(layout.connection);
    else expect(layout.connection).toBeLessThan(layout.passphrase);
  });
}
