import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { installTauriBridge, seedFidelityCompletedSync } from "./fidelity-bridge-captures";
import { installTauriBridge as installSampleBridge } from "./fidelity-scenes";
import { installTauriBridge as installBaseBridge } from "./tauri-bridge";

test.use({ viewport: { width: 1600, height: 1024 }, colorScheme: "dark", timezoneId: "UTC" });

const directory = "/tmp/fidelity-desktop/history";
const backupDirectory = "/tmp/fidelity-wdb-locked/history";
// Keep the source column positions as the reference while reserving room for the 32px delete target.
function reflowedDetailHeader(sourceX: number, sourceFirstWidth: number) {
  const left = 973.58;
  const right = 1536;
  const firstWidth = 72;
  return left + firstWidth + (sourceX - left - sourceFirstWidth)
    * (right - left - firstWidth) / (right - left - sourceFirstWidth);
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
  if (name !== "history-empty") {
    await seedFidelityCompletedSync(page);
    const stamp = page.locator(".fidelity-page-head .desktop-sync-status-indicator button");
    await expect(stamp).toHaveText("Synced 09:41");
    const box = (await stamp.boundingBox())!;
    expect(box.x).toBeCloseTo(1465, 0);
    expect(box.y).toBeCloseTo(54, 0);
    expect(box.width).toBeCloseTo(92, 0);
    const iconBox = (await stamp.locator(".fd-sync-cloud-icon").boundingBox())!;
    expect(iconBox.x).toBeGreaterThanOrEqual(box.x);
    await expect(stamp).toHaveCSS("color", "rgb(155, 157, 163)");
  }
  if (name !== "history-loading" && name !== "history-empty") {
    await expect(page.getByTestId("history-content")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("history-snapshot-row")).toHaveCount(50);
    await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27");
    await expect(page.getByTestId("history-desktop-detail")).toBeVisible();
    await expect(page.getByTestId("history-desktop-detail"))
      .toContainText(name === "history-undo" ? "$757,799.94" : "$752,642.71");
  }
  await mkdir(directory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });
  await page.locator(".fidelity-history-list-scroll").evaluateAll((lists) => {
    for (const list of lists) list.scrollTop = 0;
  });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(`${directory}/${name}.json`, JSON.stringify(await page.evaluate(() => {
    const selectors = [".fidelity-history-list th", ".fidelity-history-list td .fidelity-skeleton",
      ".fidelity-history-detail th", ".fidelity-history-skeleton-row .fidelity-skeleton"];
    return Object.fromEntries(selectors.map((selector) => [selector,
      [...document.querySelectorAll(selector)].slice(0, 6).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          paddingLeft: style.paddingLeft, paddingTop: style.paddingTop };
      })]));
  }), null, 2));
  if (name === "history-empty") {
    await expect.poll(async () => (await page.locator(".fidelity-history-filters").boundingBox())?.y,
      { timeout: 15_000 }).toBeCloseTo(88, 0);
    await expect.poll(async () => (await page.locator(".fidelity-history-empty").boundingBox())?.y,
      { timeout: 15_000 }).toBeCloseTo(164, 0);
  }
  if (name !== "history-loading" && name !== "history-empty") {
    await expect(page.getByTestId("history-content")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("history-snapshot-row")).toHaveCount(50);
    await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27");
    await expect(page.locator(".fidelity-page-head p"))
      .toContainText(name === "history-undo" ? "1,283 snapshots" : "1,284 snapshots");
    await expect(page.getByTestId("history-desktop-detail"))
      .toContainText(name === "history-undo" ? "$757,799.94" : "$752,642.71");
  }
  const screenshot = await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true, animations: "disabled" });
  if (name !== "history-loading" && name !== "history-empty") {
    await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27");
    await expect(page.locator(".fidelity-page-head p"))
      .toContainText(name === "history-undo" ? "1,283 snapshots" : "1,284 snapshots");
    await expect(page.getByTestId("history-desktop-detail"))
      .toContainText(name === "history-undo" ? "$757,799.94" : "$752,642.71");
  }
  await writeFile(`${backupDirectory}/${name}.png`, screenshot);
}

test("populated history shows the selected snapshot beside the list", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("history-snapshot-row").first()).toContainText("$763,809.27");
  const goalsBadge = page.locator('a[href="#/goals"] > span[aria-hidden="true"]');
  await expect(goalsBadge).toBeVisible();
  expect((await goalsBadge.boundingBox())!.x).toBeCloseTo(34, 0);
  expect((await goalsBadge.boundingBox())!.y).toBeCloseTo(409, 0);
  await expect(goalsBadge).toHaveCSS("border", "2px solid rgb(13, 13, 14)");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$763,809.27");
  await expect(page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".t3-date-trigger")).toHaveCount(0);
  await expect(page.locator(".t3-topbar-ranges")).toHaveCount(0);
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("AAPL transaction price");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("Restored asset USDC");
  const restored = page.getByTestId("history-desktop-detail").locator("tbody tr").filter({ hasText: "USDC" }).first();
  await expect(restored.locator("td").nth(1)).toContainText("was –");
  await expect(restored.locator("td").nth(1).locator(".fidelity-edited-value")).toContainText("39,850.00");
  const tradeAsset = page.getByTestId("history-desktop-detail").locator("tbody tr").filter({ hasText: "AAPL" }).first();
  await expect(tradeAsset.locator("td").nth(2)).toHaveText("$238.00");
  await expect(tradeAsset.locator("td").nth(2).locator(".fidelity-edited-value")).toHaveCount(0);
  await expect(page.getByTestId("history-desktop-detail")).toContainText("Edits");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("AAPL transaction price");
  const editRows = page.locator(".fidelity-history-edit-log li");
  await expect(editRows.first()).toContainText("AAPL transaction price");
  const editSummary = page.locator(".fidelity-history-edit-log .fidelity-card-head > span");
  await expect(page.locator(".fidelity-history-edit-log .fidelity-card-head")).toHaveCSS("margin-bottom", "6px");
  await expect(editSummary).toContainText("2 edits · changes the total by");
  await expect(editSummary.locator(".pos")).toContainText("+$39,853.99");
  await expect(editSummary.locator(".pos")).toHaveCSS("font-weight", "400");
  await expect(editSummary).toHaveCSS("color", "rgb(154, 156, 162)");
  await expect(page.locator(".fidelity-history-edit-log")).toContainText("$236.31");
  await expect(editRows.first()).toContainText("$236.31 → $238.00");
  await expect(editRows.nth(1)).toContainText("– → $39,853.99");
  await expect(page.locator(".fidelity-history-edit-log")).toContainText("Edited 28 Oct 2026, 11:20");
  const selectedDate = page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" })
    .locator("td:first-child button");
  await expect(selectedDate.locator("strong")).toHaveCount(0);
  await expect(selectedDate).toHaveCSS("font-weight", "400");
  await expect(selectedDate.locator(".fidelity-history-row-time")).toHaveCSS("color", "rgb(180, 182, 188)");
  await expect(selectedDate).toHaveCSS("gap", "4px");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("182,446.74");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$0.9998");
  await expect(page.getByTestId("history-desktop-detail").locator("table").first().locator("thead th")).toHaveCount(5);
  await expect(page.getByTestId("history-desktop-detail").locator("tbody tr").first().locator("td").first()
    .getByRole("button", { name: "Delete BTC from snapshot" })).toBeAttached();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("5 of 5 sources");
  const detailHeaders = page.getByTestId("history-desktop-detail").locator("table").first().locator("thead th");
  const sourceHeaders = [973.58, 1024.19, 1167.88, 1299.19, 1442.88];
  for (const [index, sourceLeft] of sourceHeaders.entries()) {
    const left = index === 0 ? sourceLeft : reflowedDetailHeader(sourceLeft, sourceHeaders[1] - sourceHeaders[0]);
    expect(Math.abs((await detailHeaders.nth(index).boundingBox())!.x - left)).toBeLessThan(1);
  }
  const editAction = page.locator(".fidelity-history-actions button").nth(1);
  expect((await editAction.boundingBox())!.width).toBeCloseTo(61, 0);
  expect((await editAction.locator("svg").boundingBox())!.width).toBeCloseTo(14, 0);
  await expect(page.locator(".fidelity-history-filters .fidelity-date-input > span").first()).toHaveCSS("font-size", "13px");
  const rangeSegment = page.getByRole("group", { name: "Range" });
  expect((await rangeSegment.boundingBox())!.x).toBeCloseTo(151, 0);
  await expect(rangeSegment).toHaveCSS("background-color", "rgb(26, 26, 30)");
  await expect(rangeSegment.getByRole("button", { name: "All time" }))
    .toHaveCSS("background-color", "rgba(72, 136, 213, 0.16)");
  expect((await page.locator(".fidelity-history-filters .fidelity-date-input").first().boundingBox())!.x).toBeCloseTo(454, 0);
  const showGroup = page.locator(".fidelity-history-show");
  expect((await showGroup.boundingBox())!.x).toBeCloseTo(1280.89, 0);
  await expect(showGroup).toHaveCSS("gap", "8px");
  expect((await showGroup.locator(".fidelity-segment").boundingBox())!.x).toBeCloseTo(1319.89, 0);
  await expect(page.locator(".fidelity-history-filters .fidelity-date-input").first())
    .toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.getByRole("button", { name: "With issues 2" })).toBeVisible();
  const retried = page.getByTestId("history-snapshot-row").filter({ hasText: "22 Oct 21:37" });
  await expect(retried.locator("td:last-child i")).toHaveCSS("background-color", "rgb(216, 163, 65)");
  await expect(retried.locator("td:last-child")).toContainText("4 of 5");
  await expect(retried.locator("td:last-child .fidelity-issue-pill")).toHaveCount(0);
  await expect(page.getByText("From any date")).toBeVisible();
  await expect(page.locator(".fidelity-history-list tbody tr:first-child td:first-child button"))
    .toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-history-detail-kpis strong").first())
    .toHaveCSS("font-variant-numeric", "normal");
  await expect(page.locator(".t3-records-toolbar-panel")).toBeHidden();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await capture(page, "history");
  await page.getByRole("button", { name: "Next", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "With issues 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edited 1" })).toBeVisible();
  await expect(page.locator(".fidelity-history-hint > span")).toHaveText(
    "Shows 50 snapshots per page. Change History count in Settings › Currency & display.",
  );
  await page.getByRole("button", { name: "With issues 2" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("% vs previous snapshot");
  const issue = page.getByTestId("history-snapshot-row").filter({ hasText: "5 Oct 18:53" });
  await expect(issue.locator("td:last-child")).toContainText("4 of 5");
  await issue.click();
  await expect(page.getByRole("region", { name: "Partial" })).toContainText("Interactive Brokers");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("4 of 5 sources");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("% vs previous snapshot");
  await page.getByTestId("history-desktop-detail").getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Edit" }).getByRole("button", { name: "AAPL" }).click();
  await expect(page).toHaveURL(/#\/coins\/AAPL\?assetType=stock$/);
});

test("delete confirmation and undo show the designed overlays", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await page.getByTestId("history-desktop-detail").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete this snapshot?" })).toBeVisible();
  const overlay = await page.locator('.fixed.inset-0[data-state="open"]').boundingBox();
  expect(overlay).toMatchObject({ x: 0, y: 0, width: 1600, height: 1024 });
  await expect(page.locator(".fidelity-history-delete-dialog p").first()).toHaveCSS("font-size", "12px");
  await page.getByRole("alertdialog", { name: "Delete this snapshot?" }).screenshot({ animations: "disabled" });
  const dialog = (await page.getByRole("alertdialog", { name: "Delete this snapshot?" }).boundingBox())!;
  expect(dialog.y).toBeCloseTo(405, 0);
  expect(dialog.height).toBeCloseTo(214, 0);
  await capture(page, "history-delete");
  await page.getByRole("alertdialog", { name: "Delete this snapshot?" }).getByRole("button", { name: "Delete snapshot" }).click();
  await expect(page.locator(".desktop-toast-viewport").getByText("Snapshot deleted")).toBeAttached();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$202,198.01");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("+$5,116.37");
  await expect(page.locator(".fidelity-history-edit-log")).toHaveCount(0);
  const toast = page.locator(".fidelity-history-undo-toast");
  await toast.screenshot({ animations: "disabled" });
  const toastBox = (await toast.boundingBox())!;
  expect(toastBox.y).toBeCloseTo(938, 0);
  expect(toastBox.height).toBeCloseTo(62, 0);
  expect(await toast.locator(":scope > div > div:last-child").evaluate((element) =>
    element.getBoundingClientRect().x + Number.parseFloat(getComputedStyle(element).paddingLeft))).toBeCloseTo(1289, 0);
  expect((await toast.locator(".fidelity-undo-action").boundingBox())!.width).toBeCloseTo(67, 0);
  await expect(toast.locator(".fidelity-undo-action")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(toast.locator(".fidelity-undo-action")).toHaveCSS("border", "1px solid rgb(59, 59, 63)");
  await expect(toast.locator(".fidelity-undo-action")).toHaveCSS("color", "rgb(154, 156, 162)");
  expect((await page.locator(".fidelity-history-list th").first().boundingBox())!.width).toBeCloseTo(147.83, 0);
  expect((await page.locator(".fidelity-history-detail th").nth(2).boundingBox())!.x)
    .toBeCloseTo(reflowedDetailHeader(1159.61, (1536 - 973.58) * .092), 0);
  await capture(page, "history-undo");
});

test("a transient tiny viewport preserves the selected desktop snapshot", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await page.setViewportSize({ width: 1, height: 1 });
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await page.setViewportSize({ width: 1600, height: 1024 });
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
});

test("history detail keeps every value distinct inside its card at narrow desktop widths", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1100, height: 1024 });
  await installSampleBridge(page, { fidelitySample: "full" });
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("$763,809.27", { timeout: 30_000 });
  expect(await detail.locator("tbody tr").count()).toBeGreaterThan(5);
  const allCollisions: string[] = [];
  for (const width of [1100, 1180, 1240]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.evaluate(() => document.fonts.ready);
    const collisions = await detail.evaluate((card) => {
      const table = card.querySelector("table")!;
      const tableRight = table.getBoundingClientRect().right;
      const cardStyle = getComputedStyle(card);
      const contentRight = card.getBoundingClientRect().right
        - Number.parseFloat(cardStyle.paddingRight) - Number.parseFloat(cardStyle.borderRightWidth);
      const textRects = (cell: HTMLTableCellElement) => {
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        const rects: DOMRect[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent?.trim() || node.parentElement?.closest("button")) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          rects.push(...range.getClientRects());
        }
        return rects;
      };
      const failures = [...table.querySelectorAll("tbody tr")].flatMap((row, rowIndex) => {
        const cells = [...row.querySelectorAll("td")];
        const rects = cells.map(textRects);
        const failures: string[] = [];
        for (let column = 0; column < rects.length - 1; column++) {
          if (!rects[column].length || !rects[column + 1].length) continue;
          const right = Math.max(...rects[column].map((rect) => rect.right));
          const nextLeft = Math.min(...rects[column + 1].map((rect) => rect.left));
          if (right > nextLeft + 0.5) failures.push(`row ${rowIndex} columns ${column + 1}-${column + 2}: ${right - nextLeft}px overlap`);
        }
        const lastRight = Math.max(...rects.flat().map((rect) => rect.right));
        if (lastRight > contentRight + 0.5) failures.push(`row ${rowIndex}: ${lastRight - contentRight}px past card content (table right ${tableRight}, last cell right ${cells.at(-1)!.getBoundingClientRect().right})`);
        return failures;
      });
      if (table.scrollWidth > card.clientWidth) failures.push("table scrolls past card");
      if (tableRight > contentRight + 0.5) failures.push("table extends into card padding");
      if (table.querySelector("th:last-child")!.getBoundingClientRect().right > card.getBoundingClientRect().right)
        failures.push("Share header exceeds card");
      return failures;
    });
    allCollisions.push(...collisions.map((collision) => `${width}px ${collision}`));
  }
  expect(allCollisions).toEqual([]);
});

test("empty history offers refresh", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-empty" });
  await page.goto("/#/history");
  await expect(page.getByText("No snapshots yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "With issues", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edited", exact: true })).toBeVisible();
  await expect(page.locator(".fidelity-history-filters")).toHaveCSS("opacity", "0.5");
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(page.locator(".fidelity-history-filters .fidelity-segment").first()).toHaveCSS("gap", "0px");
  await expect(page.locator(".fidelity-history-filters .fidelity-filter-group:nth-child(2) > span"))
    .toHaveCSS("color", "rgb(154, 156, 162)");
  await expect(page.locator("aside").getByRole("button", { name: "History filters" })).toBeVisible();
  await expect(page.locator("aside").getByRole("link", { name: "Settings" })).toBeVisible();
  const emptyCard = (await page.locator(".fidelity-history-empty").boundingBox())!;
  expect(emptyCard.height).toBeCloseTo(466, 0);
  await expect(page.locator(".fidelity-history-empty > p > span")).toHaveText(
    "Snapshots stay on this device. Change History count in Settings › Currency & display.",
  );
  await capture(page, "history-empty");
  await page.evaluate(() => {
    document.querySelector(".t3-refresh-button")?.addEventListener("click", () => {
      document.body.dataset.historyRefreshStarted = "true";
    }, { once: true });
  });
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-history-refresh-started", "true");
  await expect(page.locator(".t3-records-toolbar-panel")).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
});

test("desktop rail keeps the same icons and collapse control across routes", async ({ page }) => {
  await installBaseBridge(page);
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  const icon = page.locator('aside a[href="#/history"] svg');
  const before = await icon.innerHTML();
  const controlBefore = (await page.getByRole("button", { name: "Expand sidebar" }).boundingBox())!;
  expect(controlBefore.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(icon).toBeVisible();
  expect(await icon.innerHTML()).toBe(before);
  expect((await page.getByRole("button", { name: "Expand sidebar" }).boundingBox())!.y)
    .toBeCloseTo(controlBefore.y, 0);
});

test("History has one sync status control when sync is enabled", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history", seedLockedSync: true });
  await page.goto("/#/history");
  await expect(page.getByTestId("history-snapshot-row").first()).toBeVisible();
  await expect(page.locator(".fidelity-page-head .desktop-sync-status-indicator")).toHaveCount(1);
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
});

test("empty History exposes sync unlock and refresh feedback controls", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-empty", seedLockedSync: true });
  await page.goto("/#/history");
  await expect(page.getByText("No snapshots yet")).toBeVisible();
  await expect(page.locator(".fidelity-page-head .desktop-sync-status-indicator")).toBeVisible();
  await page.getByRole("button", { name: "History filters" }).click();
  await expect(page.locator(".t3-records-toolbar-panel").getByRole("button", { name: "Refresh" })).toBeVisible();
});

test("loading history keeps the table and detail skeleton grid", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history", slowFidelityHistory: true });
  await page.goto("/#/history");
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await page.getByRole("button", { name: "7 days" }).click();
  await page.getByRole("button", { name: "All time" }).click();
  await expect(page.getByTestId("history-desktop-loading")).toBeVisible();
  expect((await page.locator(".fidelity-history-list").boundingBox())!.height).toBeCloseTo(768, 0);
  await expect(page.locator(".fidelity-history-pager .fidelity-skeleton")).toBeVisible();
  await expect(page.locator(".fidelity-history-pager .fidelity-skeleton"))
    .toHaveCSS("background-color", "rgb(36, 36, 42)");
  expect((await page.locator(".fidelity-history-list td .fidelity-skeleton").first().boundingBox())!.y)
    .toBeCloseTo(261.5, 0);
  for (const column of [2, 3, 4]) {
    const cell = (await page.locator(`.fidelity-history-list tbody tr:first-child td:nth-child(${column})`).boundingBox())!;
    const bar = (await page.locator(`.fidelity-history-list tbody tr:first-child td:nth-child(${column}) .fidelity-skeleton`).boundingBox())!;
    expect(cell.x + cell.width - bar.x - bar.width).toBeLessThanOrEqual(12);
  }
  const detailBox = (await page.getByTestId("history-desktop-loading").boundingBox())!;
  const secondBar = (await page.locator(".fidelity-history-skeleton-row").first().locator(".fidelity-skeleton").nth(1).boundingBox())!;
  expect(secondBar.x).toBeGreaterThan(detailBox.x + detailBox.width / 2);
  await expect(page.getByText("Page 1 of 26")).toHaveCount(0);
  await capture(page, "history-loading");
});

test("background data reload keeps the current history detail visible", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history", slowFidelityHistory: true });
  await page.goto("/#/history");
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$752,642.71");
  await page.evaluate(() => window.dispatchEvent(new Event("track3:soft-refresh")));
  await page.waitForTimeout(150);
  await expect(page.getByTestId("history-content")).toHaveAttribute("aria-busy", "false");
  expect(await page.getByTestId("history-desktop-detail").isVisible()).toBe(true);
  expect(await page.getByTestId("history-snapshot-row").count()).toBe(50);
});

test("large snapshot detail keeps a bounded table window with access to later assets", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-large" });
  await page.goto("/#/history");
  await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("68 assets");
  await expect(detail.locator("tbody tr")).toHaveCount(51);
  await detail.locator(".fidelity-detail-pager").getByRole("button", { name: "Next" }).click();
  await expect(detail.locator("tbody tr")).toHaveCount(19);
  await expect(detail).toContainText("51–68 of 68 assets");
});

test("light history uses readable theme colors", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  const colors = await page.locator(".fidelity-history").evaluate((root) => {
    const heading = root.querySelector("h1")!;
    const card = root.querySelector(".fidelity-card")!;
    return [getComputedStyle(heading).color, getComputedStyle(card).backgroundColor];
  });
  expect(colors).toEqual(["rgb(23, 23, 28)", "rgb(255, 255, 255)"]);
});

test("an asset can be deleted from a snapshot and restored with Undo", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("$763,809.27");
  await detail.getByRole("button", { name: "Delete BTC from snapshot" }).click();
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Delete & Blacklist" })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete asset" }).click();
  await expect(detail).not.toContainText("$763,809.27");
  await page.locator(".desktop-toast-viewport").getByRole("button", { name: "Undo" }).click();
  await expect(detail).toContainText("$763,809.27");
});

test("deleting the only asset removes the empty snapshot until Undo", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-single" });
  await page.goto("/#/history");
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(1);
  await page.getByTestId("history-desktop-detail").getByRole("button", { name: "Delete BTC from snapshot" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete asset" }).click();
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(0);
  await page.locator(".desktop-toast-viewport").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(1);
});

test("an empty edit filter can be cleared", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-single" });
  await page.goto("/#/history");
  await page.getByRole("button", { name: "Edited 0", exact: true }).click();
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(1);
});

test("records rail expands from its toggle and keeps navigation working", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  const expand = page.getByRole("button", { name: "Expand sidebar" });
  expect((await expand.boundingBox())!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  await expand.click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  await page.getByRole("link", { name: "Cost basis" }).click();
  await expect(page.getByRole("heading", { name: "Cost basis", exact: true })).toBeVisible();
});

test("a narrow desktop history window keeps its no-data action and follows resizing", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await installTauriBridge(page, { fidelityRecords: "history-empty" });
  await page.goto("/#/history");
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator(".fidelity-history-empty")).toBeVisible();
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
});

test("the empty History card returns after visiting Settings", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history-empty" });
  await page.goto("/#/history");
  await expect(page.getByText("No snapshots yet")).toBeVisible();
  await page.getByRole("button", { name: "History filters" }).click();
  await page.locator(".t3-records-settings-link").click();
  await expect(page).toHaveURL(/#\/settings\/configuration/);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/#\/history/, { timeout: 15_000 });
  await expect(page.getByText("No snapshots yet")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeVisible();
});

test("edit log failure keeps the selected snapshot visible", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history", failFidelityEditLog: true });
  await page.goto("/#/history");
  await expect(page.getByTestId("history-desktop-detail")).toContainText("$763,809.27");
  await expect(page.getByRole("region", { name: "Edits" })).toContainText("Could not load the edit log");
});

test("list query failure shows a retryable error", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "history", failFidelityHistoryList: true });
  await page.goto("/#/history");
  await expect(page.getByRole("alert")).toContainText("Could not load snapshots");
  await expect(page.locator(".fidelity-page-head p")).toContainText("Could not load snapshots");
  await expect(page.getByText("No snapshots yet")).toHaveCount(0);
});
