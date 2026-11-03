import { expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

export async function capturePartialScreens(page: Page, shell: "desktop" | "ios", width: number, theme: "light" | "dark") {
  await page.setViewportSize({ width, height: width === 390 ? 844 : width === 834 ? 1112 : 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "system");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "btc:0", label: "Cold storage", kind: "wallet", provider: "BTC",
        status: "stale", category: "network", lastSuccessAt: "2026-10-30T12:00:00.000Z" },
    ]));
  });
  await installTauriBridge(page, {
    richPortfolio: true, freshReviewData: true, seedRebalanceProfile: true, seedPartialSnapshot: true,
  });
  mkdirSync("test-results/p7b", { recursive: true });
  const capture = (screen: string) => page.screenshot({
    path: `test-results/p7b/${shell}-${width}-${theme}-${screen}.png`,
    animations: "disabled" as const,
  });
  const phoneLayout = shell === "ios" && width <= 430;

  await page.goto("/#/overview");
  if (phoneLayout) {
    await expect(page.locator(".fd-partial-pill")).toHaveText("Partial", { timeout: 30_000 });
    await expect(page.locator(".fd-partial-chart")).toBeVisible();
    await capture("overview");
    await expect(page.locator(".fd-partial-total")).toHaveText("$49,898.45");
    await capture("overview-excluding");
    await page.locator(".fd-partial-summary").click();
    await expect(page.locator(".fd-partial-status")).toBeVisible();
    await capture("refresh");
    await page.locator(".fd-partial-status").getByRole("button", { name: "Close" }).click();
  } else {
    await expect(page.locator(".t3-hero-card").getByText("Partial", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Dotted gap: partial refreshes are omitted from this chart.")).toBeVisible();
    await capture("overview");
    await page.getByRole("combobox", { name: "Total value view" }).click();
    await page.getByRole("option", { name: "Total value, excluding BTC" }).click();
    await expect(page.locator(".t3-hero-value")).not.toContainText("$75,048.19");
    await capture("overview-excluding");
    await page.getByRole("combobox", { name: "Total value view" }).click();
    await page.getByRole("option", { name: "Including last known values" }).click();
    await page.getByRole("button", { name: "Source status" }).click();
    await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
    await capture("refresh");
    await page.getByRole("button", { name: "Close" }).click();
  }

  await page.goto("/#/history");
  await expect(page.locator("[data-testid=history-content][aria-busy=true]")).toHaveCount(0);
  await expect(page.getByText("4 of 5 sources").first()).toBeVisible();
  await capture("history-list");
  await page.getByRole("combobox", { name: "History filter" }).click();
  await page.getByRole("option", { name: "Partial" }).click();
  const row = page.getByTestId(shell === "ios" ? "history-mobile-row" : "history-snapshot-row");
  await expect(row).toHaveCount(2);
  await capture("history-filter");
  await row.first().click();
  await expect(page.getByRole("region", { name: "Partial" })).toContainText("BTC");
  await capture("history-detail");

  await page.goto("/#/rebalance");
  await expect(page.getByText("Trades are paused because the latest snapshot is partial.")).toBeVisible();
  await capture("rebalance");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

  await page.goto("/#/overview");
  await (phoneLayout ? page.locator(".fd-partial-refresh") : page.getByRole("button", { name: "Refresh", exact: true })).click();
  const status = page.getByRole("alertdialog", { name: "Source status" });
  await expect(status.getByRole("button", { name: "Use last known values" })).toBeVisible();
  if (phoneLayout) {
    await expect(page.locator(".fd-partial-total")).not.toHaveText("$75,048.19");
    await expect(page.locator(".fd-partial-pill")).toHaveText("Partial");
  } else {
    await expect(page.locator(".overview-loading")).toBeHidden();
    await expect(page.locator(".t3-hero-value")).not.toContainText("$75,048.19");
    await expect(page.locator(".t3-hero-value")).toContainText("Partial");
  }
  if (shell === "desktop") await expect(page.locator(".desktop-toast-viewport > li[data-state='open']")).toBeHidden({ timeout: 15_000 });
  await capture("refresh-offer");
  await status.getByRole("button", { name: "Use last known values" }).click();
  await page.getByRole("button", { name: "Source status" }).click();
  await expect(status.getByRole("button", { name: "Use last known values" })).toHaveCount(0);
}
