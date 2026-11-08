import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { executeSceneSql, installFidelityRecords } from "./fidelity-records-scenes";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  reducedMotion: "reduce",
});

const dir = "/tmp/fidelity/history";
test("phone list aligns values and uses the source text hierarchy", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  const row = page.locator(".history-mobile-snapshot").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".fidelity-history-subtitle strong")).toHaveText("1,284");
  const positions = await row.evaluate((node) => {
    const right = (selector: string) => node.querySelector(selector)!.getBoundingClientRect().right;
    const time = node.querySelector(".history-mobile-snapshot-date > span")!.getBoundingClientRect().width;
    return { total: right(".history-mobile-snapshot-total"), delta: right(".history-mobile-snapshot-delta"), time };
  });
  expect(Math.round(positions.total)).toBe(357);
  expect(Math.round(positions.delta)).toBe(357);
  expect(Math.round(positions.time)).toBe(39);
  await expect(page.locator(".fidelity-history-edited").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".mobile-tab-badge")).toHaveCSS("font-size", "10px");
  await expect(page.locator(".mobile-tab-badge")).toHaveCSS("font-weight", "700");
  await expect(page.locator(".mobile-tab-badge")).toHaveCSS("line-height", "18px");
  expect(Math.round(await page.locator(".mobile-tab-badge").evaluate((badge) => {
    const text = document.createRange();
    text.selectNodeContents(badge);
    return text.getBoundingClientRect().x;
  }))).toBe(359);
});

test("light history and detail keep backgrounds and text legible", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.locator(".history-mobile-snapshot").first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    localStorage.setItem("track3-ui-theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  });
  const ground = await page.locator("#app-main-content").evaluate((node) => getComputedStyle(node).backgroundColor);
  const tab = await page.locator(".mobile-tab-bar").evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(ground).not.toBe("rgb(13, 13, 14)");
  expect(tab).toBe(ground);
  await expect(page.locator(".fidelity-history-chips button.selected")).toHaveCSS("color", /rgb\(\d+, \d+, \d+\)/);
  const chip = await page.locator(".fidelity-history-chips button.selected").evaluate((node) => ({
    color: getComputedStyle(node).color,
    background: getComputedStyle(node).backgroundColor,
  }));
  expect(chip.color).not.toBe(chip.background);
  const contrast = (foreground: string, background: string) => {
    const luminance = (value: string) => {
      const channels = value.match(/\d+/g)!.slice(0, 3).map((part) => {
        const channel = Number(part) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const title = await page.locator(".fidelity-history h1").evaluate((node) => getComputedStyle(node).color);
  const selectedTab = await page.locator(".mobile-tab[aria-current='page']").evaluate((node) => getComputedStyle(node).color);
  expect(Math.min(contrast(title, ground), contrast(selectedTab, tab), contrast(chip.color, chip.background)))
    .toBeGreaterThanOrEqual(4.5);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/history-light-phone.png` });
  await page.getByRole("button", { name: /Status: all/ }).click();
  const filter = page.getByRole("dialog", { name: "Filter history" });
  await expect(filter).toBeVisible();
  const filterColors = await filter.evaluate((node) => {
    const color = (selector: string, property: "color" | "backgroundColor" = "color") =>
      getComputedStyle(node.querySelector(selector)!)[property];
    return {
      sheet: getComputedStyle(node).backgroundColor,
      segment: color(".fidelity-history-segments", "backgroundColor"),
      segmentText: color(".fidelity-history-segments button:not(.selected)"),
      input: color(".fidelity-history-filter input", "backgroundColor"),
      inputText: color(".fidelity-history-filter input"),
    };
  });
  expect(contrast(filterColors.segmentText, filterColors.segment)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(filterColors.inputText, filterColors.input)).toBeGreaterThanOrEqual(4.5);
  expect(filterColors.sheet).not.toBe("rgb(19, 18, 23)");
  await page.keyboard.press("Escape");
  await page.getByTestId("history-mobile-row").first().click();
  await expect(page.locator(".fidelity-history-detail")).toBeVisible();
  const detailGround = await page.locator("#app-main-content").evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(detailGround).toBe(ground);
  const detailTitle = await page.locator(".fidelity-history-detail-head h2").evaluate((node) => getComputedStyle(node).color);
  expect(contrast(detailTitle, detailGround)).toBeGreaterThanOrEqual(4.5);
  const actions = await page.locator(".fidelity-history-detail-actions :is(a, button)").evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { color: style.color, background: style.backgroundColor };
    }));
  for (const action of actions) {
    expect(contrast(action.color, action.background === "rgba(0, 0, 0, 0)" ? detailGround : action.background))
      .toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: `${dir}/history-detail-light-phone.png` });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const deleteSheet = page.getByRole("alertdialog");
  await expect(deleteSheet).toBeVisible();
  const deleteColors = await page.locator(".fidelity-history-delete-dialog").evaluate((node) => ({
    sheet: getComputedStyle(node).backgroundColor,
    text: getComputedStyle(node.querySelector("h2")!).color,
    cancel: getComputedStyle(node.querySelector("button")!).color,
  }));
  expect(contrast(deleteColors.text, deleteColors.sheet)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(deleteColors.cancel, deleteColors.sheet)).toBeGreaterThanOrEqual(4.5);
  await deleteSheet.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".history-mobile-list")).toBeVisible();
});

test("Chinese light phone pages keep History and Cost basis inside 390 px", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await page.emulateMedia({ colorScheme: "light" });
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.locator(".fidelity-history h1")).toHaveText("历史记录");
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-kpis")).toBeVisible();
  await expect(page.locator(".fidelity-cost-gaps thead")).toContainText("数量");
  await expect(page.locator(".fidelity-cost-gaps thead")).toContainText("原因");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("history change has separate aligned amount and percent with the source gap", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  const change = page.locator(".history-mobile-snapshot-delta").first();
  await expect(change).toBeVisible({ timeout: 20_000 });
  const spans = change.locator("span");
  await expect(spans).toHaveCount(2);
  const left = await spans.first().boundingBox();
  const right = await spans.nth(1).boundingBox();
  expect(Math.round(right!.x - left!.x - left!.width)).toBe(6);
});

test("history page size follows a compact to wide to compact resize", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50, { timeout: 20_000 });
  await page.setViewportSize({ width: 800, height: 844 });
  await expect(page.locator(".fidelity-history-chips")).toBeVisible();
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50, { timeout: 20_000 });
  await expect(page.getByRole("combobox", { name: /Rows \d+/ })).toHaveCount(0);
  await page.setViewportSize({ width: 1194, height: 834 });
  await expect(page.getByRole("combobox", { name: "Rows 20" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".fidelity-history-chips")).toHaveCount(0);
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20, { timeout: 20_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50, { timeout: 20_000 });
  await expect(page.getByRole("combobox", { name: /Rows \d+/ })).toHaveCount(0);
});

test("snapshot replacement edit values carry their currency unit", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" })
    .getByTestId("history-mobile-row").click();
  const edit = page.locator(".fidelity-history-edit-row").filter({ hasText: "Replaced snapshot" });
  await expect(edit).toContainText("Value $752,602.00");
  await expect(edit).toContainText("Value $752,642.71");
});

test("detail Back followed by Analytics switches routes every time", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.locator(".fidelity-history")).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 507, height: 1024 }]) {
    await page.setViewportSize(viewport);
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.getByTestId("history-mobile-row").first().click();
      const detail = page.getByRole("dialog", { name: "Snapshot details" });
      await expect(detail).toBeVisible();
      await detail.getByRole("button", { name: "Back" }).click();
      await expect(page.locator(".history-mobile-list")).toBeVisible();
      await page.locator('.mobile-tab-bar a[href="#/summary"]').click();
      await expect(page.locator("#app-main-content")).toHaveAttribute("data-route", "/summary", { timeout: 5_000 });
      await expect(page.getByRole("navigation", { name: "Tabs" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Summary", exact: true })).toBeVisible({ timeout: 15_000 });
      await page.locator('.mobile-tab-bar a[href="#/history"]').click();
      await expect(page.locator(".history-mobile-list")).toBeVisible();
    }
  }
});

test("list, filter, swipe, delete, undo", async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.getByText("Snapshots", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
  await expect(page.locator(".history-mobile-snapshot").first()).toContainText("$763,809.27");
  const firstRow = page.locator(".history-mobile-snapshot").first();
  await expect(firstRow.locator(".history-mobile-snapshot-date strong")).toHaveCSS("font-weight", "700");
  await expect(firstRow.locator(".history-mobile-snapshot-date > span").first()).toHaveCSS("font-weight", "400");
  await expect(firstRow.locator(".history-mobile-snapshot-total")).toHaveCSS("letter-spacing", "normal");
  await expect(page.locator(".fidelity-history-hint")).not.toContainText("History count");
  await expect(page.locator(".fidelity-history h1")).toHaveCSS("letter-spacing", "-0.22px");
  const chipWidths = await page.locator(".fidelity-history-chips button").evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().width)));
  expect(chipWidths).toEqual([118, 134, 69]);
  await expect(page.locator(".fidelity-history-chips button").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  expect(Math.round((await page.locator(".mobile-tab-badge").boundingBox())!.y)).toBe(790);
  const tabCenters = await page.locator(".mobile-tab-bar .mobile-tab").evaluateAll((tabs) =>
    tabs.map((tab) => Math.round(tab.getBoundingClientRect().x + tab.getBoundingClientRect().width / 2)));
  for (const [index, target] of [53, 153, 253, 348].entries()) {
    expect(Math.abs(tabCenters[index] - target)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator(".mobile-tab-bar .mobile-tab").first()).toHaveCSS("line-height", "18px");
  const partial = page.locator(".history-mobile-snapshot").filter({ hasText: "4 of 5 sources" }).first();
  await expect(partial.locator(".fidelity-history-sources")).not.toHaveCSS("color", "rgb(217, 164, 65)");
  await expect(partial.locator(".fidelity-history-source-count")).toHaveCSS("color", "rgb(217, 164, 65)");
  await expect(partial.locator(".history-mobile-snapshot-date .rounded-full")).toHaveCount(0);
  await page.screenshot({ path: `${dir}/history-phone-long.png`, fullPage: true,
    style: ".mobile-tab-bar { display: none !important; }" });
  await page.screenshot({ path: `${dir}/history-phone.png` });
  await page.getByRole("button", { name: /Status: all/ }).click();
  await expect(page.getByRole("dialog", { name: "Filter history" })).toBeVisible();
  expect(Math.round((await page.locator(".fidelity-history-filter-sheet .mobile-sheet-handle").boundingBox())!.y)).toBe(321);
  await expect(page.locator(".fidelity-history-filter-sheet .mobile-sheet-handle")).toHaveCSS("height", "4px");
  await expect(page.locator(".fidelity-history-filter-sheet .mobile-sheet-handle")).toHaveCSS("background-color", "rgb(68, 69, 75)");
  await expect(page.locator(".fidelity-history-filter-sheet .mobile-sheet-heading h2")).toHaveCSS("line-height", "24px");
  expect(Math.round((await page.locator(".fidelity-history-filter-sheet .mobile-sheet-heading h2").boundingBox())!.y)).toBe(339);
  await expect(page.locator(".fidelity-history-filter > p")).toHaveCSS("font-size", "12px");
  await expect(page.locator(".fidelity-history-segments button").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-history-reset")).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-history-apply")).toHaveCSS("font-variant-numeric", "tabular-nums");
  const applyTextWidth = await page.locator(".fidelity-history-apply").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return Math.round(range.getBoundingClientRect().width);
  });
  expect(applyTextWidth).toBe(144);
  expect(Math.round((await page.locator(".fidelity-history-filter label").first().boundingBox())!.y)).toBe(401);
  expect(Math.round((await page.locator(".fidelity-history-filter label").nth(1).boundingBox())!.y)).toBe(471);
  await expect(page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Edited 1" })).toBeVisible();
  await page.screenshot({ path: `${dir}/history-filter-phone.png` });
  expect((await page.locator(".fidelity-history-filter-sheet .mobile-sheet-close").boundingBox())!.width).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await page.locator(".fidelity-history-chips button").nth(1).evaluate((button: HTMLElement) => button.blur());
  const row = page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" });
  await row.dispatchEvent("pointerdown", { clientX: 345, clientY: 400 });
  await row.dispatchEvent("pointerup", { clientX: 240, clientY: 400 });
  await expect(row.locator(".mobile-swipe-actions-revealed")).toBeVisible();
  await page.screenshot({ path: `${dir}/history-swipe-phone.png` });
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  const deleteHandleY = await page.locator(".fidelity-history-delete-dialog").evaluate((node) =>
    Math.round(node.getBoundingClientRect().y + Number.parseFloat(getComputedStyle(node, "::before").top)));
  expect(deleteHandleY).toBe(615);
  await expect(page.getByRole("alertdialog").locator("h2")).toHaveCSS("font-size", "18px");
  const deleteAction = (await page.getByRole("alertdialog").getByRole("button", { name: /Delete snapshot/ }).boundingBox())!;
  expect(deleteAction.height).toBe(46);
  expect(Math.round(deleteAction.y)).toBe(769);
  await expect(page.locator(".fidelity-history-delete-dialog > div:last-child button").last()).toHaveCSS("line-height", "18px");
  const deleteLabelX = await page.getByRole("alertdialog").getByRole("button", { name: /Delete snapshot/ }).evaluate((button) => {
    const range = document.createRange();
    range.selectNodeContents(button.lastChild!);
    return Math.round(range.getBoundingClientRect().x);
  });
  expect(deleteLabelX).toBe(248);
  const deleteCopy = await page.locator(".fidelity-history-delete-dialog p").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node.lastChild!);
    return Math.round(range.getBoundingClientRect().y);
  });
  expect(deleteCopy).toBe(696);
  await page.screenshot({ path: `${dir}/history-delete-phone.png` });
  await page.getByRole("alertdialog").getByRole("button", { name: /Delete snapshot/ }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" }).locator("svg")).toBeVisible();
  const undo = await page.getByRole("button", { name: "Undo" }).boundingBox();
  const close = page.locator(".ios-d3-toast-viewport [toast-close]").last();
  expect((await close.boundingBox())!.width).toBeLessThanOrEqual(1);
  expect(undo?.height).toBe(36);
  expect(undo?.width).toBeLessThanOrEqual(69);
  const undoLayout = await page.getByRole("button", { name: "Undo" }).evaluate((button) => {
    const round = (rect: DOMRect) => ({ x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height) });
    const range = document.createRange();
    range.selectNodeContents(button.lastChild!);
    return { button: round(button.getBoundingClientRect()),
      icon: round(button.querySelector("svg")!.getBoundingClientRect()),
      text: round(range.getBoundingClientRect()) };
  });
  expect(undoLayout).toEqual({
    button: { x: 292, y: 719, width: 67, height: 36 },
    icon: { x: 304, y: 728, width: 14, height: 14 },
    text: { x: 318, y: 731, width: 29, height: 14 },
  });
  await expect(page.locator(".fidelity-history-delete-toast .mobile-toast-copy > div:first-child")).toHaveCSS("line-height", "18px");
  await expect(page.locator(".fidelity-history-delete-toast .mobile-toast-copy > div:last-child")).toHaveCSS("color", "rgb(180, 182, 188)");
  await expect(page.locator(".fidelity-history-delete-toast .mobile-toast-action")).toHaveCSS("color", "rgb(155, 157, 163)");
  const toastCopy = await page.locator(".fidelity-history-delete-toast .mobile-toast-copy").evaluate((node) =>
    [...node.children].map((child) => {
      const range = document.createRange();
      range.selectNodeContents(child);
      const box = range.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y) };
    }));
  expect(toastCopy).toEqual([{ x: 63, y: 720 }, { x: 63, y: 739 }]);
  await page.screenshot({ path: `${dir}/history-undo-phone.png` });
});

test("empty state", async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await installFidelityRecords(page, { empty: true });
  await page.goto("/#/history");
  await expect(page.getByText("No snapshots yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /More, 2 unread alerts/ })).toBeVisible();
  const card = await page.locator(".fidelity-history-card").boundingBox();
  expect(card?.y).toBe(148);
  expect(card?.height).toBe(476);
  expect((await page.locator(".fidelity-history-empty").boundingBox())?.y).toBe(197);
  await page.screenshot({ path: `${dir}/history-empty-phone.png` });
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page).toHaveURL(/#\/settings\/configuration$/);
});

test("refreshes configured sources when no snapshot has been saved", async ({ page }) => {
  await installTauriBridge(page);
  await executeSceneSql(page, "DELETE FROM assets_v2");
  await page.goto("/#/history");
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.getByRole("alertdialog", { name: "Source status" })).toBeVisible();
});

test("history keeps configured sync status visible", async ({ page }) => {
  await installFidelityRecords(page, { lockedSync: true });
  await page.goto("/#/history");
  await expect(page.locator("#app-top-bar .t3-topbar-sync-button")).toBeVisible();
});

test("loading state", async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await installFidelityRecords(page, { slowHistory: true });
  await page.goto("/#/history");
  await expect(page.locator(".fidelity-history-skeleton").first()).toBeVisible();
  await expect(page.locator(".fidelity-history-subtitle")).toHaveText("Loading...");
  expect(Math.round((await page.locator(".fidelity-history-skeleton").first().locator("i").nth(1).boundingBox())!.width)).toBe(96);
  expect(Math.round((await page.locator(".fidelity-history-skeleton").first().locator("i").nth(3).boundingBox())!.width)).toBe(120);
  await page.screenshot({ path: `${dir}/history-loading-phone.png` });
});

test("refresh after loading more replaces stale rows", async ({ page }) => {
  expect(await page.evaluate(() => navigator.userAgent)).toContain("iPhone");
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
  await page.getByRole("button", { name: "Next 50" }).click();
  await expect(page.locator(".fidelity-history-pager")).toContainText("51–100 of");
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
  await executeSceneSql(page, `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, price, value)
    VALUES ('new-same-day', '2026-10-31T09:40:00.000Z', 'fidelity-wallet', 'crypto', 'NEW', 1, 123, 123)`);
  await page.evaluate(() => window.dispatchEvent(new Event("track3:soft-refresh")));
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
  await expect(page.locator(".history-mobile-snapshot").nth(1)).toContainText("$123.00");
});

test("transaction price edits stay in the edit log without changing asset display", async ({ page }) => {
  await installFidelityRecords(page);
  await executeSceneSql(page, "DELETE FROM snapshot_edit_log WHERE target = 'asset'");
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot").filter({ hasText: "752,642.71" }).getByTestId("history-mobile-row").click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "AAPL" })).not.toContainText("was");
  await expect(detail).toContainText("AAPL price");
  await expect(detail).toContainText("Replaced snapshot");
  await expect(detail).not.toContainText("Quantity –");
});

test("asset details preserve tiny quantities, tiny prices and fractional stock shares", async ({ page }) => {
  await installFidelityRecords(page);
  await executeSceneSql(page, `UPDATE assets_v2 SET amount = 0.00004, price = 50000, value = 2
    WHERE uuid = '2026-10-31-m' AND symbol = 'BTC'`);
  await executeSceneSql(page, `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, price, value)
    VALUES ('2026-10-31-m', '2026-10-31T09:41:00.000Z', 'fidelity-wallet', 'stock', 'MSFT', 1.25, 10, 12.5),
      ('2026-10-31-m', '2026-10-31T09:41:00.000Z', 'fidelity-wallet', 'crypto', 'TINY', 200000, 0.00001, 2)`);
  await page.goto("/#/history");
  await page.getByTestId("history-mobile-row").first().click();
  const detail = page.getByRole("dialog", { name: "Snapshot details" });
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "BTC" }))
    .toContainText("0.00004 × $50,000.00");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "TINY" }))
    .toContainText("200,000.0000 × $0.00001");
  await expect(detail.locator(".fidelity-history-detail-asset").filter({ hasText: "MSFT" }))
    .toContainText("1.25 × $10.00");
});

test("edited filter keeps the unfiltered previous snapshot date in detail", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/history");
  await page.getByRole("button", { name: "Edited", exact: true }).click();
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(1);
  await page.getByTestId("history-mobile-row").click();
  await expect(page.getByRole("dialog", { name: "Snapshot details" })).toContainText("27 Oct");
});

test.describe("local history dates", () => {
  test.use({ timezoneId: "Asia/Shanghai" });
  test("uses local time for rows and local calendar days for filters", async ({ page }) => {
    await installFidelityRecords(page);
    await page.goto("/#/history");
    await expect(page.locator(".history-mobile-snapshot").first()).toContainText("17:41");
    await page.getByRole("button", { name: /Status: all/ }).click();
    await page.getByLabel("From").fill("2026-10-29");
    await page.getByLabel("To", { exact: true }).fill("2026-10-29");
    await page.getByRole("button", { name: /^Show \d+/ }).click();
    await expect(page.locator(".history-mobile-snapshot")).toHaveCount(2);
    await expect(page.locator(".history-mobile-snapshot").first()).toContainText("17:05");
    await expect(page.locator(".history-mobile-snapshot").last()).toContainText("05:46");
  });
});

test("tab icons keep the same artwork and size across routes", async ({ page }) => {
  await installFidelityRecords(page, { empty: true });
  await page.goto("/#/overview");
  const overviewIcon = await page.locator(".mobile-tab-bar a[href='#/overview'] svg").first().evaluate((node) => ({
    html: node.outerHTML, width: node.getBoundingClientRect().width,
  }));
  await page.goto("/#/history");
  const historyRouteIcon = await page.locator(".mobile-tab-bar a[href='#/overview'] svg").first().evaluate((node) => ({
    html: node.outerHTML, width: node.getBoundingClientRect().width,
  }));
  expect(historyRouteIcon).toEqual(overviewIcon);
});
