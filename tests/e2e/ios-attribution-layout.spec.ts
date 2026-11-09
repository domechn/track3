import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { amountGeometry, seedAttributionLayout } from "./attribution-layout-scenes";
import { installTauriBridge } from "./fidelity-scenes";

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("390px phone shows the complete source-sample Total range", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const range = page.locator(".fd-attr-total > span").first();
    await expect(range).toHaveText("$310K → $764K");
    await expect(range).toHaveAttribute("title", "$310,000.00 → $763,809.27");
    expect(await range.locator("span").first().evaluate((element) =>
      element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator(".fd-attribution").screenshot({ path: "/tmp/ui13-app-phone-attribution.png" });
  } finally { await context.close(); }
});

for (const theme of ["dark", "light"] as const) {
  test(`phone Summary attribution keeps 12 large amounts on one line in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      userAgent: phone, isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await seedAttributionLayout(page);
      await page.goto("/#/summary");
      await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
      const rows = await amountGeometry(page, ".fd-attribution .fd-attr-row:not(.fd-attr-total)", "strong");
      expect(rows).toHaveLength(10);
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(55);
        expect(row.height).toBeLessThanOrEqual(57);
        for (const cell of row.cells) expect(cell.height).toBeLessThanOrEqual(cell.lineHeight * 1.2);
      }
      const chart = await page.locator(".fd-attribution").evaluate((card) => {
        const tracks = [...card.querySelectorAll<HTMLElement>(".fd-attr-row:not(.fd-attr-total) .fd-attr-track")];
        const zeroTick = [...card.querySelectorAll<HTMLElement>(".fd-axis span")].find((tick) => tick.textContent === "$0")!;
        const endTick = card.querySelector<HTMLElement>(".fd-axis span:last-child")!;
        const center = (element: HTMLElement) => {
          const box = element.getBoundingClientRect();
          return box.left + box.width / 2;
        };
        const first = tracks[0];
        const zero = first.getBoundingClientRect().left + first.clientWidth * parseFloat(first.style.getPropertyValue("--fd-zero")) / 100;
        const barEnd = first.querySelector<HTMLElement>(".fd-attr-market")!.getBoundingClientRect().right;
        return { widths: tracks.map((track) => track.getBoundingClientRect().width),
          zero, zeroTick: center(zeroTick), barEnd,
          twoMillionPosition: center(zeroTick) + (center(endTick) - center(zeroTick)) * 2_000_000 / Number(endTick.dataset.value) };
      });
      for (const width of chart.widths) expect(Math.abs(width - chart.widths[0])).toBeLessThanOrEqual(0.5);
      expect(Math.abs(chart.zeroTick - chart.zero)).toBeLessThanOrEqual(1);
      expect(Math.abs(chart.twoMillionPosition - chart.barEnd)).toBeLessThanOrEqual(1);
      expect((await page.locator(".fd-attribution .fd-attr-total").boundingBox())!.height).toBeCloseTo(rows[0].height, 0);
      expect(await page.locator(".fd-attribution .fd-attr-row:not(.fd-attr-total) > strong").first()
        .evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const range = page.locator(".fd-attribution .fd-attr-total > span").first();
      expect(await range.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await expect(range).toHaveText("$12M → $45M");
      await expect(range).toHaveAttribute("title", "$12,006,602.10 → $45,007,805.88");
      await expect(page.getByText("Showing 1-10 of 12")).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Showing 11-12 of 12")).toBeVisible();
      const secondPage = await amountGeometry(page, ".fd-attribution .fd-attr-row:not(.fd-attr-total)", "strong");
      expect(secondPage).toHaveLength(2);
      for (const row of secondPage) {
        expect(row.height).toBeCloseTo(rows[0].height, 0);
        for (const cell of row.cells) expect(cell.height).toBeLessThanOrEqual(cell.lineHeight * 1.2);
      }
      mkdirSync("/tmp/attribution-layout", { recursive: true });
      await page.getByRole("button", { name: "Previous" }).click();
      await page.locator(".fd-attribution").screenshot({ path: `/tmp/attribution-layout/phone-${theme}.png` });
    } finally { await context.close(); }
  });
}

test("320px phone keeps the full attribution range available without clipping", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const range = page.locator(".fd-attribution .fd-attr-total > span").first();
    expect(await range.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect(range).toHaveText("$12M → $45M");
    await expect(range).toHaveAttribute("title", "$12,006,602.10 → $45,007,805.88");
  } finally { await context.close(); }
});

test("320px CNY phone keeps asset names and month amounts readable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.evaluate(async () => {
      const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
      await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
      await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const names = page.locator(".fd-attribution .fd-attr-row:not(.fd-attr-total) > b");
    for (const clipped of await names.evaluateAll((elements) =>
      elements.map((element) => element.scrollWidth - element.clientWidth)))
      expect(clipped).toBeLessThanOrEqual(1);
    const month = page.locator(".fd-month strong").filter({ hasText: /¥/ }).first();
    expect(await month.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
    })).toBeLessThanOrEqual(1.2);
    expect(await month.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const total = page.locator(".fd-attribution .fd-attr-total > strong");
    await expect(total).toContainText(/[MBT]/);
    expect(await total.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    mkdirSync("/tmp/attribution-layout", { recursive: true });
    await page.locator(".fd-attribution").screenshot({ path: "/tmp/attribution-layout/phone-attribution-320-cny.png" });
    await page.locator(".fd-profit-summary").screenshot({ path: "/tmp/attribution-layout/phone-months-320-cny.png" });
  } finally { await context.close(); }
});

for (const [width, currency, symbol, rate, locale] of [
  [390, "CNY", "¥", 7.124, "en"],
  [390, "CNY", "¥", 7.124, "zh"],
  [390, "USD", "$", 1, "zh"],
  [320, "CNY", "¥", 7.124, "en"],
] as const) test(`${width}px phone ${currency} ${locale} axis labels keep an 8px gap`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.addInitScript((locale) => localStorage.setItem("track3-ui-locale", locale), locale);
    await seedAttributionLayout(page);
    if (currency !== "USD") await page.evaluate(async ({ currency, symbol, rate }) => {
      const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
      await run(`INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('${currency}', '${currency}', '${symbol}', ${rate}, 1, '2099-01-01T00:00:00.000Z')`);
      await run(`INSERT INTO configuration (id, data) VALUES (7, '${currency}')`);
    }, { currency, symbol, rate });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const boxes = await page.locator(".fd-attribution .fd-axis span:not(:first-child)").evaluateAll((elements) =>
      elements.filter((element) => getComputedStyle(element).visibility !== "hidden").map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }));
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < boxes.length; index++)
      expect(boxes[index].left - boxes[index - 1].right).toBeGreaterThanOrEqual(8);
    if (currency === "CNY" && locale === "zh")
      await expect(page.locator(".fd-attribution .fd-attr-total > span").first()).toContainText(/[万亿]/);
  } finally { await context.close(); }
});

test("390px CNY phone keeps top coin amounts on one line", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.evaluate(async () => {
      const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
      await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
      await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
      for (const [symbol, start, end] of [
        ["LOSS1", 3_000_000, 1_000_000], ["LOSS2", 3_100_000, 1_000_000],
        ["LOSS3", 3_200_000, 1_000_000], ["LOSS4", 3_300_000, 1_000_000],
        ["USDT", 1_000_000, 1_000_000], ["USDC", 1_100_000, 1_100_000],
        ["DAI", 1_200_000, 1_200_000], ["FDUSD", 1_300_000, 1_300_000],
      ] as const) {
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES ('layout-start', '2026-10-29T09:00:00.000Z', 'layout-wallet', 'crypto', '${symbol}', 1, ${start}, ${start})`);
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES ('layout-end', '2026-10-30T09:00:00.000Z', 'layout-wallet', 'crypto', '${symbol}', 1, ${end}, ${end})`);
      }
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const rows = await amountGeometry(page, ".fd-top-coins .summary-top-row", "strong");
    expect(rows).toHaveLength(12);
    const groups = await page.locator(".fd-top-coins .summary-top-list").evaluateAll((lists) =>
      lists.map((list) => list.querySelectorAll(".summary-top-row").length));
    expect(groups).toHaveLength(3);
    for (const group of groups)
      expect(group).toBe(4);
    for (const row of rows) {
      expect(row.cells[0].text).toContain("¥");
      expect(row.cells[0].height).toBeLessThanOrEqual(row.cells[0].lineHeight * 1.2);
    }
    const clipping = await page.locator(".fd-top-coins .summary-top-row > strong")
      .evaluateAll((elements) => elements.map((element) => element.scrollWidth - element.clientWidth));
    for (const clipped of clipping) expect(clipped).toBeLessThanOrEqual(1);
    const layout = await page.locator(".fd-top-coins .summary-top-row").evaluateAll((elements) =>
      elements.map((row) => {
        const track = row.querySelector(".summary-top-track")!.getBoundingClientRect();
        const percent = row.querySelector("small")!.getBoundingClientRect();
        return { track: track.width, percentRight: percent.right, rowRight: row.getBoundingClientRect().right };
      }));
    for (const row of layout) {
      expect(row.track).toBeGreaterThanOrEqual(80);
      expect(row.percentRight).toBeLessThanOrEqual(row.rowRight + 1);
    }
    mkdirSync("/tmp/attribution-layout", { recursive: true });
    await page.locator(".fd-top-coins").screenshot({ path: "/tmp/attribution-layout/phone-top-coins-390-cny.png" });
  } finally { await context.close(); }
});

test("600px phone shows every attribution tick when labels have room", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 600, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const ticks = page.locator(".fd-attribution .fd-axis span[data-value]");
    await expect(ticks).toHaveCount(4);
    const boxes = await ticks.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    for (let index = 1; index < boxes.length; index++)
      expect(boxes[index].left - boxes[index - 1].right).toBeGreaterThanOrEqual(8);
  } finally { await context.close(); }
});

test("390px phone compacts KRW attribution cells that exceed their column", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.evaluate(async () => {
      const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
      await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('KRW', 'Korean won', '₩', 1026, 1, '2099-01-01T00:00:00.000Z')");
      await run("INSERT INTO configuration (id, data) VALUES (7, 'KRW')");
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const card = page.locator(".fd-attribution");
    const values = await card.locator(".fd-attr-row > strong").evaluateAll((elements) => elements.map((element) => {
      const text = document.createRange();
      text.selectNodeContents(element);
      const box = text.getBoundingClientRect();
      const cell = element.getBoundingClientRect();
      return { text: element.textContent ?? "", title: element.getAttribute("title") ?? "", right: box.right, cellRight: cell.right };
    }));
    expect(values.some(({ title }) => title.includes(",000,"))).toBe(true);
    for (const value of values) {
      expect(value.right).toBeLessThanOrEqual(value.cellRight + 1);
    }
    expect(values.at(-1)?.text).toMatch(/[MBT]/);
  } finally { await context.close(); }
});

for (const width of [744, 1024]) test(`iPad Profit attribution ranks keep readable bars at ${width}px`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 1133 },
    userAgent: phone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await seedAttributionLayout(page);
    await page.goto("/#/summary");
    const card = page.locator(".d2-summary .analyze-profit-card");
    await card.getByRole("radio", { name: "Attribution" }).click();
    const ranks = card.locator(".attribution-rank-button");
    await expect(ranks.first()).toBeVisible();
    expect(await ranks.count()).toBeGreaterThan(1);
    await expect(ranks.first().locator(".tabular-nums")).toContainText(/,\d{3},\d{3}/);
    const longLabel = ranks.first().locator(".truncate");
    await longLabel.evaluate((element) => { element.textContent = "SupercalifragilisticexpialidociousLongAssetName"; });
    const labelLines = await longLabel.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
    });
    expect(labelLines).toBeLessThanOrEqual(1.2);
    await expect(longLabel).toHaveCSS("text-overflow", "ellipsis");
    await longLabel.evaluate((element) => { element.textContent = element.getAttribute("title"); });
    expect(await longLabel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    mkdirSync("/tmp/attribution-layout", { recursive: true });
    await card.locator(".attribution-rank").first().screenshot({ path: `/tmp/attribution-layout/ipad-${width}-rank.png` });
    for (const rank of await ranks.all()) {
      const boxes = await rank.evaluate((element) => {
        const label = element.querySelector<HTMLElement>(".truncate")!.getBoundingClientRect();
        const amount = element.querySelector<HTMLElement>(".tabular-nums")!.getBoundingClientRect();
        const bar = element.querySelector<HTMLElement>(".rounded-full")!.getBoundingClientRect();
        const row = element.getBoundingClientRect();
        return { height: row.height, labelRight: label.right, amountLeft: amount.left,
          amountRight: amount.right, rowRight: row.right, amountHeight: amount.height, barHeight: bar.height,
          barWidth: bar.width, labelScrollWidth: element.querySelector<HTMLElement>(".truncate")!.scrollWidth,
          labelClientWidth: element.querySelector<HTMLElement>(".truncate")!.clientWidth,
          lineHeight: parseFloat(getComputedStyle(element.querySelector<HTMLElement>(".tabular-nums")!).lineHeight) };
      });
      expect(boxes.height).toBeGreaterThanOrEqual(56);
      expect(boxes.height).toBeLessThanOrEqual(57);
      expect(boxes.labelRight).toBeLessThanOrEqual(boxes.amountLeft - 12);
      expect(boxes.amountRight).toBeLessThanOrEqual(boxes.rowRight);
      expect(boxes.amountHeight).toBeLessThanOrEqual(boxes.lineHeight * 1.2);
      expect(boxes.barHeight).toBe(16);
      expect(boxes.barWidth).toBeGreaterThanOrEqual(32);
      expect(boxes.labelScrollWidth - boxes.labelClientWidth).toBeLessThanOrEqual(1);
      await rank.click();
      const details = rank.locator("xpath=..").locator(".attribution-rank-details");
      for (const amount of await details.locator("dd").all()) {
        expect(await amount.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
        })).toBeLessThanOrEqual(1.2);
      }
    }
  } finally { await context.close(); }
});
