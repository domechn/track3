import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge, seedFidelityCompletedSync } from "./fidelity-bridge-captures";
import { executeSceneSql } from "./fidelity-records-scenes";
import { seedHistoryKpis } from "./history-kpi-scenes";

test("History cards align at design height and the pager stays in the shorter viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1272 });
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27", { timeout: 30_000 });
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await seedFidelityCompletedSync(page);
  await page.evaluate(() => document.fonts.ready);
  const cards = await page.locator(".fidelity-history-grid").evaluate((grid) => {
    const list = grid.querySelector(".fidelity-history-list")!.getBoundingClientRect();
    const detail = grid.querySelector(".fidelity-history-detail")!.getBoundingClientRect();
    return { listBottom: list.bottom, detailBottom: detail.bottom };
  });
  expect(Math.abs(cards.listBottom - cards.detailBottom)).toBeLessThanOrEqual(1);
  mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
  await page.screenshot({ path: "/tmp/history-kpi-overflow/history-aligned-1600.png",
    fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1600, height: 1024 });
  const pager = await page.locator(".fidelity-history-footer .fidelity-history-pager").boundingBox();
  expect(pager!.y + pager!.height).toBeLessThanOrEqual(1024);
  await page.getByRole("button", { name: "Next", exact: true }).first().click();
  await expect(page.locator(".fidelity-history-pager")).toContainText("Page 2 of 26");
});

test("History table separates large currency values from their shares above 1279px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 1280, height: 1000 });
  await seedHistoryKpis(page, 1_000_000, 12_346_678_901.23);
  await executeSceneSql(page,
    "INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('KRW', 'KRW', '₩', 1, 1, '2099-01-01T00:00:00.000Z')");
  await executeSceneSql(page, "INSERT INTO configuration (id, data) VALUES (7, 'KRW')");
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("−₩12,345,678,901.23", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 1440, 1599, 1600, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const table = detail.locator("table").first();
    const { gaps, tableRight, cardRight, compactShares } = await table.evaluate((element) => {
      const card = element.closest(".fidelity-history-detail")!;
      const text = (cell: Element) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return range.getBoundingClientRect();
      };
      const rows = [...element.querySelectorAll("tbody tr")].filter((row) =>
        row.textContent?.includes("COIN10") || row.classList.contains("fidelity-history-total"));
      return {
        gaps: rows.map((row) => {
          const share = row.querySelector(".fidelity-history-compact-share")!;
          return getComputedStyle(share).display === "none"
            ? text(row.children[4]).left - text(row.children[3]).right
            : text(row.children[3]).left - share.getBoundingClientRect().right;
        }),
        compactShares: rows.map((row) => getComputedStyle(row.querySelector(".fidelity-history-compact-share")!).display !== "none"),
        tableRight: element.getBoundingClientRect().right,
        cardRight: card.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(card).paddingRight),
      };
    });
    expect(gaps).toHaveLength(2);
    expect(compactShares).toEqual(width < 1500 ? [true, true] : [false, false]);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(8);
    expect(tableRight).toBeLessThanOrEqual(cardRight + 1);
    if (width === 1280) {
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await detail.screenshot({ path: "/tmp/history-kpi-overflow/history-table-krw-1280.png" });
    }
  }
});
