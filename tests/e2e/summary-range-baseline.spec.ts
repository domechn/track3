import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

const presets = [
  ["1D", 1], ["7D", 5], ["30D", 28], ["90D", 88], ["1Y", 363], ["All", 1038],
] as const;

function amount(text: string) {
  const match = text.match(/([+−-]?)\$([\d,]+)/);
  if (!match) throw new Error(`No amount in ${text}`);
  return (match[1] === "−" || match[1] === "-" ? -1 : 1) * Number(match[2].replaceAll(",", ""));
}

test("desktop Summary compares each range with its preceding snapshot", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { summaryRangeFixture: "many" });
  await page.goto("/#/summary");
  const summary = page.locator(".fidelity-summary");
  const card = summary.locator(".fidelity-summary-pnl");
  const controls = page.getByRole("group", { name: "Predefined times" });
  for (const [preset, count] of presets) {
    await expect(summary).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
    await controls.getByRole("button", { name: preset, exact: true }).click();
    if (preset !== "All") await expect(summary).toHaveAttribute("aria-busy", "true", { timeout: 10_000 });
    await expect(summary).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
    await expect(card.locator(".fidelity-kpis > div").first()).toContainText(
      preset === "All" ? "Net P&L (all time)" : `Net P&L (${preset})`);
    const metrics = card.locator(".fidelity-kpis > div");
    for (const index of [0, 1, 2]) {
      await expect(metrics.nth(index).locator("strong")).not.toHaveText(/^(–|n\/a)$/);
    }
    await expect(metrics.nth(3).locator("small")).toHaveAttribute("title",
      preset === "All" ? /1038 snapshots$/ : new RegExp(`${count} in range$`), { timeout: 30_000 });
    if (preset === "1D") {
      await expect(card.locator("[data-direction-end]")).toHaveText("−$190");
      await expect(summary.locator(".fidelity-period-card .fidelity-month-value").first()).toHaveText("−$190");
      await expect(summary.locator(".fidelity-year-card strong").first()).toHaveText("−$190");
      await expect(summary.locator(".fidelity-leaders").getByRole("rowheader", { name: "BTC" })).toBeVisible();
    }
    const header = (await summary.locator(".fidelity-page-head p").innerText()).replace(/\s+/g, " ");
    const amounts = [...header.matchAll(/[+−-]?\$[\d,]+/g)].map(([text]) => amount(text));
    expect(amounts).toHaveLength(3);
    const details = await card.locator(".fidelity-kpis > div").first().locator("strong").getAttribute("title") ?? "";
    const unrecorded = details.match(/Unrecorded changes: ([+−-]?\$[\d,]+)/);
    expect(amounts[1] + amounts[2] + (unrecorded ? amount(unrecorded[1]) : 0)).toBe(amounts[0]);
  }
});

test("desktop Summary explains missing metrics with one database snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { summaryRangeFixture: "one" });
  await page.goto("/#/summary");
  const summary = page.locator(".fidelity-summary");
  await expect(summary).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const metrics = summary.locator(".fidelity-summary-pnl .fidelity-kpis > div");
  for (const index of [0, 1, 2]) {
    await expect(metrics.nth(index).locator("strong")).toHaveText("–");
    await expect(metrics.nth(index)).toContainText("Needs a second snapshot");
  }
  await expect(metrics.nth(3).locator("small")).toHaveAttribute("title", "in 1 snapshot");
});
