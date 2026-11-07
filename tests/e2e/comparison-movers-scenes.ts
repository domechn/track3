import { expect, type Page } from "@playwright/test";

export async function seedComparisonMoversFixture(page: Page) {
  await page.evaluate(async () => {
    const invoke = (window as any).__e2eInvoke as (command: string, args: unknown) => Promise<unknown>;
    const run = (query: string, values: unknown[] = []) =>
      invoke("plugin:sql|execute", { query, values });
    await run("DELETE FROM assets_v2 WHERE uuid IN ('fidelity-day-0', 'fidelity-day-30')");
    const changes: [string, number, number, "crypto" | "stock"][] = [
      ["SCHD", 1.48, 100, "stock"], ["VIG", 1.30, 90, "stock"],
      ["USD", 0, 0, "stock"], ["XPL", -0.97, -20, "crypto"],
      ["QQQI", -1.29, -30, "stock"], ["USDT", -2.23, -4000, "crypto"],
      ["1211.HK", -2.44, -50, "stock"], ["BTC", -4, -318305, "crypto"],
      ["ETH", -5.19, -420, "crypto"], ["BNB", -6.92, -35571, "crypto"],
      ["PLUME", -6.92, -79, "crypto"],
    ];
    for (const [symbol, percent, delta, type] of changes) {
      const base = percent ? delta / (percent / 100) : 1000;
      for (const [uuid, day, value] of [
        ["fidelity-day-0", "01", base],
        ["fidelity-day-30", "31", base + delta],
      ] as const) {
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid, `2026-10-${day}T09:41:00.000Z`, "comparison-fixture", type, symbol, 1, value, value]);
      }
    }
  });
}

export async function seedLargeMoverChange(page: Page) {
  await page.evaluate(async () => {
    const invoke = (window as any).__e2eInvoke as (command: string, args: unknown) => Promise<unknown>;
    const base = 7_433_476.36 / 36.1122;
    for (const [uuid, value] of [
      ["fidelity-day-0", base], ["fidelity-day-30", base + 7_433_476.36],
    ] as const) {
      await invoke("plugin:sql|execute", {
        query: "UPDATE assets_v2 SET value = ?, price = ? WHERE uuid = ? AND symbol = 'SCHD'",
        values: [value, value, uuid],
      });
    }
  });
}

export async function expectMinimumGainPixels(page: Page, rowSelector: string, plotSelector: string) {
  const track = page.locator(rowSelector).filter({ hasText: "SCHD" }).first().locator(plotSelector);
  await track.scrollIntoViewIfNeeded();
  const screenshot = await track.screenshot();
  const bar = await track.evaluate((node) => {
    const element = node.firstElementChild!;
    return { width: element.getBoundingClientRect().width, color: getComputedStyle(element).backgroundColor };
  });
  expect(bar.width).toBeGreaterThanOrEqual(1.9);
  expect(bar.width).toBeLessThan(3);
  const coloredPixels = await page.evaluate(async ({ image, color }) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${image}`;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, Math.floor(bitmap.height / 2), bitmap.width, 1).data;
    const target = color.match(/\d+/g)!.slice(0, 3).map(Number);
    let count = 0;
    for (let x = 0; x < bitmap.width; x++) {
      const offset = x * 4;
      if (target.every((channel, index) => Math.abs(channel - pixels[offset + index]) <= 20)) count++;
    }
    return count;
  }, { image: screenshot.toString("base64"), color: bar.color });
  expect(coloredPixels, "minimum gain bar has fewer than two colored pixels").toBeGreaterThanOrEqual(2);
}

export async function forceSubgridFallback(page: Page) {
  await page.evaluate(() => {
    const fallbackRules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].filter((rule): rule is CSSSupportsRule => rule instanceof CSSSupportsRule &&
          rule.conditionText.startsWith("not") && rule.conditionText.includes("grid-template-columns: subgrid"))
          .flatMap((rule) => [...rule.cssRules].map((nested) => nested.cssText));
      } catch {
        return [];
      }
    });
    const style = document.createElement("style");
    style.textContent = fallbackRules.join("\n");
    document.head.append(style);
  });
}

export async function expectFallbackDivider(page: Page, listSelector: string, rowHeight: number, lineOffset: number) {
  const list = page.locator(listSelector).first();
  await list.scrollIntoViewIfNeeded();
  const screenshot = await list.screenshot();
  const { contrast, samples } = await page.evaluate(async ({ image, lineY }) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${image}`;
    await bitmap.decode();
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const x = 4;
    const fill = context.getImageData(x, lineY + 7, 1, 1).data;
    const samples = Array.from({ length: 7 }, (_, index) => [...context.getImageData(x, lineY - 3 + index, 1, 1).data].slice(0, 3));
    return {
      contrast: Math.max(...samples.map((line) => [0, 1, 2].reduce((sum, index) => sum + Math.abs(line[index] - fill[index]), 0))),
      samples,
    };
  }, { image: screenshot.toString("base64"), lineY: rowHeight + lineOffset });
  const background = await list.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(contrast, `fallback row divider is invisible: ${JSON.stringify({ samples, background })}`).toBeGreaterThan(9);
}

export async function expectMoverGeometry(page: Page, cardSelector: string, rowSelector: string, plotSelector: string, expectedRowHeight: number) {
  const cards = page.locator(cardSelector);
  await expect(cards).toHaveCount(2);
  const cardBoxes = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  const [a, b] = cardBoxes;
  expect(a && b && (a.x + a.width <= b.x || b.x + b.width <= a.x ||
    a.y + a.height <= b.y || b.y + b.height <= a.y)).toBe(true);

  for (const card of await cards.all()) {
    const rows = card.locator(rowSelector);
    expect(await rows.count()).toBeGreaterThan(0);
    const geometry = await rows.evaluateAll((nodes, selector) => nodes.map((node) => {
      const row = node.getBoundingClientRect();
      const plotElement = node.querySelector(selector)!;
      const plot = plotElement.getBoundingClientRect();
      const bar = plotElement.firstElementChild?.getBoundingClientRect();
      const label = node.firstElementChild!.getBoundingClientRect();
      const values = [...node.children].slice(2)
        .filter((child) => getComputedStyle(child).display !== "none")
        .map((child) => ({ box: child.getBoundingClientRect(),
          fits: child.scrollWidth <= child.clientWidth }));
      return { symbol: node.firstElementChild?.textContent,
        labelFits: node.firstElementChild!.scrollWidth <= node.firstElementChild!.clientWidth,
        row: { x: row.x, y: row.y, width: row.width, height: row.height },
        plot: { x: plot.x, y: plot.y, width: plot.width, height: plot.height },
        bar: bar && { x: bar.x, y: bar.y, width: bar.width, height: bar.height },
        label: { x: label.x, width: label.width },
        values: values.map(({ box, fits }) => ({ x: box.x, width: box.width, fits })) };
    }), plotSelector);
    const cardBox = (await card.boundingBox())!;
    for (const { symbol, labelFits, row, plot, bar, label, values } of geometry) {
      expect(labelFits, `${symbol} symbol is clipped`).toBe(true);
      expect(Math.abs(row.height - expectedRowHeight)).toBeLessThan(0.1);
      expect(Math.abs(row.height - geometry[0].row.height)).toBeLessThan(0.1);
      expect(row.y).toBeGreaterThanOrEqual(cardBox.y - 1);
      expect(row.y + row.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
      expect(plot.width).toBeGreaterThanOrEqual(60);
      expect(Math.abs(plot.x - geometry[0].plot.x), `${symbol} plot starts at a different x`).toBeLessThan(0.5);
      expect(Math.abs(plot.width - geometry[0].plot.width), `${symbol} plot has a different width`).toBeLessThan(0.5);
      expect(plot.x).toBeGreaterThanOrEqual(label.x + label.width - 1);
      for (const value of values) {
        expect(value.fits, `${symbol} value is clipped`).toBe(true);
        expect(plot.x + plot.width).toBeLessThanOrEqual(value.x + 1);
        expect(value.x + value.width, `${symbol} value leaves card`).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
      if (!bar) continue;
      expect(bar.x, `${symbol}: ${JSON.stringify({ plot, bar })}`).toBeGreaterThanOrEqual(plot.x - 1);
      expect(bar.x + bar.width).toBeLessThanOrEqual(plot.x + plot.width + 1);
      expect(bar.y).toBeGreaterThanOrEqual(plot.y - 1);
      expect(bar.y + bar.height).toBeLessThanOrEqual(plot.y + plot.height + 1);
    }
    const more = card.locator(".comparison-movers-more, .t3-cmp-movers-more, .fd-comparison-more");
    if (await more.count()) {
      await expect(more).toHaveAttribute("aria-expanded", "false");
      await more.click();
      await expect(more).toHaveAttribute("aria-expanded", "true");
      const after = await rows.count();
      expect(after).toBeGreaterThan(10);
      const expandedValuesFit = await rows.evaluateAll((nodes) => nodes.every((node) =>
        [...node.children].slice(2).filter((child) => getComputedStyle(child).display !== "none")
          .every((child) => child.scrollWidth <= child.clientWidth)));
      expect(expandedValuesFit, "expanded mover values are clipped").toBe(true);
      const plots = await rows.evaluateAll((nodes, selector) => nodes.map((node) => {
        const box = node.querySelector(selector)!.getBoundingClientRect();
        return { x: box.x, width: box.width };
      }), plotSelector);
      for (const plot of plots) {
        expect(Math.abs(plot.x - plots[0].x), "expanded plot starts at a different x").toBeLessThan(0.5);
        expect(Math.abs(plot.width - plots[0].width), "expanded plot has a different width").toBeLessThan(0.5);
      }
      const last = (await rows.last().boundingBox())!;
      const box = (await card.boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }
  }
}
