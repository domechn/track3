import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/track3-overview-change-no-wrap";
const fixtures = [
  { currency: "CNY", symbol: "¥", total: 10_835_872.39, changes: [-125_557.80, -494_661.66, -1_028_089.59],
    amounts: ["-¥125,557.80", "-¥494,661.66", "-¥1,028,089.59"] },
  { currency: "JPY", symbol: "¥", total: 10_835_872_390, changes: [125_557_800, -494_661_660, 1_028_089_590],
    amounts: ["+¥125,557,800.00", "-¥494,661,660.00", "+¥1,028,089,590.00"] },
  { currency: "KRW", symbol: "₩", total: 835_872_390, changes: [-125_557_800, 494_661_660, -128_089_590],
    amounts: ["-₩125,557,800.00", "+₩494,661,660.00", "-₩128,089,590.00"] },
] as const;

async function seed(page: Page, fixture: typeof fixtures[number]) {
  await page.evaluate(async ({ currency, symbol, total, changes }) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await run("DELETE FROM assets_v2");
    await run("DELETE FROM currency_rates");
    await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, 1, 1, '2099-01-01T00:00:00.000Z')",
      [currency, currency, symbol]);
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, ?)", [currency]);
    await run("DELETE FROM refresh_operations");
    await run("INSERT INTO refresh_operations (operation_uuid, created_at) VALUES ('layout-30', '2026-11-09T08:01:00.000Z')");
    for (let index = 0; index <= 30; index++) {
      const date = index === 23 ? "2026-10-27" : index >= 24
        ? `2026-11-${String(index - 21).padStart(2, "0")}`
        : new Date(Date.UTC(2026, 8, 21 + index)).toISOString().slice(0, 10);
      const value = index === 0 ? total - changes[2] : index === 23 ? total - changes[1]
        : index === 29 ? total - changes[0] : index === 30 ? total : total;
      await run("INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, 'layout-fixture', 'crypto', 'USDT', 1, ?, ?)",
        [`layout-${index}`, `${date}T08:01:00.000Z`, value, value]);
    }
  }, fixture);
}

async function assertLines(card: Locator, fixture: typeof fixtures[number], dates: boolean) {
  const columns = card.locator(".t3-pnl-compact-card > div > div > div");
  await expect(columns).toHaveCount(3);
  const result = await columns.evaluateAll((cells) => cells.map((cell) => {
    const lines = [...cell.children].map((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      const box = line.getBoundingClientRect();
      const style = getComputedStyle(line);
      return { text: line.textContent?.trim(), top: box.top, right: text.right, height: box.height,
        lineHeight: parseFloat(style.lineHeight), scrollWidth: line.scrollWidth, clientWidth: line.clientWidth,
        whiteSpace: style.whiteSpace, numeric: style.fontVariantNumeric, title: line.getAttribute("title"),
        suffixVisible: getComputedStyle(line.querySelector("span") ?? line).display !== "none" };
    });
    const box = cell.getBoundingClientRect();
    return { left: box.left, right: box.right, lines };
  }));
  for (const [index, column] of result.entries()) {
    expect(column.lines, `${fixture.currency} column ${index}`).toHaveLength(3);
    expect(column.lines[0].text).toBe(["Latest", "7 days", "30 days"][index]);
    expect(column.lines[2].text).toBe(`${fixture.amounts[index]} vs ${["8 Nov", "27 Oct", "21 Sept"][index]}`);
    expect(column.lines[2].title).toBe(column.lines[2].text);
    expect(column.lines[2].suffixVisible).toBe(dates);
    expect(column.lines[1].text).toMatch(/^[+-]?\d[\d,.]*%$/);
    for (const line of column.lines) {
      expect(line.height, JSON.stringify({ fixture: fixture.currency, index, line })).toBeLessThanOrEqual(line.lineHeight * 1.3);
      expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth);
      expect(line.whiteSpace).toBe("nowrap");
      expect(line.numeric).toContain("tabular-nums");
    }
    if (index < 2) {
      expect(column.right - column.lines[2].right).toBeGreaterThanOrEqual(12);
      expect(result[index + 1].left - column.lines[2].right).toBeGreaterThanOrEqual(12);
    }
  }
  for (let line = 0; line < 3; line++)
    expect(Math.max(...result.map((column) => column.lines[line].top)) -
      Math.min(...result.map((column) => column.lines[line].top))).toBeLessThanOrEqual(1);
  const total = await card.evaluate((node) => {
    const content = node.querySelector(".t3-hero-content")!;
    const value = node.querySelector(".t3-hero-value")!;
    const divider = node.querySelector(".t3-pnl-compact-card")!;
    const range = document.createRange();
    range.selectNodeContents(value);
    return { sideBySide: getComputedStyle(content).display === "grid", cardWidth: node.getBoundingClientRect().width,
      right: range.getBoundingClientRect().right, dividerLeft: divider.getBoundingClientRect().left,
      scrollWidth: value.scrollWidth, clientWidth: value.clientWidth };
  });
  expect(total.scrollWidth, `${fixture.currency} ${JSON.stringify(total)}`).toBeLessThanOrEqual(total.clientWidth);
  if (total.sideBySide) expect(total.dividerLeft - total.right, `${fixture.currency} ${JSON.stringify(total)}`).toBeGreaterThanOrEqual(12);
}

test("Overview change columns keep three aligned single lines across windows and card widths", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(output, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "en"));
  await page.goto("/#/settings");
  for (const fixture of fixtures) {
    await seed(page, fixture);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await page.reload();
      await page.goto("/#/overview");
      const card = page.locator(".t3-total-overview .t3-hero-card");
      await expect(card.locator(".t3-pnl-fidelity p").last()).toContainText(fixture.amounts[2], { timeout: 30_000 });
      for (const { width, height } of [
        { width: 1100, height: 700 }, { width: 1280, height: 720 },
        { width: 1440, height: 900 }, { width: 1920, height: 1080 },
      ]) {
        await page.setViewportSize({ width, height });
        for (const expanded of [false, true]) {
          if (expanded) await page.getByRole("button", { name: "Expand sidebar" }).click();
          const cardWidth = (await card.boundingBox())!.width;
          await assertLines(card, fixture, cardWidth > 900);
          if (fixture.currency === "CNY")
            await card.screenshot({ path: `${output}/${width}-${theme}-${expanded ? "expanded" : "collapsed"}.png` });
          if (expanded) await page.getByRole("button", { name: "Collapse sidebar" }).click();
        }
      }
      await page.setViewportSize({ width: 1920, height: 1080 });
      for (const width of [720, 900, 1100, 1500]) {
        await card.locator("..").evaluate((node, width) => {
          (node as HTMLElement).style.width = `${width}px`;
          (node as HTMLElement).style.gridColumn = "1 / -1";
        }, width);
        await assertLines(card, fixture, width > 900);
      }
      await card.locator("..").evaluate((node) => {
        (node as HTMLElement).style.removeProperty("width");
        (node as HTMLElement).style.removeProperty("grid-column");
      });
    }
  }
});
