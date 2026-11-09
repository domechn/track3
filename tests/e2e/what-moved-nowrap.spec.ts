import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/track3-what-moved-nowrap";
const phoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const movers = [
  { symbol: "BTC", type: "crypto", change: -600_061.17 },
  { symbol: "BNB", type: "crypto", change: -40_752.76 },
  { symbol: "USD", type: "crypto", change: -18_702.58 },
  { symbol: "USDT", type: "crypto", change: 93_837.08 },
  { symbol: "1211.HK", type: "stock", change: 20_496.36 },
  { symbol: "SCHD", type: "stock", change: 7_617.22 },
  { symbol: "VIG", type: "stock", change: 2_748.04 },
  { symbol: "QQQI", type: "stock", change: 1_310.83 },
] as const;

async function seedMovers(page: Page, phone: boolean) {
  await page.evaluate(async ({ fixture, phone }) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await run("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Yuan', '¥', 1, 1, '2099-01-01T00:00:00.000Z')");
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'CNY')");
    await run("DELETE FROM assets_v2 WHERE uuid IN ('fidelity-day-23', 'fidelity-day-24', 'fidelity-day-30')");
    for (const { symbol, type, change } of fixture) {
      for (const [uuid, date, value] of [
        phone
          ? ["fidelity-day-23", "2026-10-24T09:41:00.000Z", 700_000]
          : ["fidelity-day-24", "2026-10-25T09:41:00.000Z", 700_000],
        ["fidelity-day-30", "2026-10-31T09:41:00.000Z", 700_000 + change],
      ] as const) {
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, 'what-moved-fixture', ?, ?, 1, ?, ?)`,
        [uuid, date, type, symbol, value, value]);
      }
    }
  }, { fixture: movers, phone });
}

async function inspectCard(page: Page, phone: boolean) {
  const card = page.locator(phone ? ".fd-overview-moved" : ".t3-moved-panel");
  return card.evaluate((element, phone) => {
    const rows = [...element.querySelectorAll<HTMLElement>(phone ? ".fd-overview-mover" : ".t3-moved-list li")];
    return rows.map((row) => {
      const label = row.querySelector<HTMLElement>(phone ? "b" : ".t3-moved-symbol")!;
      const track = row.querySelector<HTMLElement>(phone ? ":scope > span" : ".t3-moved-track")!;
      const bar = track.querySelector<HTMLElement>("i, span")!;
      const amount = row.querySelector<HTMLElement>("strong")!;
      const style = getComputedStyle(amount);
      const text = amount.textContent ?? "";
      const node = amount.firstChild;
      const range = document.createRange();
      range.selectNodeContents(amount);
      const height = range.getBoundingClientRect().height;
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      const top = (index: number) => {
        if (!(node instanceof Text)) return null;
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        return range.getClientRects()[0]?.top ?? null;
      };
      const labelBox = label.getBoundingClientRect();
      const trackBox = track.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      const amountBox = amount.getBoundingClientRect();
      return {
        symbol: label.textContent ?? "", text, textNodes: amount.childNodes.length,
        isTextNode: node instanceof Text, height, lineHeight,
        signTop: top(0), currencyTop: top(1),
        whiteSpace: style.whiteSpace, figures: style.fontVariantNumeric,
        flexGrow: style.flexGrow, flexShrink: style.flexShrink,
        labelRight: labelBox.right, trackLeft: trackBox.left, trackRight: trackBox.right,
        trackWidth: trackBox.width, barLeft: barBox.left, barRight: barBox.right,
        amountLeft: amountBox.left, amountRight: amountBox.right,
        cardRight: element.getBoundingClientRect().right,
      };
    });
  }, phone);
}

async function expectCardFits(page: Page, phone: boolean) {
  const rows = await inspectCard(page, phone);
  expect(rows).toHaveLength(8);
  expect(rows.map((row) => row.symbol).sort()).toEqual(movers.map((row) => row.symbol).sort());
  for (const row of rows) {
    expect(row.text, row.symbol).toMatch(/^[+−][¥₩][\d,]+(?:\.\d{2})?$/);
    expect(row.textNodes, row.symbol).toBe(1);
    expect(row.isTextNode, row.symbol).toBe(true);
    expect(row.height, JSON.stringify(row)).toBeLessThanOrEqual(row.lineHeight * 1.3);
    expect(Math.abs((row.signTop ?? Infinity) - (row.currencyTop ?? -Infinity)), row.symbol).toBeLessThanOrEqual(1);
    expect(row.whiteSpace, row.symbol).toBe("nowrap");
    expect(row.figures, row.symbol).toContain("tabular-nums");
    expect(row.flexGrow, row.symbol).toBe("0");
    expect(row.flexShrink, row.symbol).toBe("0");
    expect(row.labelRight, row.symbol).toBeLessThanOrEqual(row.trackLeft + 1);
    expect(row.trackRight, row.symbol).toBeLessThanOrEqual(row.amountLeft + 1);
    expect(row.barLeft, row.symbol).toBeGreaterThanOrEqual(row.trackLeft - 1);
    expect(row.barRight, row.symbol).toBeLessThanOrEqual(row.trackRight + 1);
    expect(row.amountRight, row.symbol).toBeLessThanOrEqual(row.cardRight - 1);
    expect(row.trackWidth, row.symbol).toBeGreaterThanOrEqual(79);
    expect(Math.abs(row.trackLeft - rows[0].trackLeft), row.symbol).toBeLessThanOrEqual(1);
    expect(Math.abs(row.trackWidth - rows[0].trackWidth), row.symbol).toBeLessThanOrEqual(1);
  }
}

test("What moved keeps owner CNY amounts and nine-digit JPY/KRW on one line", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(550_000);
  mkdirSync(output, { recursive: true });
  for (const { width, height } of [
    { width: 1100, height: 700 }, { width: 1280, height: 720 },
    { width: 1440, height: 900 }, { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    const phone = width === 390;
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC",
        locale: phone ? "de-DE" : "en-US",
        ...(phone ? { userAgent: phoneAgent, isMobile: true, hasTouch: true } : width === 1100 ? { hasTouch: true } : {}),
      });
      try {
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
        await page.addInitScript((mode) => localStorage.setItem("track3-ui-theme", mode), theme);
        await installTauriBridge(page, { fidelitySample: "full" });
        await seedMovers(page, phone);
        await page.goto("/#/overview");
        const card = page.locator(phone ? ".fd-overview-moved" : ".t3-moved-panel");
        await expect(card.locator(phone ? ".fd-overview-mover" : ".t3-moved-list li")).toHaveCount(8, { timeout: 40_000 });
        const btc = card.locator(phone ? ".fd-overview-mover" : ".t3-moved-list li").filter({ hasText: "BTC" }).locator("strong");
        await expect(btc).toHaveText(phone ? "−¥600,061" : "−¥600,061.17");
        await card.screenshot({ path: `${output}/what-moved-${width}-${theme}.png`, animations: "disabled" });
        await expectCardFits(page, phone);
        for (const longAmount of ["−¥123,456,789", "−₩123,456,789"]) {
          await btc.evaluate((element, text) => { element.textContent = text; }, longAmount);
          await expectCardFits(page, phone);
        }
        const label = card.locator(phone ? ".fd-overview-mover" : ".t3-moved-list li")
          .filter({ hasText: "BTC" }).locator(phone ? "b" : ".t3-moved-symbol");
        await label.evaluate((element) => { element.textContent = "BTC-EXTRA-LONG-PORTFOLIO-SYMBOL"; });
        const labelLayout = await label.evaluate((element) => ({
          clipped: element.scrollWidth > element.clientWidth,
          right: element.getBoundingClientRect().right,
          trackLeft: element.nextElementSibling!.getBoundingClientRect().left,
        }));
        expect(labelLayout.clipped).toBe(true);
        expect(labelLayout.right).toBeLessThan(labelLayout.trackLeft);
      } finally {
        await context.close();
      }
    }
  }
});
