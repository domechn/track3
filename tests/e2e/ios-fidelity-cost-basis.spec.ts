import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { executeSceneSql, installFidelityRecords } from "./fidelity-records-scenes";

const longPageCaptureStyle = `
  html, body, #root { height: auto !important; overflow: visible !important; }
  #root > .min-h-dvh, #root > .min-h-dvh > div:last-child, .t3-mobile-app,
  .app-layout, .app-layout .app-content, .app-layout #app-main-content {
    height: auto !important; min-height: 0 !important; overflow: visible !important;
  }
  .app-layout #app-main-content { flex: none !important; }
  .mobile-tab-bar { display: none !important; }
`;

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  reducedMotion: "reduce",
});

test("phone cost controls, KPIs and prices use source typography", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-kpis")).toBeVisible({ timeout: 15_000 });
  expect((await page.locator(".fidelity-year-select").boundingBox())!.y).toBe(247);
  expect((await page.locator(".fidelity-kpi-primary > :nth-child(3) small").boundingBox())!.height).toBe(36);
  await expect(page.locator(".mobile-route-heading h1")).toHaveCSS("letter-spacing", "-0.22px");
  await expect(page.locator(".fidelity-cost-head strong").first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".fidelity-cost-kpis .ios-money").first()).toHaveCSS("letter-spacing", "normal");
  await expect(page.locator(".fidelity-kpi-secondary strong").first()).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.locator(".fidelity-price-row strong").first()).toHaveCSS("font-weight", "700");
  await expect(page.locator(".fidelity-price-row span small").first()).toHaveCSS("font-size", "13px");
  await expect(page.locator(".fidelity-price-row > div > span").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-price-row > div > span").filter({ hasText: "– buy" }).first().locator(".fidelity-price-placeholder").first())
    .toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.locator(".fidelity-lot-group-head .cost-gain").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-lot-row > div .cost-gain").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-lot-group-head .cost-gain").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-lot-row > div .cost-gain").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-lot-total .cost-gain")).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-lot-total .cost-gain")).toHaveCSS("font-weight", "500");
  expect(Math.round((await page.locator(".fidelity-lot-total .cost-gain").boundingBox())!.x)).toBe(270);
  expect(Math.round((await page.locator(".fidelity-lot-total .cost-gain").boundingBox())!.width)).toBe(87);
  await expect(page.locator(".fidelity-price-row > small").first()).toHaveCSS("line-height", "16px");
  await expect(page.locator(".fidelity-lot-row .fidelity-term-pill").first()).toHaveCSS("line-height", "18px");
  expect((await page.locator(".fidelity-lot-row .fidelity-term-pill").first().boundingBox())!.height).toBe(20);
  await expect(page.locator(".fidelity-lot-group-head small").first()).toHaveCSS("color", "rgb(180, 182, 188)");
  await expect(page.locator(".fidelity-term-pill").first()).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fidelity-term-pill").first()).toHaveCSS("color", "rgb(189, 189, 192)");
  await expect(page.locator(".fidelity-cost-warning button")).toHaveCSS("color", "rgb(155, 157, 163)");
  expect(Math.round(await page.locator(".fidelity-cost-warning button").evaluate((button) => {
    const text = document.createRange();
    text.selectNodeContents(button);
    return text.getBoundingClientRect().y;
  }))).toBe(464);
  await expect(page.locator(".fidelity-asset-bar > span:last-child").first()).toHaveCSS("font-size", "13px");
  await expect(page.locator(".fidelity-asset-bar > span:last-child").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-segments button").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-cost-stable-note svg")).toBeVisible();
  const zeroMarkerX = await page.locator(".fidelity-asset-bar").filter({ hasText: "SOL" })
    .locator(".fidelity-bar-track").evaluate((track) => track.getBoundingClientRect().x +
      Number.parseFloat(getComputedStyle(track, "::before").left));
  expect(Math.round(zeroMarkerX)).toBe(89);
});

test("average prices and quantities use transactions in the selected range", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  const prices = page.locator(".fidelity-cost-prices");
  await expect(prices).toBeVisible();
  await expect(prices.locator(".fidelity-price-row").filter({ hasText: "BTC" }))
    .toContainText("$58,311.50 buy");
  await expect(prices.locator(".fidelity-price-row").filter({ hasText: "BTC" }))
    .toContainText("Bought 0.6726 · sold 0.35");
  await expect(prices.locator(".fidelity-price-row").filter({ hasText: "AAPL" }))
    .toContainText("– buy");
  await expect(prices.locator(".fidelity-price-row").filter({ hasText: "AAPL" }))
    .toContainText("Bought – · sold 30");
});

test("selected-range averages keep stock and crypto with the same symbol separate", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await executeSceneSql(page, `INSERT INTO transactions
    (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
    VALUES ('crypto-aapl-buy', 1, 'crypto', 'wallet', 'AAPL', 1, 100, 'buy', '2026-06-01T12:00:00.000Z'),
    ('crypto-aapl-sell', 1, 'crypto', 'wallet', 'AAPL', 0.5, 200, 'sell', '2026-07-01T12:00:00.000Z')`);
  await page.goto("/#/cost-basis");
  const aapl = page.locator(".fidelity-cost-prices .fidelity-price-row").filter({ hasText: "AAPL" });
  await expect(aapl).toHaveCount(2);
  await expect(aapl.filter({ hasText: "$100.00 buy" })).toContainText("Bought 1.0000 · sold 0.5000");
  await expect(aapl.filter({ hasText: "Bought –" })).toContainText("– buy");
});

test("data gap amounts fit on one line within their cells", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-gaps tbody tr").first()).toBeVisible({ timeout: 20_000 });
  const amounts = await page.locator(".fidelity-cost-gaps tbody td:nth-child(3)").evaluateAll((cells) =>
    cells.map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const text = range.getBoundingClientRect();
      return { lines: range.getClientRects().length, fits: text.right <= cell.getBoundingClientRect().right };
    }));
  expect(amounts.every(({ lines, fits }) => lines === 1 && fits), JSON.stringify(amounts)).toBe(true);
  const nova = page.locator(".fidelity-cost-gaps tbody tr").filter({ hasText: "NOVA" });
  const spacing = await nova.evaluate((row) => {
    const bounds = [...row.querySelectorAll("td")].map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      return range.getBoundingClientRect();
    });
    return [bounds[2].left - bounds[1].right, bounds[3].left - bounds[2].right];
  });
  expect(Math.min(...spacing)).toBeGreaterThanOrEqual(8);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".fidelity-cost-gaps tbody td:nth-child(3)").first()).toHaveCSS("white-space", "nowrap");
});

for (const locale of ["en", "zh"] as const) {
  test(`data gap dates leave readable space before coins in ${locale}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    if (locale === "zh") await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
    await installFidelityRecords(page);
    await page.goto("/#/cost-basis");
    await expect(page.locator(".fidelity-cost-gaps tbody tr").first()).toBeVisible({ timeout: 20_000 });
    const gaps = await page.locator(".fidelity-cost-gaps tbody tr").evaluateAll((rows) => rows.map((row) => {
      const [date, coin] = [...row.querySelectorAll("td")];
      const textBounds = (cell: Element) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return [...range.getClientRects()].map(({ right, left }) => ({ right, left }));
      };
      return Math.min(...textBounds(coin).map(({ left }) => left)) -
        Math.max(...textBounds(date).map(({ right }) => right));
    }));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
  });
}

test("the empty year actions match the source's text hierarchy and position", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByLabel("Tax year").selectOption("2025");
  const empty = page.locator(".fidelity-no-lots");
  await expect(empty.getByRole("heading", { name: "No sales in 2025" })).toHaveCSS("font-size", "15px");
  await expect(empty.getByRole("button", { name: "Choose another year" })).toHaveCSS("color", "rgb(155, 157, 163)");
  const emptyBox = (await empty.boundingBox())!;
  expect([Math.round(emptyBox.y), Math.round(emptyBox.height)]).toEqual([1846, 230]);
  const y = (await empty.getByRole("heading", { name: "No sales in 2025" }).boundingBox())!.y;
  expect(Math.round(y)).toBe(1907);
  const actionY = (await empty.getByRole("button", { name: "Show open lots" }).boundingBox())!.y;
  expect(Math.round(actionY + 4)).toBe(2016);
});

test("data gaps pager captures a second page of stored warning events", async ({ page }) => {
  const dir = "/tmp/fidelity/cost-basis";
  mkdirSync(dir, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  const warnings = Array.from({ length: 51 }, (_, index) =>
    `('gap-withdraw-${index}', 1, 'crypto', 'fidelity-wallet', 'GAP', 1, 0, 'withdraw',
      '2026-10-18T12:${String(index).padStart(2, "0")}:00.000Z')`);
  await executeSceneSql(page, `INSERT INTO transactions
    (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
    VALUES ${warnings.join(",")}`);
  await page.goto("/#/cost-basis");
  const gaps = page.locator(".fidelity-cost-gaps");
  await expect(gaps.locator("tbody tr")).toHaveCount(50, { timeout: 20_000 });
  await gaps.getByRole("button", { name: "Next page of Data gaps to review" }).click();
  await expect(gaps.locator(".fidelity-pager")).toContainText("51–");
  await gaps.screenshot({ path: `${dir}/cost-basis-gaps-page2-phone.png` });
});

test("unknown SOL marker stays at the source track edge in a custom range", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From").fill("2026-07-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  const markerX = await page.locator(".fidelity-asset-bar").filter({ hasText: "SOL" })
    .locator(".fidelity-bar-track").evaluate((track) => track.getBoundingClientRect().x +
      Number.parseFloat(getComputedStyle(track, "::before").left));
  expect(Math.round(markerX)).toBe(89);
});

test("default, export, methods, range, lots and gaps", async ({ page }) => {
  const dir = "/tmp/fidelity/cost-basis";
  mkdirSync(dir, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.getByRole("button", { name: "FIFO", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Data gaps to review")).toBeVisible({ timeout: 15_000 });
  const gapLayout = await page.locator(".fidelity-cost-gaps tbody tr").first().evaluate((row) => {
    const [date, coin, amount, reason] = [...row.querySelectorAll("td")];
    const text = (cell: Element) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      return range.getClientRects();
    };
    return { coinGap: text(amount)[0].left - text(coin)[0].right, reasonLines: text(reason).length,
      dateLines: text(date).length, coinLines: text(coin).length };
  });
  expect(gapLayout.coinGap).toBeGreaterThanOrEqual(8);
  expect(gapLayout.reasonLines).toBe(1);
  expect(gapLayout.dateLines).toBe(2);
  expect(gapLayout.coinLines).toBe(1);
  await expect(page.locator(".fidelity-cost")).toHaveCSS("opacity", "1");
  await expect(page.locator(".fidelity-year-select svg")).toBeVisible();
  expect((await page.locator(".fidelity-year-select").boundingBox())!.width).toBe(324);
  await expect(page.locator(".fidelity-cost-warning")).toContainText("It shows – and");
  await expect(page.locator(".fidelity-lot-row").filter({ hasText: "35.0000" }).locator(".fidelity-unknown-term")).toHaveText("–");
  const valueGaps = await page.locator(".fidelity-cost-kpis").evaluate((root) => {
    const gap = (selector: string) => {
      const [left, right] = [...root.querySelectorAll<HTMLElement>(selector)].map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect();
      });
      return right.left - left.right;
    };
    return [gap(".fidelity-kpi-primary > :nth-child(n+2) strong"),
      gap(".fidelity-kpi-secondary > :nth-child(n+2) strong")];
  });
  expect(valueGaps[0]).toBeGreaterThanOrEqual(8);
  expect(valueGaps[1]).toBeGreaterThanOrEqual(8);
  expect((await page.locator(".fidelity-cost-controls").boundingBox())?.height).toBe(180);
  expect(Math.round((await page.locator(".fidelity-cost-controls").boundingBox())!.y)).toBe(146);
  expect((await page.locator(".fidelity-cost-warning").boundingBox())!.y).toBe(338);
  expect((await page.locator(".fidelity-cost-warning").boundingBox())!.height).toBe(164);
  expect((await page.locator(".fidelity-cost-kpis").boundingBox())!.y).toBe(514);
  expect((await page.locator(".fidelity-export-button").boundingBox())!.width).toBe(116);
  expect(Math.round((await page.locator(".fidelity-export-button").boundingBox())!.y)).toBe(90);
  expect(await page.locator(".fidelity-export-button").evaluate((button) =>
    getComputedStyle(button, "::before").height)).toBe("40px");
  expect(await page.locator(".fidelity-export-button").evaluate((button) =>
    getComputedStyle(button, "::before").top)).toBe("0px");
  expect(await page.locator(".fidelity-cost-warning button").evaluate((button) =>
    getComputedStyle(button, "::before").height)).toBe("36px");
  expect((await page.locator(".fidelity-cost-kpis").boundingBox())?.height).toBeLessThanOrEqual(409);
  expect(Math.round((await page.locator(".fidelity-kpi-primary > :nth-child(3)").boundingBox())!.x)).toBeLessThanOrEqual(160);
  expect((await page.locator(".fidelity-kpi-secondary > div:nth-child(3) small").boundingBox())?.height).toBeGreaterThanOrEqual(36);
  const lotLayout = await page.locator(".fidelity-cost-lots").evaluate((root) =>
    [...root.querySelectorAll(".fidelity-lot-group-head,.fidelity-lot-row,.fidelity-lot-total")].map((node) => ({
      cls: node.className, text: node.textContent?.trim().slice(0, 22),
      y: Math.round(node.getBoundingClientRect().y), h: Math.round(node.getBoundingClientRect().height),
    })));
  expect(lotLayout.map(({ y, h }) => [y, h])).toEqual([
    [2080, 25], [2105, 83], [2192, 40], [2232, 83], [2315, 83],
    [2402, 40], [2442, 81], [2527, 40], [2567, 83], [2650, 83],
    [2737, 40], [2777, 83], [2860, 83], [2947, 40], [2987, 83], [3070, 64],
  ]);
  await page.screenshot({ path: `${dir}/cost-basis-phone-long.png`, fullPage: true,
    style: longPageCaptureStyle });
  await page.screenshot({ path: `${dir}/cost-basis-phone.png` });
  await page.getByRole("button", { name: /^Export$/ }).click();
  expect((await page.locator(".fidelity-cost-export").boundingBox())!.y).toBe(601);
  expect((await page.locator(".fidelity-cost-export").boundingBox())!.height).toBe(243);
  const exportY = await page.locator(".fidelity-cost-export").evaluate((sheet) =>
    [sheet.querySelector(".mobile-sheet-handle"), ...sheet.querySelectorAll(".fidelity-export-row"),
      sheet.querySelector(".mobile-sheet-body > p")].map((node) => Math.round(node!.getBoundingClientRect().y)));
  expect(exportY).toEqual([610, 628, 684, 764]);
  expect(await page.locator(".fidelity-export-button").evaluate((button) =>
    getComputedStyle(button, "::before").backgroundColor)).toBe("rgb(24, 24, 28)");
  expect((await page.locator(".fidelity-export-row").first().locator("svg").boundingBox())?.x).toBe(27);
  expect((await page.locator(".fidelity-export-row").first().locator("span").boundingBox())?.x).toBe(57);
  await page.screenshot({ path: `${dir}/cost-basis-export-phone.png` });
  await page.mouse.click(5, 100);
  await page.getByRole("button", { name: "Average cost" }).click();
  await expect(page.getByRole("button", { name: /^Export$/ })).toBeEnabled();
  await expect(page.locator(".fidelity-cost-rule")).toContainText("Average cost pools");
  expect((await page.locator(".fidelity-cost-controls").boundingBox())!.height).toBe(198);
  expect((await page.locator(".fidelity-cost-warning").boundingBox())!.y).toBe(356);
  await expect(page.locator(".fidelity-cost-kpis")).toContainText("6 open lots");
  await expect(page.getByRole("button", { name: "Open lots 6" })).toBeVisible();
  await expect(page.locator(".fidelity-price-row").filter({ hasText: "AAPL" })).toContainText("Bought – · sold 30");
  await page.screenshot({ path: `${dir}/cost-basis-avg-phone.png` });
  await page.screenshot({ path: `${dir}/cost-basis-avg-phone-long.png`, fullPage: true,
    style: longPageCaptureStyle });
  await page.getByRole("button", { name: "Open lots 6" }).click();
  await expect(page.locator(".fidelity-lot-row")).toHaveCount(6);
  await expect(page.locator(".fidelity-lot-row").first()).toContainText("Pooled");
  await page.getByRole("button", { name: /Dispositions/ }).click();
  await page.getByRole("button", { name: "HIFO" }).click();
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From").fill("2026-07-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await expect(page.getByRole("button", { name: /^Export$/ })).toBeEnabled();
  await page.getByLabel("To", { exact: true }).blur();
  await page.mouse.click(20, 20);
  expect((await page.locator(".fidelity-cost-controls").boundingBox())!.height).toBe(182);
  await expect(page.locator(".fidelity-date-to-label")).toHaveText("to");
  expect(await page.locator(".fidelity-date-to-label").evaluate((label) => {
    const rect = label.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === label;
  })).toBe(true);
  expect(Math.round((await page.locator(".fidelity-date-to-label").boundingBox())!.x)).toBe(345);
  expect(Math.round((await page.locator(".fidelity-date-to-label").boundingBox())!.y)).toBe(214);
  expect(Math.round((await page.locator(".fidelity-date-fields label:first-child span").boundingBox())!.x)).toBe(324);
  expect(Math.round((await page.locator(".fidelity-date-fields label:first-child span").boundingBox())!.y)).toBe(205);
  await expect(page.locator(".fidelity-date-fields label:first-child span")).toHaveCSS("line-height", "18px");
  expect(Math.round((await page.locator(".fidelity-kpi-primary > :nth-child(3) span").first().boundingBox())!.x)).toBe(165);
  const customValueGap = await page.locator(".fidelity-kpi-primary").evaluate((root) => {
    const [left, right] = [...root.querySelectorAll<HTMLElement>(":scope > :nth-child(n+2) strong")].map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    });
    return right.left - left.right;
  });
  expect(customValueGap).toBeGreaterThanOrEqual(8);
  const subtitleLayout = await page.locator(".fidelity-cost-head p").evaluate((subtitle) => {
    const textNodes = [...subtitle.childNodes].filter((node): node is Text => node.nodeType === Node.TEXT_NODE);
    const top = (node: Text, text: string) => {
      const range = document.createRange();
      const start = node.textContent!.indexOf(text);
      range.setStart(node, start);
      range.setEnd(node, start + text.length);
      return range.getBoundingClientRect().top;
    };
    return {
      emphasisWeight: getComputedStyle(subtitle.querySelector("strong")!).fontWeight,
      firstLineTop: top(textNodes[0], "Gains"),
      usingTop: top(textNodes.find((node) => node.textContent!.includes("using"))!, "using"),
    };
  });
  expect(subtitleLayout.emphasisWeight).toBe("500");
  expect(subtitleLayout.usingTop).toBe(subtitleLayout.firstLineTop);
  await page.screenshot({ path: `${dir}/cost-basis-custom-phone.png` });
  await page.screenshot({ path: `${dir}/cost-basis-custom-phone-long.png`, fullPage: true,
    style: longPageCaptureStyle });
  await page.getByRole("button", { name: "Tax year" }).click();
  await page.getByRole("button", { name: "FIFO", exact: true }).click();
  await page.getByRole("button", { name: /Open lots/ }).click();
  await expect(page.locator(".fidelity-cost-kpis")).toContainText("6 sales");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".fidelity-cost-kpis")).toContainText("+$44,752.75");
  await expect(page.locator(".fidelity-cost-kpis")).toContainText("$85,603.18");
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 200));
  await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThan(64);
  await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeHidden();
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/cost-basis-open-phone.png` });
  await page.screenshot({ path: `${dir}/cost-basis-open-phone-long.png`, fullPage: true,
    style: longPageCaptureStyle });
  await page.getByRole("button", { name: /Dispositions/ }).click();
  await page.getByLabel("Tax year").selectOption("2025");
  await expect(page.getByRole("button", { name: /^Export$/ })).toBeEnabled();
  await page.getByLabel("Tax year").blur();
  await page.mouse.click(20, 20);
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  expect((await page.locator(".fidelity-cost-kpis").boundingBox())?.y).toBe(338);
  expect((await page.locator(".fidelity-cost-kpis").boundingBox())?.height).toBe(425);
  const emptyValueGap = await page.locator(".fidelity-kpi-primary").evaluate((root) => {
    const [left, right] = [...root.querySelectorAll<HTMLElement>(":scope > :nth-child(n+2) strong")].map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    });
    return right.left - left.right;
  });
  expect(emptyValueGap).toBeGreaterThanOrEqual(8);
  expect(await page.locator(".fidelity-cost-prices .fidelity-price-row strong").allTextContents())
    .toEqual(["BTC", "ETH", "SOL", "BNB", "AAPL", "NVDA"]);
  await page.screenshot({ path: `${dir}/cost-basis-empty-phone.png` });
  await page.screenshot({ path: `${dir}/cost-basis-empty-phone-long.png`, fullPage: true,
    style: longPageCaptureStyle });
});

test("phone keeps the holding days control and describes a custom threshold accurately", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: "Long-term after (days)" }).click();
  await expect(page.getByRole("spinbutton", { name: "Long-term after (days)" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Long-term after (days)" }).fill("730");
  await expect(page.locator(".fidelity-cost-rule")).toContainText("730 days");
  await expect(page.locator(".fidelity-cost-rule")).not.toContainText("1 year");
});

test("phone saves the selected tax year across a reload", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByLabel("Tax year").selectOption("2024");
  await page.getByLabel("Tax year").blur();
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(page.getByLabel("Tax year")).toHaveValue("2024");
});

test("Export traps focus, closes with Escape, restores focus, and closes on navigation", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  const trigger = page.locator(".fidelity-export-button");
  await expect(trigger).toBeEnabled({ timeout: 20_000 });
  await trigger.focus();
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Export" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet.getByRole("button", { name: /Export CSV/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sheet.getByRole("button", { name: /Export JSON/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.evaluate(() => { window.location.hash = "#/history"; });
  await expect(page).toHaveURL(/#\/history$/);
  await page.goto("/#/cost-basis");
  await expect(sheet).toBeHidden();
});

test("empty year action focuses a real year list and selecting a year persists", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
  const year = page.getByRole("combobox", { name: "Tax year" });
  await expect(year).toHaveValue("2026");
  await year.selectOption("2025");
  await expect(page.getByRole("button", { name: "Choose another year" })).toBeVisible();
  await page.getByRole("button", { name: "Choose another year" }).click();
  await expect(year).toBeFocused();
  await year.selectOption("2024");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Tax year" })).toHaveValue("2024");
});

test("cost basis reached from Analytics keeps Back visible", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/summary");
  await expect(page.getByRole("heading", { name: "Summary", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.locator('.mobile-tab-bar a[href="#/summary"]').click();
  await expect(page.locator(".analytics-tile-grid")).toBeVisible();
  await page.locator('.analytics-tile[href="#/cost-basis"]').click();
  await expect(page.locator("#app-top-bar .mobile-header-back")).toBeVisible();
  await page.locator("#app-top-bar .mobile-header-back").click();
  await expect(page).toHaveURL(/#\/summary$/);
});

test("cost basis shows configured sync status", async ({ page }) => {
  await installFidelityRecords(page, { lockedSync: true });
  await page.goto("/#/cost-basis");
  await expect(page.locator("#app-top-bar .t3-topbar-sync-button")).toBeVisible();
});

test("six figure KPI values stay separate on a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-kpis")).toBeVisible();
  const gaps = await page.locator(".fidelity-cost-kpis").evaluate((root) =>
    [".fidelity-kpi-primary", ".fidelity-kpi-secondary"].map((section) => {
      const [left, right] = [...root.querySelectorAll<HTMLElement>(`${section} > :nth-child(n+2) strong`)]
        .map((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect();
        });
      return right.left - left.right;
    }));
  expect(gaps[0]).toBeGreaterThanOrEqual(8);
  expect(gaps[1]).toBeGreaterThanOrEqual(8);
});

test("light cost basis keeps the page, selected segments and tab bar legible", async ({ page }) => {
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-kpis")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    localStorage.setItem("track3-ui-theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  });
  const colors = await page.evaluate(() => {
    const color = (selector: string, property: "color" | "backgroundColor" = "color") =>
      getComputedStyle(document.querySelector(selector)!)[property];
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
    const ground = color("#app-main-content", "backgroundColor");
    const tab = color(".mobile-tab-bar", "backgroundColor");
    const segment = color(".fidelity-segments button.selected");
    const segmentGround = getComputedStyle(document.querySelector(".fidelity-segments button.selected")!, "::before").backgroundColor;
    return {
      ground, tab, segment, segmentGround,
      titleContrast: contrast(color(".mobile-route-heading h1"), ground),
      tabContrast: contrast(color(".mobile-tab[aria-current='page']"), tab),
      segmentContrast: contrast(segment, segmentGround),
      warningContrast: contrast(color(".fidelity-cost-warning"), color(".fidelity-cost-warning", "backgroundColor")),
    };
  });
  expect(colors.ground).not.toBe("rgb(13, 13, 14)");
  expect(colors.ground).not.toBe("rgba(0, 0, 0, 0)");
  expect(colors.tab).toBe("rgb(255, 255, 255)");
  expect(colors.segment).not.toBe(colors.segmentGround);
  expect(Math.min(colors.titleContrast, colors.tabContrast, colors.segmentContrast, colors.warningContrast))
    .toBeGreaterThanOrEqual(4.5);
  mkdirSync("/tmp/fidelity/cost-basis", { recursive: true });
  await page.screenshot({ path: "/tmp/fidelity/cost-basis/cost-basis-light-phone.png" });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exportColors = await page.locator(".fidelity-cost-export").evaluate((node) => ({
    sheet: getComputedStyle(node).backgroundColor,
    text: getComputedStyle(node.querySelector("strong")!).color,
  }));
  expect(exportColors.sheet).not.toBe("rgb(19, 18, 23)");
  expect(exportColors.text).not.toBe(exportColors.sheet);
});

test("custom chart diverges around zero, uses selected-range copy and colors negative holding gains", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: "HIFO" }).click();
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From").fill("2026-07-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".fidelity-cost-by-asset .fidelity-card-heading")).toContainText("USD, selected range");
  const eth = page.locator(".fidelity-asset-bar").filter({ hasText: "ETH" });
  const geometry = await eth.evaluate((row) => {
    const track = row.querySelector(".fidelity-bar-track")!.getBoundingClientRect();
    const bar = row.querySelector("i")!.getBoundingClientRect();
    return { trackLeft: track.left, barLeft: bar.left, barRight: bar.right };
  });
  expect(geometry.barLeft).toBeGreaterThan(geometry.trackLeft);
  expect(geometry.barRight).toBeGreaterThan(geometry.barLeft);
  const negative = page.locator(".fidelity-holding-row").filter({ hasText: "−$" });
  await expect(negative.locator(".fidelity-holding-track span")).toHaveCSS("background-color", "rgb(238, 106, 130)");
});

test("reversed quote preference reverses the custom holding and asset bar colors", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/settings/appearance");
  await page.getByRole("button", { name: "Red Up / Green Down" }).click();
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: "HIFO" }).click();
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From").fill("2026-07-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".fidelity-holding-row").filter({ hasText: "−$" })
    .locator(".fidelity-holding-track span")).toHaveCSS("background-color", "rgb(95, 195, 156)");
  await expect(page.locator(".fidelity-asset-bar").filter({ hasText: "ETH" }).locator("i"))
    .toHaveCSS("background-color", "rgb(95, 195, 156)");
});

test("open lots show terms and compact holding duration", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: /Open lots/ }).click();
  expect(Math.round((await page.locator(".fidelity-lot-note").boundingBox())!.x)).toBe(74);
  expect(Math.round((await page.locator(".fidelity-lot-note").boundingBox())!.width)).toBe(283);
  await expect(page.locator(".fidelity-lot-group-head .cost-gain").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  await expect(page.locator(".fidelity-lot-row .cost-gain").first()).toHaveCSS("font-variant-numeric", "tabular-nums");
  const loss = page.locator(".fidelity-lot-row .cost-gain").filter({ hasText: "−$19,414.73" });
  expect(Math.round((await loss.boundingBox())!.x)).toBe(270);
  expect(Math.round((await loss.boundingBox())!.width)).toBe(87);
  await expect(page.locator(".fidelity-lot-row .fidelity-term-pill").first()).toBeVisible();
  await expect(page.locator(".fidelity-lot-row").first()).toContainText(/held \d+\.\d y/);
  await expect(page.locator(".fidelity-lot-row").first()).not.toContainText("y days");
  await expect(page.locator(".fidelity-lot-row").filter({ hasText: "264 d" }).first()).toBeVisible();
  await expect(page.locator(".fidelity-lot-row").filter({ hasText: "264 d" }).first()).not.toContainText("d days");
});

test("average dispositions pool each sale and do not claim holding terms", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByRole("button", { name: "Average cost" }).click();
  await expect(page.getByRole("button", { name: "Dispositions 7" })).toBeVisible();
  await expect(page.locator(".fidelity-cost-holding")).toContainText("Switch to FIFO, LIFO or HIFO");
  expect(Math.round((await page.locator(".fidelity-cost-holding").boundingBox())!.y)).toBe(969);
  await expect(page.locator(".fidelity-cost-lots .fidelity-term-pill")).toHaveCount(0);
  await expect(page.locator(".fidelity-lot-row").first()).toContainText(/Pooled · sold/);
});

test("empty tax year has both recovery actions and a centered by-asset empty box", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await page.getByLabel("Tax year").selectOption("2025");
  await expect(page.locator(".fidelity-cost")).toHaveAttribute("aria-busy", "false");
  expect(Math.round((await page.locator(".fidelity-kpi-primary > :nth-child(3) span").first().boundingBox())!.x)).toBe(157);
  await expect(page.locator(".fidelity-cost-by-asset .fidelity-chart-empty")).toBeVisible();
  expect(Math.round((await page.locator(".fidelity-chart-empty").boundingBox())!.y)).toBe(1064);
  await expect(page.getByRole("button", { name: "Show open lots" })).toBeVisible();
  const buttons = await page.locator(".fidelity-no-lots-actions button").evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().y));
  expect(buttons[0]).toBe(buttons[1]);
  expect(Math.round((await page.locator(".fidelity-no-lots").boundingBox())!.height)).toBe(230);
  expect((await page.getByRole("button", { name: "Show open lots" }).boundingBox())!.height).toBe(44);
  await expect(page.getByRole("button", { name: "Show open lots" })).toHaveCSS("font-size", "12px");
  await page.getByRole("button", { name: "Choose another year" }).click();
  await expect(page.getByLabel("Tax year")).toBeFocused();
  await expect(page.getByLabel("Tax year")).toHaveValue("2025");
});

test("SOL quantity uses the same four decimals in its warning and data gaps", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installFidelityRecords(page);
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-cost-warning")).toContainText("35.0000 SOL", { timeout: 20_000 });
  await expect(page.locator(".fidelity-cost-gaps tbody")).toContainText("35.0000");
});
