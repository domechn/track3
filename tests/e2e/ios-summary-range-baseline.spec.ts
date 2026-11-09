import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("phone Summary compares each range with its preceding snapshot", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { summaryRangeFixture: "many" });
  await page.goto("/#/summary");
  const summary = page.locator(".fd-summary");
  const card = summary.locator(".fd-profit-loss");
  await expect(summary).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
  for (const [preset, count] of [["1D", 1], ["7D", 5], ["30D", 28], ["90D", 88], ["1Y", 363], ["All", 1038]] as const) {
    await summary.getByRole("radio", { name: preset, exact: true }).click();
    await expect(card.locator(".fd-primary-stat .fd-label")).toHaveText(
      preset === "All" ? "Net P&L (all time)" : `Net P&L (${preset})`);
    await expect(card.locator(".fd-primary-stat strong")).not.toHaveText(/^(–|n\/a)$/, { timeout: 30_000 });
    for (const metric of await card.locator(".fd-kpis strong").all()) {
      await expect(metric).not.toHaveText(/^(–|n\/a)$/);
    }
    await expect(card.locator(".fd-kpis > div").nth(2).locator("small")).toHaveAttribute("title",
      preset === "All" ? /1038 snapshots$/ : new RegExp(`${count} in range$`));
    if (preset === "1D") {
      await expect(card.locator(".fd-summary-chart text").last()).toHaveText("−$190");
      await expect(card.locator(".fd-summary-chart text").filter({ hasText: /^Best month,/ })).toHaveCount(0);
      await expect(summary.locator(".fd-profit-summary .fd-month strong").last()).toHaveText("−$190");
      await expect(summary.locator(".fd-years .fd-year strong").first()).toHaveText("−$190");
      await expect(summary.locator(".fd-top-coins").getByText("BTC").first()).toBeVisible();
    }
    const header = (await summary.locator(".fd-page-head p").innerText()).replace(/\s+/g, " ");
    const amounts = [...header.matchAll(/[+−-]?\$[\d,]+/g)].map(([text]) => {
      const raw = text.replace(/[\$+,−-]/g, "");
      return (text.startsWith("−") || text.startsWith("-") ? -1 : 1) * Number(raw);
    });
    expect([3, 4]).toContain(amounts.length);
    const details = await card.locator(".fd-primary-stat strong").getAttribute("title") ?? "";
    const unrecorded = details.match(/Unrecorded changes: ([+−-]?\$[\d,]+)/);
    const unrecordedAmount = unrecorded ? (unrecorded[1].startsWith("−") || unrecorded[1].startsWith("-") ? -1 : 1) *
      Number(unrecorded[1].replace(/[\$+,−-]/g, "")) : 0;
    expect(amounts[1] + amounts[2] + (amounts[3] ?? unrecordedAmount)).toBe(amounts[0]);
  }
});

test("phone Summary explains missing metrics with one database snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { summaryRangeFixture: "one" });
  await page.goto("/#/summary");
  const summary = page.locator(".fd-summary");
  await expect(summary).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
  const card = summary.locator(".fd-profit-loss");
  await expect(card.locator(".fd-primary-stat strong")).toHaveText("–");
  await expect(card.locator(".fd-primary-stat")).toContainText("Needs a second snapshot");
  for (const metric of await card.locator(".fd-kpis > div").all()) {
    if (await metric.locator("strong").count() && await metric.locator(".fd-label").innerText() !== "Positions") {
      await expect(metric.locator("strong")).toHaveText("–");
    }
  }
  await expect(card).toContainText("in 1 snapshot");
});

test("phone Summary retries a failed range when selected again", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { summaryRangeFixture: "many" });
  await page.goto("/#/summary");
  const summary = page.locator(".fd-summary");
  await expect(summary).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const invoke = tauri.invoke;
    let failed = false;
    tauri.invoke = (command: string, args: { query?: string } = {}) => {
      if (command === "plugin:sql|select" && /SELECT uuid, MAX\(createdAt\)/i.test(args.query ?? "") && !failed) {
        failed = true;
        return new Promise((_, reject) => setTimeout(() => reject(new Error("range request failed")), 500));
      }
      return invoke(command, args);
    };
  });
  await summary.getByRole("radio", { name: "1D", exact: true }).click();
  await expect(summary).toHaveAttribute("aria-busy", "true");
  await expect(summary.locator(".fd-primary-stat strong")).toHaveCount(0);
  await expect(summary.getByRole("alert")).toContainText("Could not load summary");
  await expect(summary.locator(".fd-primary-stat")).toContainText("Could not load summary");
  await expect(summary.locator(".fd-primary-stat strong")).toHaveText("n/a");
  await expect(summary.getByText("Loading", { exact: true })).toHaveCount(0);
  await summary.getByRole("radio", { name: "1D", exact: true }).click();
  await expect(summary.getByRole("alert")).toHaveCount(0);
  await expect(summary.locator(".fd-primary-stat strong")).not.toHaveText("n/a");
});

test.describe("iPad Summary", () => {
  test.use({
    viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPad",
  });

  test("uses the preceding baseline for 7D in the restored iPad controls", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 834, height: 1024 });
    await installTauriBridge(page, { summaryRangeFixture: "many" });
    await page.goto("/#/summary");
    const summary = page.locator(".d2-summary");
    await expect(summary).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
    mkdirSync("/tmp/fidelity/summary", { recursive: true });
    await page.screenshot({ path: "/tmp/fidelity/summary/ui44-app-ipad.png" });
    await page.setViewportSize({ width: 820, height: 1180 });
    const profit = summary.locator(".analyze-profit-card");
    await profit.getByRole("radio", { name: "7D" }).click();
    await expect(profit.locator(".mobile-movers-total")).toContainText("Net P&L (7D)");
    await expect(profit.locator(".mobile-movers-total")).toContainText("-\$150.00");
    await expect(profit.locator(".mobile-movers-total")).not.toContainText("Breakeven");
    const periods = summary.locator(".profit-summary-card");
    await expect(periods.locator(".profit-month-card").last()).toContainText("-\$150");
    await periods.getByRole("radio", { name: "Y" }).click();
    await expect(periods.locator(".profit-period-grid > div").first()).toContainText("-\$150");
  });

  test("explains missing P&L and period cards with one database snapshot", async ({ page }) => {
    await installTauriBridge(page, { summaryRangeFixture: "one" });
    await page.goto("/#/summary");
    const summary = page.locator(".d2-summary");
    await expect(summary).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    const profit = summary.locator(".analyze-profit-card");
    await expect(profit.locator(".mobile-movers-total .ios-money")).toHaveText("–");
    await expect(profit.locator(".mobile-movers-total .ios-money")).toHaveAttribute("title", "Needs a second snapshot");
    await expect(profit.locator(".mobile-movers-total")).not.toContainText("Breakeven");
    const periods = summary.locator(".profit-summary-card");
    await expect(periods).toContainText("Month cards appear after the second snapshot.");
    await periods.getByRole("radio", { name: "Y" }).click();
    await expect(periods).toContainText("The year view appears after the second snapshot.");
  });
});
