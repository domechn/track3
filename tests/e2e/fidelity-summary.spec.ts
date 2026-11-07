import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== "mobile"); });

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("summary keeps the approved layout when history has month gaps", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { sparseProfitHistory: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-summary > .fd-card")).toHaveCount(6);
  } finally { await context.close(); }
});

test("Summary uses the same profit for All and 1Y when both cover every snapshot", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    const main = page.locator(".fd-summary");
    await expect(main).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(main.locator(".fd-primary-stat strong")).toHaveText("+$4,368.50");
    await main.getByRole("radio", { name: "1Y" }).click();
    await expect(main.locator(".fd-primary-stat strong")).toHaveText("+$4,368.50");
    await expect(main.locator(".fd-month").filter({ hasText: "Aug" })).toContainText("−$9,598");
    await expect(main.locator(".fd-summary-chart")).toContainText("$4,369");
    const topTotal = (await main.locator(".summary-top-row strong").allTextContents())
      .reduce((sum, text) => sum + Number(text.replace("−", "-").replace(/[^0-9.-]/g, "")), 0);
    expect(Math.abs(topTotal - 4_368.50)).toBeLessThan(5);
  } finally { await context.close(); }
});

test("Chinese Summary keeps attribution dates in one translated phrase", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-attribution .fd-card-heading")).toContainText(/至.*，USD/);
    await expect(page.locator(".fd-ath > .fd-sub").first()).toContainText(/最高点记录于.*（.*天前）/);
  } finally { await context.close(); }
});

test("Summary shows a near-midnight snapshot on the viewer's local day", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "Asia/Shanghai" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-01T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "empty" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "UPDATE assets_v2 SET createdAt = '2026-10-31T23:30:00.000Z'", values: [] }));
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-ath")).toContainText("1 Nov 2026");
  } finally { await context.close(); }
});

test("Summary groups a near-midnight snapshot into the viewer's local month", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "Asia/Shanghai" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-01T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "UPDATE assets_v2 SET createdAt = '2026-10-31T23:30:00.000Z' WHERE uuid = 'fidelity-day-30'", values: [] }));
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-month").last()).toContainText("Nov");
    await expect(page.locator(".fd-month").last()).not.toContainText("No snapshot");
  } finally { await context.close(); }
});

test("a year with one observed month uses the singular month label", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { sparseProfitHistory: true });
    await page.goto("/#/summary");
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "DELETE FROM assets_v2 WHERE createdAt >= '2026-02-01'", values: [] }));
    await page.reload();
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-year")).toHaveCount(1);
    await expect(page.locator(".fd-year")).toContainText("1 month");
    await expect(page.locator(".fd-year")).not.toContainText("1 months");
  } finally { await context.close(); }
});

test("summary full state follows the approved card order and captures at 390px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/summary");
    await expect(page.getByText("Profit and loss", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("All-time high", { exact: true })).toBeVisible();
    await expect(page.getByText("By year", { exact: true })).toBeVisible();
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const refresh = await page.locator(".fd-refresh").boundingBox();
    expect(refresh?.width).toBe(44);
    expect(refresh?.height).toBe(44);
    expect(refresh?.x).toBe(330);
    expect((await page.locator(".fd-range").boundingBox())?.width).toBe(306);
    mkdirSync("/tmp/fidelity/summary", { recursive: true });
    await expect(page.locator(".fd-primary-stat")).toContainText("+$188,809.27");
    await expect(page.locator(".fd-page-head p strong")).toHaveText("+$188,809");
    await expect(page.locator(".fd-page-head p")).toContainText("$265,000");
    await expect(page.locator(".fd-kpis")).toContainText("+32.84%");
    await expect(page.locator(".fd-kpis")).toContainText("$575,000");
    expect((await page.locator(".fd-three>div:first-child small").boundingBox())!.y).toBe(382);
    expect((await page.locator(".fd-chart-caption").boundingBox())!.y).toBe(436);
    await expect(page.locator(".fd-year").first()).toContainText("+$60,109");
    await expect(page.locator(".fd-year").first()).toContainText("+$105,000");
    await expect(page.locator(".summary-top-row").filter({ hasText: "SOL" }).locator("strong")).toHaveText("−$9,300");
    await expect(page.locator(".fd-top-coins .summary-top-row").nth(6).locator("b")).toHaveText("USDT");
    await expect(page.locator(".fd-attribution .fd-attr-row").first()).toContainText("Quantity +$38,000");
    const totalRange = page.locator(".fd-attr-total > span").first();
    await expect(totalRange).toHaveText("$310K → $764K");
    await expect(totalRange).toHaveAttribute("title", "$310,000.00 → $763,809.27");
    await expect(page.locator(".fd-axis span[data-axis-tick]:visible")).toHaveText(["$0", "$50k", "$150k"]);
    const pnlHint = page.locator(".fd-profit-summary").getByRole("button", { name: "How P&L % is calculated" });
    await pnlHint.click();
    await expect(page.getByRole("tooltip")).toContainText("BTC");
    await expect(page.getByRole("tooltip")).not.toContainText(", and ");
    await expect(page.getByRole("tooltip")).toContainText("stablecoins are excluded.");
    await pnlHint.click();
    expect(await page.locator(".fd-year-deposit span").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(13);
    const solBars = await page.locator(".fd-attribution .fd-attr-row").filter({ has: page.locator("b", { hasText: "SOL" }) }).evaluate((row) => {
      const zero = row.querySelector<HTMLElement>(".fd-attr-track")!.getBoundingClientRect();
      const flow = row.querySelector<HTMLElement>(".fd-attr-flow")!.getBoundingClientRect();
      const zeroPercent = parseFloat(getComputedStyle(row.querySelector<HTMLElement>(".fd-attr-track")!).getPropertyValue("--fd-zero"));
      return { flowLeft: flow.left, zeroLeft: zero.left + zero.width * zeroPercent / 100 };
    });
    expect(Math.abs(solBars.flowLeft - solBars.zeroLeft)).toBeLessThanOrEqual(1);
    await expect(page.locator(".fd-month")).toHaveCount(10);
    expect(await page.locator(".fd-month").filter({ hasText: "Mar" }).locator(".fd-zero-bar i")
      .evaluate((node) => parseFloat((node as HTMLElement).style.width))).toBeCloseTo(50, 0);
    await expect(page.locator(".fd-month").filter({ hasText: "Feb" }).locator(".fd-month-foot span").first()).toHaveCSS("color", "rgb(155, 157, 163)");
    await page.locator("#app-main-content").evaluate((node) => { node.scrollTop = 0; });
    expect(Math.round((await page.locator(".fd-top-coins").boundingBox())!.y)).toBe(3147);
    await expect(page.locator(".fd-month").last()).toContainText("Oct");
    await expect(page.locator(".fd-month").last()).toContainText("up");
    await expect(page.locator(".fd-month").last()).toContainText("down");
    await expect(page.locator(".mobile-tab-badge")).toHaveText("2");
    mkdirSync("/tmp/fidelity/summary", { recursive: true });
    writeFileSync("/tmp/fidelity/summary/geometry.json", JSON.stringify(await page.evaluate(() => ({
      cards: [...document.querySelectorAll(".fd-summary>.fd-card")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { y: rect.y, height: rect.height };
      }),
      kpis: [...document.querySelectorAll(".fd-primary-stat,.fd-primary-stat>*,.fd-three,.fd-three>div,.fd-three>div>*,.fd-chart-caption,.fd-summary-chart")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { text: element.textContent?.slice(0, 32), className: element.className, x: rect.x, y: rect.y, height: rect.height };
      }),
      height: document.getElementById("app-main-content")!.scrollHeight,
    })), null, 2));
    await page.screenshot({ path: "/tmp/fidelity/summary/summary-phone-long.png", fullPage: true });
    await page.screenshot({ path: "/tmp/fidelity/summary/summary-phone.png" });
    await page.locator(".fd-month").last().click();
    await expect(page.locator(".fd-chart-chip")).toContainText("Oct 2026");
    await page.getByRole("radio", { name: "30D" }).click();
    await expect(page.locator(".fd-primary-stat")).not.toContainText("+$188,809.27");
  } finally { await context.close(); }
});

test("summary one-snapshot and loading states reserve all six sections", async ({ browser }) => {
  for (const state of ["empty", "loading"] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
      isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await installTauriBridge(page, { fidelitySample: state, fidelitySlowSummary: state === "loading" });
      await page.goto("/#/summary");
      await expect(page.getByText("Profit and loss", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", state === "empty" ? "ready" : "loading", { timeout: 30_000 });
      if (state === "empty") {
        await expect(page.locator(".fd-summary .fd-page-head p strong")).toHaveText("One snapshot so far");
        expect(Math.round((await page.locator(".fd-profit-summary").boundingBox())!.y)).toBe(1021);
        expect(Math.round((await page.locator(".fd-facts>div:first-child>span:first-child").boundingBox())!.y)).toBe(854);
      }
      if (state === "loading") {
        await expect(page.locator(".fd-month-grid .fd-block").first()).toHaveCSS("background-color", "rgb(22, 22, 26)");
        await expect(page.locator(".fd-year-list .fd-block").first()).toHaveCSS("background-color", "rgb(22, 22, 26)");
        expect(Math.round((await page.locator(".fd-top-coins").boundingBox())!.height)).toBe(320);
        const chartBox = await page.locator(".fd-profit-loss .fd-block").evaluate((element) => ({
          background: getComputedStyle(element).backgroundColor,
          border: getComputedStyle(element).borderTopColor,
        }));
        expect(chartBox).toEqual({ background: "rgb(22, 22, 26)", border: "rgb(27, 26, 31)" });
      }
      const controls = await page.locator(".fd-range button").evaluateAll((buttons) => buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, scrollWidth: button.scrollWidth, width: rect.width };
      }));
      for (const control of controls) expect(control.scrollWidth).toBeLessThanOrEqual(control.width + 1);
      await expect(page.locator(".mobile-tab-badge")).toHaveText("2");
      mkdirSync("/tmp/fidelity/summary", { recursive: true });
      writeFileSync(`/tmp/fidelity/summary/${state}-geometry.json`, JSON.stringify(await page.evaluate(() => ({
        cards: [...document.querySelectorAll(".fd-summary>.fd-card")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { y: rect.y, height: rect.height };
        }),
        facts: [...document.querySelectorAll(".fd-facts, .fd-facts>div, .fd-facts>div>span")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent, y: rect.y, height: rect.height };
        }),
        kpis: [...document.querySelectorAll(".fd-three,.fd-three>div:nth-child(2) strong,.fd-three>div:nth-child(2) small,.fd-three>div:nth-child(3) strong")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent, y: rect.y + document.getElementById("app-main-content")!.scrollTop, height: rect.height };
        }),
        bars: [...document.querySelectorAll(".fd-attribution .fd-row-skeleton .fd-skeleton,.fd-top-coins .fd-row-skeleton .fd-skeleton")].slice(0, 4).map((element) => {
          const rect = element.getBoundingClientRect();
          return { y: rect.y + document.getElementById("app-main-content")!.scrollTop, x: rect.x, width: rect.width };
        }),
        height: document.getElementById("app-main-content")!.scrollHeight,
      })), null, 2));
      await page.screenshot({ path: `/tmp/fidelity/summary/summary-${state}-phone-long.png`, fullPage: true });
      await page.screenshot({ path: `/tmp/fidelity/summary/summary-${state}-phone.png` });
    } finally { await context.close(); }
  }
});

test("summary converts stored USD values into the selected currency", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.evaluate(async () => {
      await (window as any).__e2eInvoke("plugin:sql|execute", { query: "INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('HKD', 'Hong Kong dollar', 'HK$', 7.8, 1, '2099-01-01T00:00:00.000Z')", values: [] });
      await (window as any).__e2eInvoke("plugin:sql|execute", { query: "INSERT INTO configuration (id, data) VALUES (7, 'HKD')", values: [] });
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-primary-stat")).toContainText("+HK$1,472,712.28");
    await expect(page.locator(".fd-attribution .fd-card-heading")).toContainText("HKD");
    await expect(page.locator(".fd-attribution .fd-axis")).toContainText("HK$");
    await expect(page.locator(".fd-profit-loss .fd-three")).toContainText("P&L is HK$0");
    await expect(page.locator(".fd-summary")).not.toContainText("P&L is $0");
    await expect(page.locator(".fd-top-coins .fd-footnote")).toContainText("Stablecoins are held at HK$8.");
  } finally { await context.close(); }
});

test("summary and coin detail use the light palette when Light is selected", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
    await installTauriBridge(page, { fidelitySample: "full" });
    for (const route of ["summary", "coins/BTC"]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator(route.startsWith("coins") ? ".fd-coin" : ".fd-summary"))
        .toHaveAttribute("data-state", "ready");
      expect(await page.locator(".fd-page").evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgb(13, 13, 14)");
      expect(await page.locator(".fd-card").first().evaluate((node) => getComputedStyle(node).color)).not.toBe("rgb(255, 255, 255)");
      expect(await page.locator(".mobile-tab-bar").evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgb(13, 13, 14)");
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-quote", "red-up"));
    const gainColors = await page.locator(".fd-coin").evaluate((node) => {
      const expected = document.createElement("span");
      expected.style.color = "hsl(var(--negative))";
      node.append(expected);
      const result = [getComputedStyle(node.querySelector("[data-tone='gain']")!).color, getComputedStyle(expected).color];
      expected.remove();
      return result;
    });
    expect(gainColors[0]).toBe(gainColors[1]);
  } finally { await context.close(); }
});

test("summary attribution bars fit a portfolio larger than the design sample", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.evaluate(async () => {
      await (window as any).__e2eInvoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET value = value * 100, price = price * 100", values: [] });
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const bars = await page.locator(".fd-attribution .fd-attr-row:not(.fd-attr-total)").evaluateAll((rows) => rows.flatMap((row) => {
      const track = row.querySelector(".fd-attr-track")!.getBoundingClientRect();
      return [...row.querySelectorAll<HTMLElement>(".fd-attr-track i")].filter((bar) => bar.getBoundingClientRect().width > 0).map((bar) => {
        const rect = bar.getBoundingClientRect();
        return { left: rect.left - track.left, right: rect.right - track.left, width: track.width };
      });
    }));
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.left).toBeGreaterThanOrEqual(-1);
      expect(bar.right).toBeLessThanOrEqual(bar.width + 1);
    }
  } finally { await context.close(); }
});

test("summary uses short English month labels and muted percentage captions", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-month .fd-month-top b").nth(8)).toHaveText("Sep");
    const amountColor = await page.locator(".fd-month strong").first().evaluate((node) => getComputedStyle(node).color);
    const percentColor = await page.locator(".fd-month small").first().evaluate((node) => getComputedStyle(node).color);
    expect(percentColor).not.toBe(amountColor);
    const yearAmountSize = await page.locator(".fd-year strong").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const depositSize = await page.locator(".fd-year-deposit span").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(depositSize).toBeGreaterThan(12);
    expect(depositSize).toBeLessThanOrEqual(yearAmountSize);
  } finally { await context.close(); }
});

test("summary P&L chart exposes the value and month while scrubbing", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/summary");
    const chart = page.locator(".fd-summary-chart");
    await expect(chart).toBeVisible();
    await chart.scrollIntoViewIfNeeded();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * .35, box.y + box.height * .5);
    const chip = page.locator(".fd-chart-chip");
    await expect(chip).toContainText("$");
    const first = await chip.textContent();
    await page.mouse.move(box.x + box.width * .75, box.y + box.height * .5);
    await expect.poll(() => chip.textContent()).not.toBe(first);
  } finally { await context.close(); }
});

test("summary bounds transaction reads across the design history", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.addInitScript(() => {
      const invoke = (window as any).__e2eInvoke;
      (window as any).__summaryReads = 0;
      (window as any).__e2eInvoke = (command: string, args: { query?: string }, ...rest: unknown[]) => {
        if (command === "plugin:sql|select" && /transactions/i.test(args.query ?? "")) (window as any).__summaryReads++;
        return invoke(command, args, ...rest);
      };
    });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const reads = await page.evaluate(() => (window as any).__summaryReads);
    expect(reads).toBeLessThan(30);
  } finally { await context.close(); }
});
