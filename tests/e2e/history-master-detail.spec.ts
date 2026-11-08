import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { installTauriBridge } from "./fidelity-bridge-captures";

const screenshotDir = "/tmp/track3-history-master-detail";

async function assertNoBlankSlabs(page: Page) {
  const panes = await page.locator(".fidelity-history-grid").evaluate((grid) => {
    const rect = (selector: string) => {
      const box = grid.querySelector(selector)!.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width };
    };
    const gridBox = grid.getBoundingClientRect();
    return { grid: { top: gridBox.top, bottom: gridBox.bottom },
      list: rect(".fidelity-history-list"), detail: rect(".fidelity-history-detail") };
  });
  expect(Math.abs(panes.list.top - panes.detail.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(panes.list.bottom - panes.detail.bottom)).toBeLessThanOrEqual(1);
  for (const pane of [panes.list, panes.detail]) {
    expect(pane.width >= 120 && panes.grid.bottom - pane.bottom >= 120).toBe(false);
    expect(pane.width >= 120 && pane.top - panes.grid.top >= 120).toBe(false);
  }
}

async function assertSelectedVisible(page: Page) {
  const bounds = await page.locator(".fidelity-history-list-scroll").evaluate((pane) => {
    const row = pane.querySelector("tr.selected")!.getBoundingClientRect();
    const area = pane.getBoundingClientRect();
    const head = pane.querySelector("thead")!.getBoundingClientRect();
    return { rowTop: row.top, rowBottom: row.bottom, top: area.top + head.height, bottom: area.bottom };
  });
  expect(bounds.rowTop).toBeGreaterThanOrEqual(bounds.top - 1);
  expect(bounds.rowBottom).toBeLessThanOrEqual(bounds.bottom + 1);
}

for (const scheme of ["dark", "light"] as const) {
  test.describe(`History master detail ${scheme}`, () => {
    test.use({ colorScheme: scheme, timezoneId: "UTC", reducedMotion: "reduce" });

    test("both panes stay aligned and independently scroll at desktop sizes", async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), scheme);
      await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
      await page.goto("/#/history");
      const list = page.locator(".fidelity-history-list-scroll");
      const detail = page.locator(".fidelity-history-detail-scroll");
      await expect(page.getByTestId("history-snapshot-row")).toHaveCount(50);
      await expect(page.locator(".fidelity-page-head")).toContainText("1,038");
      await page.getByTestId("history-snapshot-row").filter({ hasText: "28 Oct 08:51" }).click();
      await expect(page.locator(".fidelity-history-detail-kpis")).toContainText("47");
      await expect(page.locator(".fidelity-history-detail-kpis")).toContainText("17");
      await expect(page.locator(".fidelity-history-edit-log li")).toHaveCount(4);
      await expect(page.locator(".fidelity-history-edit-log")).toContainText("Deleted asset TEST01");
      await expect(page.locator(".fidelity-history-edit-log")).toContainText("Restored asset TEST01");
      await expect(detail.getByRole("button", { name: "Show all (47)" })).toBeVisible();
      await expect(detail.getByRole("button", { name: "Show all (17)" })).toBeVisible();
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      await detail.getByRole("button", { name: "Show all (47)" }).click();
      await expect(detail.locator("table tbody tr")).toHaveCount(48);
      await detail.getByRole("button", { name: "Show less" }).first().click();
      await detail.getByRole("button", { name: "Show all (17)" }).click();
      await expect(detail.locator(".fidelity-history-source-row")).toHaveCount(17);
      const sections = page.locator(".fidelity-history-section-nav");
      for (const [name, id] of [["Edits", "#history-edits"], ["Sources", "#history-sources"]] as const) {
        await sections.getByRole("button", { name }).click();
        await expect.poll(async () => {
          const pane = (await detail.boundingBox())!;
          const section = (await detail.locator(id).boundingBox())!;
          return Math.abs(section.y - pane.y);
        }).toBeLessThanOrEqual(1);
      }
      await sections.getByRole("button", { name: "Assets" }).click();
      await expect.poll(() => detail.evaluate((node) => node.scrollTop)).toBe(0);

      await mkdir(screenshotDir, { recursive: true });
      for (const [width, height] of [[900, 560], [1100, 640], [1280, 720], [1440, 900], [1920, 1080],
        [1280, 560], [1280, 640], [1280, 900], [1280, 1080]]) {
        await page.setViewportSize({ width, height });
        await expect(page.getByTestId("history-desktop-detail")).toBeVisible();
        if (width === 900) {
          expect(await page.getByTestId("history-snapshot-row").first().evaluate((node) => node.getBoundingClientRect().height))
            .toBeCloseTo(39, 0);
          await expect(list.locator("th", { hasText: "Change" })).toBeVisible();
          await expect(page.getByTestId("history-snapshot-row").first().locator("td").nth(2)).toContainText("%");
          expect(await list.evaluate((node) => node.querySelector("table")!.getBoundingClientRect().width - node.clientWidth))
            .toBeLessThanOrEqual(1);
          expect(await list.locator("tbody td:visible").evaluateAll((cells) =>
            cells.flatMap((cell, index) => cell.scrollWidth <= cell.clientWidth + 1 ? [] :
              [{ index, scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth }]))).toEqual([]);
          const kpis = await page.locator(".fidelity-history-detail-kpis strong").evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
            }));
          for (let index = 1; index < kpis.length; index++) {
            expect(kpis[index].top >= kpis[index - 1].bottom - 1 ||
              kpis[index].left >= kpis[index - 1].right - 1).toBe(true);
          }
        }
        for (const pane of [list, detail]) {
          for (const fraction of [0, 0.5, 1]) {
            await pane.evaluate((node, value) => { node.scrollTop = (node.scrollHeight - node.clientHeight) * value; }, fraction);
            await assertNoBlankSlabs(page);
            const footer = (await page.locator(".fidelity-history-footer").boundingBox())!;
            const listBox = (await page.locator(".fidelity-history-list").boundingBox())!;
            expect(footer.y + footer.height).toBeLessThanOrEqual(listBox.y + listBox.height + 1);
            await expect(page.getByRole("button", { name: "Next", exact: true }).first()).toBeInViewport();
            expect(await page.locator("#app-main-content").evaluate((node) => node.scrollTop)).toBe(0);
          }
        }
        if (height === 720 || height === 560) {
          await page.screenshot({ path: `${screenshotDir}/${scheme}-${width}x${height}.png`, animations: "disabled" });
        }
      }
      await detail.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      await page.getByTestId("history-snapshot-row").nth(1).click();
      await expect.poll(() => detail.evaluate((node) => node.scrollTop)).toBe(0);
      await list.evaluate((node) => { node.scrollTop = 0; });
      expect(await page.getByTestId("history-snapshot-row").first().evaluate((node) => node.getBoundingClientRect().height))
        .toBeCloseTo(39, 0);
      await page.getByTestId("history-snapshot-row").first().locator("button").focus();
      for (const key of ["End", "Home", "PageDown", "ArrowDown", "PageUp"]) {
        await page.keyboard.press(key);
        await assertSelectedVisible(page);
      }
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("history-desktop-detail")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fidelity-history-list-scroll tr.selected button")).toBeFocused();
      await page.getByRole("button", { name: "Next", exact: true }).first().click();
      await expect(page.locator(".fidelity-history-pager")).toContainText("51–100 of 1,038");
      await assertSelectedVisible(page);
    });

    test("desktop app at 820px uses list and detail screens and restores list scroll", async ({ page }) => {
      await page.setViewportSize({ width: 820, height: 900 });
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), scheme);
      await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
      await page.goto("/#/history");
      await mkdir(screenshotDir, { recursive: true });
      const list = page.locator(".fidelity-history-list-scroll");
      await expect(page.getByTestId("history-snapshot-row")).toHaveCount(50);
      await expect(page.getByTestId("history-desktop-detail")).toBeHidden();
      await list.evaluate((node) => { node.scrollTop = 440; });
      const savedScrollTop = await list.evaluate((node) => node.scrollTop);
      expect(savedScrollTop).toBeGreaterThan(0);
      const row = page.getByTestId("history-snapshot-row").nth(15);
      await row.click();
      await expect(page.getByTestId("history-desktop-detail")).toBeVisible();
      await expect(page.getByTestId("history-desktop-detail")).toBeFocused();
      await expect(page.getByRole("button", { name: "Back to snapshots" })).toBeVisible();
      await expect(page.getByTestId("history-desktop-detail")).toHaveCSS("outline-style", "none");
      await expect(page.locator(".fidelity-history-list")).toBeHidden();
      await page.screenshot({ path: `${screenshotDir}/${scheme}-ipad-detail.png`, animations: "disabled" });
      await page.getByRole("button", { name: "Back to snapshots" }).click();
      await expect(page.locator(".fidelity-history-list")).toBeVisible();
      await expect(page.getByTestId("history-desktop-detail")).toBeHidden();
      await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBe(savedScrollTop);
      await expect(row).toHaveClass(/selected/);
      await page.screenshot({ path: `${screenshotDir}/${scheme}-ipad-list.png`, animations: "disabled" });
      const keyboardRow = page.getByTestId("history-snapshot-row").nth(16);
      await keyboardRow.locator("button").focus();
      await page.keyboard.press("Enter");
      await expect(keyboardRow).toHaveClass(/selected/);
      await expect(page.getByTestId("history-desktop-detail")).toBeFocused();
      await expect(page.getByTestId("history-desktop-detail")).not.toHaveCSS("outline-style", "none");
      await page.keyboard.press("Escape");
      await expect(keyboardRow.locator("button")).toBeFocused();
      await expect(page.locator(".fidelity-history-list")).toBeVisible();
    });
  });
}

test("900px Chinese History keeps Assets and Sources visible", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 560 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
  await page.goto("/#/history");
  const list = page.locator(".fidelity-history-list-scroll");
  await expect(page.getByTestId("history-snapshot-row")).toHaveCount(50);
  expect(await list.evaluate((node) => node.querySelector("table")!.getBoundingClientRect().width - node.clientWidth))
    .toBeLessThanOrEqual(1);
  await expect(list.locator("th").nth(3)).toBeInViewport();
  await expect(list.locator("th").nth(4)).toBeInViewport();
  expect(await list.locator("tbody td:visible").evaluateAll((cells) =>
    cells.flatMap((cell, index) => cell.scrollWidth <= cell.clientWidth + 1 ? [] :
      [{ index, scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth }]))).toEqual([]);
});

test("700px desktop History opens a full detail screen with Back", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, { fidelityRecords: "history-master-detail" });
  await page.goto("/#/history");
  await expect(page.locator(".t3-manage-history tbody tr").first()).toBeVisible();
  await page.locator(".t3-manage-history tbody tr").first().click();
  const detail = page.locator(".t3-history-detail");
  await expect(detail).toBeVisible();
  await expect.poll(async () => {
    const box = (await detail.boundingBox())!;
    return Math.max(Math.abs(box.x), Math.abs(box.y), Math.abs(box.width - 700), Math.abs(box.height - 900));
  }).toBeLessThanOrEqual(1);
  await expect(detail.getByRole("button", { name: "Back to snapshots" })).toBeVisible();
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: `${screenshotDir}/desktop-700-detail.png`, animations: "disabled" });
  await detail.getByPlaceholder("Search symbol, e.g. BTC").fill("BTC");
  await expect(detail.getByRole("region", { name: "Assets" })).toContainText("BTC");
  await expect(detail.getByRole("region", { name: "Assets" })).not.toContainText("ETH");
  await detail.getByRole("button", { name: "Back to snapshots" }).click();
  await expect(page.locator(".t3-manage-history tbody tr").first()).toBeVisible();
  await expect(detail).toBeHidden();
});
