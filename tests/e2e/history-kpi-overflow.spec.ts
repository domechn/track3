import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { executeSceneSql } from "./fidelity-records-scenes";
import { seedHistoryKpis } from "./history-kpi-scenes";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

test("History design source provides the comparison bounds", async ({ page }) => {
  const path = "/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/records-history.html";
  test.skip(!existsSync(path), "local design source is unavailable");
  await page.setViewportSize({ width: 1600, height: 1024 });
  await page.goto(pathToFileURL(path).href, { waitUntil: "domcontentloaded" });
  const strip = page.locator(".hd .kpis");
  await expect(strip).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const measurements = await strip.evaluate((element) => ({
    strip: element.getBoundingClientRect().toJSON(),
    columns: [...element.children].map((cell) => ({
      box: cell.getBoundingClientRect().toJSON(),
      padding: getComputedStyle(cell).padding,
      fontSize: getComputedStyle(cell.querySelector(".v")!).fontSize,
      lineHeight: getComputedStyle(cell.querySelector(".v")!).lineHeight,
    })),
  }));
  expect(measurements.columns[0].fontSize).toBe("22px");
  mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
  writeFileSync("/tmp/history-kpi-overflow/design-history-bounds.json", JSON.stringify(measurements, null, 2));
  await page.screenshot({ path: "/tmp/history-kpi-overflow/design-history-1600.png", fullPage: true });
});

async function kpiGeometry(page: import("@playwright/test").Page) {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return page.locator(".fidelity-history-detail-kpis").evaluate((strip) => {
    const cells = [...strip.children] as HTMLElement[];
    const measure = (node: Element) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    };
    const boxes = cells.map((cell) => {
      const value = cell.querySelector("strong")!;
      const content = measure(value);
      const box = cell.getBoundingClientRect();
      const style = getComputedStyle(cell);
      return {
        x: box.x, y: box.y, width: box.width, right: box.right,
        contentLeft: box.left + Number.parseFloat(style.paddingLeft),
        contentRight: box.right - Number.parseFloat(style.paddingRight),
        textLeft: content.left, textRight: content.right,
        scrollWidth: cell.scrollWidth, clientWidth: cell.clientWidth,
        borderLeft: Number.parseFloat(style.borderLeftWidth),
        borderTop: Number.parseFloat(style.borderTopWidth),
        captionBottom: cell.querySelector("small")!.getBoundingClientRect().bottom,
        labelTop: cell.querySelector("span")!.getBoundingClientRect().top,
        fontSize: Number.parseFloat(getComputedStyle(value).fontSize),
        fontWeight: getComputedStyle(value).fontWeight,
        numeric: getComputedStyle(value).fontVariantNumeric,
        whiteSpace: getComputedStyle(value).whiteSpace,
        captionLines: (() => {
          const range = document.createRange();
          range.selectNodeContents(cell.querySelector("small")!);
          return new Set([...range.getClientRects()].map((rect) => rect.y)).size;
        })(),
      };
    });
    return { fit: (strip as HTMLElement).dataset.fit, stripWidth: strip.clientWidth, scrollWidth: strip.scrollWidth, boxes };
  });
}

function expectStackedDividers(boxes: Awaited<ReturnType<typeof kpiGeometry>>["boxes"]) {
  for (let index = 1; index < boxes.length; index++) {
    const divider = boxes[index].y;
    const above = divider - boxes[index - 1].captionBottom;
    const below = boxes[index].labelTop - divider - boxes[index].borderTop;
    expect(boxes[index].borderTop).toBe(1);
    expect(above).toBeGreaterThanOrEqual(11);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
  }
}

test("History seven digit USD change fits at 1280 and 1440", async ({ page }) => {
  test.setTimeout(120_000);
  await seedHistoryKpis(page, 9_883_327.90, 19_669_806.58);
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("−$9,786,478.68", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const { stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
    expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
    for (const box of boxes) {
      expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
      expect(box.textRight).toBeLessThanOrEqual(box.contentRight + 1);
    }
    mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
    await detail.screenshot({ path: `/tmp/history-kpi-overflow/history-seven-digit-${width}.png` });
  }
});

test("History seven digit total and small change use available column padding at 1440", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedHistoryKpis(page, 9_883_327.90, 9_883_000);
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("$9,883,327.90", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  const { stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
  expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
  expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
  for (const box of boxes) expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
  for (let index = 1; index < boxes.length; index++)
    expect(boxes[index].textLeft - boxes[index - 1].textRight).toBeGreaterThanOrEqual(16);
});

for (const width of [1100, 1280, 1440, 1920]) {
  for (const theme of ["dark", "light"]) {
    test(`History detail contains the reported change at ${width}px in ${theme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await seedHistoryKpis(page, 883327.90, 1669806.58);
      await page.goto("/#/history");
      const detail = page.getByTestId("history-desktop-detail");
      await expect(detail).toContainText("$883,327.90", { timeout: 30_000 });
      await expect(detail).toContainText("−$786,478.68");
      await expect(detail).toContainText("−47.10%");
      await expect(detail.locator(".fidelity-history-detail-kpis")).toContainText("11");
      await expect(detail.locator(".fidelity-history-detail-kpis")).toContainText("16 of 16 sources");
      await page.evaluate(() => document.fonts.ready);
      const { fit, stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
      expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
      const expectedFit = width === 1280 ? "stacked" : width === 1920 ? "roomy" : "tight";
      expect(fit).toBe(expectedFit);
      expect(new Set(boxes.map((box) => box.y)).size).toBe(width === 1280 ? 3 : 1);
      if (fit === "stacked") expectStackedDividers(boxes);
      expect(boxes[0].fontSize).toBe(fit === "stacked" ? 20 : 22);
      for (const box of boxes) {
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
        expect(box.textLeft).toBeGreaterThanOrEqual(box.contentLeft - 1);
        expect(box.textRight).toBeLessThanOrEqual(box.contentRight + 1);
        expect(box.numeric).toContain("tabular-nums");
        expect(box.whiteSpace).toBe("nowrap");
        expect(box.fontWeight).toBe("500");
        expect(box.captionLines).toBe(1);
      }
      for (let index = 1; index < boxes.length; index++) {
        const left = boxes[index - 1], right = boxes[index];
        if (Math.abs(left.y - right.y) > 1) continue;
        expect(right.borderLeft).toBe(1);
        expect(Math.abs(right.x - (left.contentRight + right.contentLeft) / 2)).toBeLessThanOrEqual(1);
        expect(right.textLeft - left.textRight).toBeGreaterThanOrEqual(16);
        if (fit === "spread")
          expect(Math.abs(right.width - left.width)).toBeLessThanOrEqual(1);
      }
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await detail.screenshot({ path: `/tmp/history-kpi-overflow/history-owner-${width}-${theme}.png` });
    });
  }
}

test("History card keeps three content-sized columns until it becomes narrow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await seedHistoryKpis(page, 883327.90, 1669806.58);
  await page.goto("/#/history");
  const detail = page.getByTestId("history-desktop-detail");
  await expect(detail).toContainText("−$786,478.68", { timeout: 30_000 });
  for (const [cardWidth, fontSize] of [[1050, 22], [700, 22], [540, 22]]) {
    await detail.evaluate((card: HTMLElement, width) => { card.style.width = `${width}px`; }, cardWidth + 42);
    const { stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
    expect(stripWidth).toBeGreaterThanOrEqual(cardWidth - 10);
    expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
    expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
    expect(boxes[0].fontSize).toBe(fontSize);
    if (cardWidth === 1050) {
      expect(Math.max(...boxes.map((box) => box.width)) -
        Math.min(...boxes.map((box) => box.width))).toBeLessThanOrEqual(1);
    }
    for (let index = 1; index < boxes.length; index++) {
      const left = boxes[index - 1], right = boxes[index];
      expect(right.borderLeft).toBe(1);
      expect(Math.abs(right.x - (left.contentRight + right.contentLeft) / 2)).toBeLessThanOrEqual(1);
      expect(right.textLeft - left.textRight).toBeGreaterThanOrEqual(16);
    }
    if (cardWidth === 1050) {
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await detail.screenshot({ path: "/tmp/history-kpi-overflow/history-owner-card-1050.png" });
    }
  }
  await detail.evaluate((card: HTMLElement) => { card.style.width = "412px"; });
  await expect(detail.locator(".fidelity-history-detail-kpis")).toHaveAttribute("data-fit", "stacked");
  const compact = await kpiGeometry(page);
  expect(compact.scrollWidth).toBeLessThanOrEqual(compact.stripWidth);
  expect(compact.boxes[0].y).toBeLessThan(compact.boxes[1].y);
  expect(compact.boxes[1].y).toBeLessThan(compact.boxes[2].y);
  expectStackedDividers(compact.boxes);
  for (const box of compact.boxes.slice(1)) {
    expect(box.borderTop).toBe(1);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
    expect(box.textRight).toBeLessThanOrEqual(box.contentRight + 1);
  }
  await detail.screenshot({ path: "/tmp/history-kpi-overflow/history-owner-card-370.png" });
});

for (const [currency, symbol] of [["CNY", "¥"], ["JPY", "¥"], ["KRW", "₩"]] as const) {
  for (const theme of ["dark", "light"]) {
    test(`History detail keeps an 11 digit negative change in ${currency} inside in ${theme}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1100, height: 1000 });
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await seedHistoryKpis(page, 1_000_000, 12_346_678_901.23);
      await executeSceneSql(page,
        "INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, 1, 1, '2099-01-01T00:00:00.000Z')",
        [currency, currency, symbol]);
      await executeSceneSql(page, "INSERT INTO configuration (id, data) VALUES (7, ?)", [currency]);
      await page.goto("/#/history");
      const detail = page.getByTestId("history-desktop-detail");
      await expect(detail).toContainText(`−${symbol}12,345,678,901.23`, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1100, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const { stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
        expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
        if (new Set(boxes.map((box) => box.y)).size === 3) expectStackedDividers(boxes);
        else for (let index = 1; index < boxes.length; index++) {
          expect(boxes[index].borderLeft).toBe(1);
          expect(boxes[index].textLeft - boxes[index - 1].textRight).toBeGreaterThanOrEqual(16);
        }
        for (const box of boxes) {
          expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
          expect(box.textRight).toBeLessThanOrEqual(box.contentRight + 1);
        }
        const cellFits = await detail.locator("table").first().evaluate((table) =>
          [...table.querySelectorAll("tbody tr")].filter((row) =>
            row.textContent?.includes("COIN10") || row.classList.contains("fidelity-history-total"))
            .map((row) => {
              const visible = [...row.children].filter((cell) => getComputedStyle(cell).display !== "none");
              const textBox = (cell: Element) => {
                const range = document.createRange();
                range.selectNodeContents(cell);
                return range.getBoundingClientRect();
              };
              return visible.filter((cell) => cell.textContent?.trim()).every((cell) => {
                const box = cell.getBoundingClientRect(), text = textBox(cell);
                return text.left >= box.left - 1 && text.right <= box.right + 1;
              });
            }));
        expect(cellFits).toEqual([true, true]);
        if (width >= 1500) {
          const valueShareGaps = await detail.locator("table").first().evaluate((table) =>
            [...table.querySelectorAll("tbody tr")].filter((row) =>
              row.textContent?.includes("COIN10") || row.classList.contains("fidelity-history-total"))
              .map((row) => {
                const textBox = (cell: Element) => {
                  const range = document.createRange();
                  range.selectNodeContents(cell);
                  return range.getBoundingClientRect();
                };
                return textBox(row.children[4]).left - textBox(row.children[3]).right;
              }));
          expect(valueShareGaps).toHaveLength(2);
          for (const gap of valueShareGaps) expect(gap).toBeGreaterThanOrEqual(8);
        }
        if (width < 1500) await expect(detail.locator(".fidelity-history-compact-share").first()).toBeVisible();
        expect(await detail.locator("table").first().evaluate((table) => {
          const card = table.closest(".fidelity-history-detail")!;
          const contentRight = card.getBoundingClientRect().right -
            Number.parseFloat(getComputedStyle(card).paddingRight);
          return table.getBoundingClientRect().right <= contentRight + 1;
        })).toBe(true);
        if (currency === "JPY") {
          mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
          await detail.screenshot({ path: `/tmp/history-kpi-overflow/history-extreme-jpy-${width}-${theme}.png` });
        }
      }
    });
  }
}

for (const [name, total, previous, expected] of [
  ["gain", 1_000_999.99, 1000, "+$999,999.99"],
  ["zero", 0, 0, "$0.00"],
  ["no previous", 0, undefined, "No earlier snapshot"],
] as const) {
  for (const theme of ["dark", "light"] as const) test(`History detail contains ${name} without overflowing in ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await seedHistoryKpis(page, total, previous);
    await page.goto("/#/history");
    const detail = page.getByTestId("history-desktop-detail");
    await expect(detail).toContainText(expected, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1100, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const { stripWidth, scrollWidth, boxes } = await kpiGeometry(page);
      expect(scrollWidth).toBeLessThanOrEqual(stripWidth);
      if (new Set(boxes.map((box) => box.y)).size === 3) expectStackedDividers(boxes);
      for (const box of boxes) {
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
        expect(box.textRight).toBeLessThanOrEqual(box.contentRight + 1);
      }
    }
  });
}
