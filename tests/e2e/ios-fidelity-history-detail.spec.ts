import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { executeSceneSql, installFidelityRecords } from "./fidelity-records-scenes";

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  reducedMotion: "reduce",
});

test("detail labels and symbols follow the source hierarchy", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" }).getByTestId("history-mobile-row").click();
  const detail = page.getByRole("dialog", { name: /snapshot details/i });
  await expect(detail.locator(".fidelity-history-detail-asset").first()).toBeVisible();
  await expect(detail.locator(".fidelity-history-detail-head .t3-tag")).toHaveCSS("font-weight", "500");
  await expect(detail.locator(".fidelity-history-detail-asset-body strong").first()).toHaveCSS("font-weight", "700");
  await expect(detail.locator(".fidelity-history-edit-row strong").first()).toHaveCSS("font-weight", "400");
  // Shared HSL tokens round one channel differently from the old fixed colors.
  await expect(detail.locator(".fidelity-history-detail-total small")).toHaveCSS("color", "rgb(180, 182, 187)");
  await expect(detail.getByRole("link", { name: "Compare" })).toHaveCSS("color", "rgb(154, 156, 162)");
});

test("edited snapshot detail", async ({ page }) => {
  const dir = "/tmp/fidelity/history-detail";
  mkdirSync(dir, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" }).getByTestId("history-mobile-row").click();
  const detail = page.getByRole("dialog", { name: /snapshot details/i });
  await expect(detail.getByText("Assets at that time")).toBeVisible();
  await expect(detail.getByText("$752,642.71").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const headingWidth = (await detail.locator(".fidelity-history-detail-head h2").boundingBox())!.width;
  const totalWidth = await detail.locator(".fidelity-history-detail-total strong").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width;
  });
  expect(headingWidth).toBeGreaterThanOrEqual(154);
  expect(headingWidth).toBeLessThanOrEqual(156);
  expect(totalWidth).toBeGreaterThanOrEqual(117);
  expect(totalWidth).toBeLessThanOrEqual(119);
  await expect(detail.locator(".fidelity-history-detail-total strong")).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "SOL" })).toContainText("410.0000");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "USDC" })).toContainText("39,850.00");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "USDC" })).toContainText("$1.0001");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "AAPL" })).toContainText("150 × $238.00");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "NVDA" })).toContainText("220 × $140.23");
  await expect(detail.locator(".fidelity-history-detail-subkpis small [data-tone='loss']")).toContainText("−0.01%");
  const priceEdit = detail.locator(".fidelity-history-edit-row").filter({ hasText: "AAPL price" });
  await expect(priceEdit).toContainText("$236.31 → $238.00");
  await expect(detail.locator(".fidelity-history-edit-row").first()).toContainText("AAPL price");
  await expect(priceEdit).toContainText("Edited 28 Oct 2026, 11:20");
  const editBounds = await detail.locator(".fidelity-history-edit-row").evaluateAll((rows) => rows.map((row) => {
    const card = row.closest(".fidelity-history-detail-edits")!.getBoundingClientRect();
    const value = row.lastElementChild!.getBoundingClientRect();
    return { cardLeft: card.left, cardRight: card.right, valueLeft: value.left, valueRight: value.right };
  }));
  for (const row of editBounds) {
    expect(row.valueLeft).toBeGreaterThanOrEqual(row.cardLeft);
    expect(row.valueRight).toBeLessThanOrEqual(row.cardRight);
  }
  await expect(detail.locator(".fidelity-history-detail-edits")).toContainText("28 Oct 2026, 11:20");
  await expect(detail.locator(".fidelity-history-detail-edits .fidelity-history-section-head span")).toHaveText("2 edits");
  expect(Math.round((await detail.locator(".fidelity-history-detail-sum strong").boundingBox())!.y)).toBe(944);
  expect(Math.round((await detail.locator(".fidelity-history-detail-edits h3").boundingBox())!.y)).toBe(1017);
  expect(Math.round((await detail.locator(".fidelity-history-detail-subkpis > :nth-child(2) span").boundingBox())!.x)).toBe(169);
  expect(Math.round((await detail.locator(".fidelity-history-detail-total small").boundingBox())!.y)).toBe(126);
  expect(Math.round((await detail.locator(".fidelity-history-detail-subkpis strong").first().boundingBox())!.y)).toBe(192);
  expect(Math.round((await detail.locator(".fidelity-history-detail-actions button").first().boundingBox())!.y)).toBe(249);
  const editedTextX = await detail.locator(".fidelity-history-detail-head .t3-tag").evaluate((pill) => {
    const range = document.createRange();
    range.selectNodeContents(pill);
    return Math.round(range.getBoundingClientRect().x);
  });
  expect(editedTextX).toBe(241);
  await expect(detail.locator(".fidelity-history-detail-actions button").first()).toHaveCSS("gap", "0px");
  await expect(detail.locator(".fidelity-history-detail-actions button").first()).toHaveCSS("font-size", "12px");
  await expect(detail.locator(".fidelity-history-detail-actions button").first()).toHaveCSS("font-weight", "500");
  await expect(detail.locator(".fidelity-history-detail-actions button").first()).toHaveCSS("line-height", "16px");
  await page.screenshot({ path: `${dir}/history-detail-phone-long.png`, fullPage: true,
    style: ".mobile-tab-bar { display: none !important; }" });
  await page.screenshot({ path: `${dir}/history-detail-phone.png` });
  await detail.getByRole("link", { name: "Compare" }).click();
  await expect(page).toHaveURL(/#\/comparison\?head=2026-10-28-m$/);
  await expect(page.getByRole("button", { name: "Snapshot B: 28 Oct 2026" })).toContainText("28 Oct 2026");
});

test("detail change percent follows reversed quote colour", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/settings/appearance");
  await page.getByRole("button", { name: "Red Up / Green Down" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-quote", "red-up");
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" }).getByTestId("history-mobile-row").click();
  const detail = page.getByRole("dialog", { name: /snapshot details/i });
  // --positive rounds to this RGB value on dark surfaces.
  await expect(detail.locator(".fidelity-history-detail-subkpis small [data-tone]")).toHaveCSS("color", "rgb(95, 196, 155)");
  await expect(detail.locator(".fidelity-history-detail-subkpis strong[data-tone]")).toHaveCSS("color", "rgb(95, 196, 155)");
});

test("phone detail focuses Back, closes on Escape, and restores the opening row", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/history");
  const row = page.getByTestId("history-mobile-row").first();
  await row.click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await expect(detail.getByRole("button", { name: "Back" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(row).toBeFocused();
  await row.click();
  await detail.getByRole("button", { name: "Back" }).click();
  await expect(detail).toBeHidden();
  await expect(row).toBeFocused();
});

test("the asset shortcut describes its actual destination", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await page.getByTestId("history-mobile-row").first().click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await detail.getByRole("button", { name: "View assets" }).click();
  await expect(detail.getByRole("heading", { name: "Assets at that time" })).toBeInViewport();
});

test("detail change stays finite when the earlier snapshot total is zero", async ({ page }) => {
  await installFidelityRecords(page);
  await executeSceneSql(page, "UPDATE assets_v2 SET value = 0 WHERE uuid = '2026-10-30-m'");
  await page.goto("/#/history");
  await page.getByTestId("history-mobile-row").first().click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await expect(detail.locator(".fidelity-history-detail-subkpis")).toContainText("0.00%");
  await expect(detail).not.toContainText("Infinity");
});

test("detail retains its change and edited status when the list returns to page one", async ({ page }) => {
  await installFidelityRecords(page);
  await executeSceneSql(page, `INSERT INTO snapshot_edit_log
    (snapshot_uuid, edited_at, origin, target, action, asset_type, symbol, wallet, old_value, new_value)
    VALUES ('2026-10-01-m', '2026-10-01T00:00:00.000Z', 'local', 'transaction', 'price', 'crypto', 'BTC',
      'fidelity-wallet', '1', '2')`);
  await page.goto("/#/history");
  await page.getByRole("button", { name: "Next 50" }).click();
  const row = page.getByTestId("history-mobile-row").first();
  const expected = (await row.locator(".history-mobile-snapshot-delta").textContent())?.trim();
  await row.click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await expect(detail.locator(".fidelity-history-detail-subkpis")).toContainText(expected!);
  await page.evaluate(() => window.dispatchEvent(new Event("track3:soft-refresh")));
  await expect(page.locator(".fidelity-history-pager")).toContainText("1–50 of 1,284");
  await expect(detail.locator(".fidelity-history-detail-subkpis")).toContainText(expected!);
  await expect(detail.locator(".fidelity-history-detail-head .t3-tag")).toBeVisible();
});
