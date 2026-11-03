import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/fidelity-desktop/refresh";
const states = ["idle", "progress", "partial", "partial-pop", "quota", "quota-pop", "rule", "states"] as const;

function sourceStatuses(mode: "ok" | "partial" | "quota", finishedTime = "09:41:00") {
  const finished = (index: number) => `2026-10-31T${index === 2 || index === 3 ? "09:40:00" : finishedTime}.000Z`;
  const durations = [3.1, 4.0, 6.8, 4.0, 5.4];
  return ["Binance", "OKX", "Ledger cold wallet", "0x4f…a91c", "Interactive Brokers"].map((label, index) => ({
    sourceId: index === 3 ? "erc20:0" : `source:${index}`, label,
    kind: index < 2 ? "exchange" : index < 4 ? "wallet" : "broker",
    provider: index < 2 ? ["binance", "okx"][index] : index === 4 ? "ibkr" : "wallet",
    status: mode === "partial" && index === 1 || mode === "quota" && index === 3 ? "failed" : "ok",
    category: mode === "partial" && index === 1 ? "network" : mode === "quota" && index === 3 ? "quota" : undefined,
    startedAt: new Date(Date.parse(finished(index)) - durations[index] * 1000).toISOString(),
    finishedAt: finished(index),
    lastSuccessAt: "2026-10-30T21:14:00.000Z",
    detail: mode === "partial" && index === 1 ? "Source timed out" : undefined,
  }));
}

for (const state of states) test(`Refresh desktop captures ${state} with real source statuses`, async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 }, colorScheme: "dark",
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      const finishedTime = state.endsWith("-pop") ? "09:42:00" : "09:41:00";
      await page.clock.setFixedTime(new Date(`2026-10-31T${finishedTime}Z`));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      const mode = state.includes("partial") || state === "rule" ? "partial" : state.includes("quota") ? "quota" : "ok";
      await page.addInitScript((rows) => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(rows)), sourceStatuses(mode, finishedTime));
      await installTauriBridge(page, { fidelitySample: "full",
        quotaUsageFixture: mode === "quota" ? "exhausted" : undefined });
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [],
      }));
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '31')", values: [],
      }));
      if (mode !== "ok") {
        const missingWallet = mode === "partial" ? "OKX" : "0x4f…a91c";
        await page.evaluate(async ({ missingWallet, mode }) => {
          const invoke = (window as any).__e2eInvoke;
          await invoke("plugin:sql|execute", {
            query: "INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES ('fidelity-day-30', 5, ?, 'last_known', '2026-10-31T09:41:00.000Z')",
            values: [JSON.stringify([{ wallet: missingWallet, kind: mode === "partial" ? "exchange" : "wallet",
              provider: mode === "partial" ? "okx" : "ETH", category: mode === "partial" ? "timeout" : "quota",
              lastSuccessAt: "2026-10-30T21:14:00.000Z" }])],
          });
        }, { missingWallet, mode });
      }
      if (state === "progress") await page.addInitScript(() => {
        const tauri = (window as any).__TAURI_INTERNALS__;
        const original = tauri.invoke;
        tauri.invoke = async (cmd: string, args: unknown, options: unknown) => {
          if ((window as any).__holdRefresh && cmd === "plugin:http|fetch_send") {
            await new Promise((resolve) => setTimeout(resolve, 8000));
          }
          return original(cmd, args, options);
        };
      });
      await page.goto("/#/overview");
      await expect(page.locator(".t3-hero-value")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      if (state === "partial" || state === "partial-pop") {
        await expect(page.getByText("Totals exclude OKX", { exact: false })).toBeVisible();
        await expect(page.locator(".t3-flow-banner")).toBeVisible();
        await expect(page.locator(".t3-hero-chart canvas")).toBeVisible();
        await expect(page.locator(".t3-hero-value")).toContainText("$621,333.50");
        await expect(page.getByRole("combobox", { name: "Total value view" })).toContainText("excluding okx");
        await expect(page.getByText("Insights", { exact: true })).toBeVisible();
        await expect(page.getByText("Daily change", { exact: true })).toBeVisible();
        await expect(page.getByText("Top coins", { exact: true })).toBeVisible();
        await expect(page.locator(".t3-overview-more")).toBeVisible();
      }
      if (mode === "quota") {
        await expect(page.locator(".t3-flow-banner")).toContainText(
          "0x4f…a91c not refreshed: Pro limit reached. Totals exclude 0x4f…a91c.");
        await expect(page.locator(".t3-flow-banner")).toContainText(
          "50 of 50 ERC20 refreshes used this month; the count resets on 1 Nov.");
        await expect(page.locator(".t3-flow-banner").getByRole("button", { name: "Manage plan" })).toBeVisible();
      }
      if (state === "progress") {
        await page.evaluate(() => { (window as any).__holdRefresh = true; });
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Refreshing" }).first()).toBeVisible();
        await expect(page.locator(".t3-refresh-progress-pill")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator(".t3-overview-grid")).toBeVisible();
        await expect(page.getByText("Insights", { exact: true })).toBeVisible();
        await expect(page.getByText("Daily change", { exact: true })).toBeVisible();
        await expect(page.getByText("Top coins", { exact: true })).toBeVisible();
        await expect(page.locator(".t3-overview-more")).toBeVisible();
        await expect(page.getByRole("alertdialog")).toContainText("Done in 3.1 s");
        await expect(page.locator(".t3-refresh-progress")).toHaveAttribute("data-indeterminate", "");
      }
      if (state.endsWith("-pop")) {
        await page.getByRole("button", { name: "Source status" }).click();
        await expect(page.getByRole("alertdialog", { name: "Refresh finished" })).toBeVisible();
        await expect(page.getByRole("alertdialog")).toContainText(state === "quota-pop"
          ? "4 of 5 refreshed · 1 needs a plan change" : "4 of 5 refreshed · 1 failed");
        if (state === "quota-pop") {
          await expect(page.getByRole("alertdialog")).toContainText(
            "Pro limit reached: 50 of 50 ERC20 refreshes used, resets 1 Nov");
          await expect(page.getByRole("alertdialog").getByRole("button", { name: "Manage plan" })).toBeVisible();
        }
        await expect(page.getByRole("alertdialog").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
      }
      await page.screenshot({ path: `${output}/refresh-${state}-desktop.png`, fullPage: true, animations: "disabled" });
    } finally {
      await context.close();
    }
});
