import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { executeSceneSql } from "./fidelity-records-scenes";
import { seedHistoryKpis } from "./history-kpi-scenes";

const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
const iPad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

test.use({ viewport: { width: 390, height: 844 }, userAgent: iPhone, isMobile: true, hasTouch: true });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "mobile"));

for (const theme of ["dark", "light"]) {
  test(`phone History change clears its divider in ${theme}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      userAgent: iPhone, isMobile: true, hasTouch: true, colorScheme: theme as "dark" | "light" });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await seedHistoryKpis(page, 883327.90, 1669806.58);
      await page.goto("/#/history", { waitUntil: "domcontentloaded" });
      await page.getByTestId("history-mobile-row").first().click();
      const detail = page.getByRole("dialog", { name: "Snapshot details" });
      await expect(detail).toContainText("786,478.68");
      await expect(detail).toContainText("−47.10%");
      await expect(detail.locator(".fidelity-history-section-head span").first()).toHaveText("11 assets");
      await page.evaluate(() => document.fonts.ready);
      const layout = await detail.locator(".fidelity-history-detail-subkpis").evaluate((strip) => {
        const cells = [...strip.children];
        const boxes = cells.map((cell) => {
          const value = cell.querySelector("strong")!;
          const range = document.createRange();
          range.selectNodeContents(value);
          const text = range.getBoundingClientRect();
          const box = cell.getBoundingClientRect();
          const style = getComputedStyle(cell);
          return { x: box.x, y: box.y, right: box.right, textRight: text.right,
            contentLeft: box.left + Number.parseFloat(style.paddingLeft),
            contentRight: box.right - Number.parseFloat(style.paddingRight),
            scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth,
            borderLeft: Number.parseFloat(style.borderLeftWidth),
            numeric: getComputedStyle(value).fontVariantNumeric,
            whiteSpace: getComputedStyle(value).whiteSpace };
        });
        return { scrollWidth: strip.scrollWidth, clientWidth: strip.clientWidth, boxes };
      });
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
      for (const box of layout.boxes) {
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
        expect(box.textRight).toBeLessThanOrEqual(box.right + 1);
        expect(box.numeric).toContain("tabular-nums");
        expect(box.whiteSpace).toBe("nowrap");
      }
      if (layout.boxes[0].y === layout.boxes[1].y) {
        expect(layout.boxes[1].borderLeft).toBe(1);
        expect(Math.abs(layout.boxes[1].x -
          (layout.boxes[0].contentRight + layout.boxes[1].contentLeft) / 2)).toBeLessThanOrEqual(1);
        expect(layout.boxes[0].textRight).toBeLessThanOrEqual(layout.boxes[1].x - 16);
      } else expect(layout.boxes[0].y).toBeLessThan(layout.boxes[1].y);
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await detail.screenshot({ path: `/tmp/history-kpi-overflow/history-phone-${theme}.png` });
    } finally {
      await context.close();
    }
  });

  test(`iPad History detail stays inside its cards in ${theme}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: { width: 820, height: 1024 },
      userAgent: iPad, isMobile: true, hasTouch: true, colorScheme: theme as "dark" | "light" });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await seedHistoryKpis(page, 883327.90, 1669806.58);
      await page.goto("/#/history", { waitUntil: "domcontentloaded" });
      await page.getByTestId("history-mobile-row").first().click();
      const detail = page.getByRole("dialog", { name: "Snapshot details" });
      await expect(detail).toBeVisible();
      await expect(detail.locator(".fidelity-history-detail-subkpis > div:last-child strong")).toHaveText("11");
      await page.evaluate(() => document.fonts.ready);
      const failures = await detail.evaluate((root) => [...root.querySelectorAll("p, strong")].flatMap((node) => {
        const box = node.getBoundingClientRect();
        if (!box.width || getComputedStyle(node).whiteSpace !== "nowrap") return [];
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        const parent = node.parentElement!;
        const right = parent.getBoundingClientRect().right - parseFloat(getComputedStyle(parent).paddingRight);
        return node.scrollWidth > node.clientWidth || text.right > right + 1 ? [node.textContent] : [];
      }));
      expect(failures).toEqual([]);
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await detail.screenshot({ path: `/tmp/history-kpi-overflow/history-ipad-${theme}.png` });
    } finally {
      await context.close();
    }
  });
}

for (const theme of ["dark", "light"]) {
for (const [name, total, previous, currency, symbol, expected] of [
  ["JPY loss", 1_000_000, 12_346_678_901.23, "JPY", "¥", "12,345,678,901.23"],
  ["CNY loss", 1_000_000, 12_346_678_901.23, "CNY", "¥", "12,345,678,901.23"],
  ["KRW loss", 1_000_000, 12_346_678_901.23, "KRW", "₩", "12,345,678,901.23"],
  ["gain", 1_000_999.99, 1000, "", "", "999,999.99"],
  ["zero", 0, 0, "", "", "0.00"],
  ["no previous", 0, undefined, "", "", "No earlier snapshot"],
] as const) {
  test(`phone History detail contains ${name} in ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await seedHistoryKpis(page, total, previous);
    if (currency) {
      await executeSceneSql(page,
        "INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, 1, 1, '2099-01-01T00:00:00.000Z')",
        [currency, currency, symbol]);
      await executeSceneSql(page, "INSERT INTO configuration (id, data) VALUES (7, ?)", [currency]);
    }
    await page.goto("/#/history", { waitUntil: "domcontentloaded" });
    await page.getByTestId("history-mobile-row").first().click();
    const detail = page.getByRole("dialog", { name: "Snapshot details" });
    await expect(detail).toContainText(expected);
    const amounts = await detail.locator(".fidelity-history-detail-kpis strong").evaluateAll((nodes) =>
      nodes.map((node) => ({ text: node.textContent, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
        right: node.getBoundingClientRect().right, parentRight: node.parentElement!.getBoundingClientRect().right })));
    for (const amount of amounts) {
      expect(amount.scrollWidth).toBeLessThanOrEqual(amount.clientWidth);
      expect(amount.right).toBeLessThanOrEqual(amount.parentRight + 1);
    }
    const columns = await detail.locator(".fidelity-history-detail-subkpis").evaluate((strip) => {
      const first = strip.firstElementChild!;
      const second = strip.lastElementChild!;
      const value = first.querySelector("strong")!;
      const range = document.createRange();
      range.selectNodeContents(value);
      return { scrollWidth: strip.scrollWidth, clientWidth: strip.clientWidth,
        gap: second.getBoundingClientRect().left - range.getBoundingClientRect().right };
    });
    expect(columns.scrollWidth).toBeLessThanOrEqual(columns.clientWidth);
    expect(columns.gap).toBeGreaterThanOrEqual(16);
  });
}
}
