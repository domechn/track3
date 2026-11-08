import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });

test.describe("Summary touch controls", () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test("one-snapshot refresh and attribution choices have full touch targets", async ({ page }) => {
    await installTauriBridge(page, { fidelityDesktop: "empty" });
    await page.goto("/#/summary");
    await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    const options = page.locator(".fidelity-attribution-options");
    await expect(options.locator("div")).toBeHidden();
    expect((await options.locator("summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await page.getByRole("button", { name: "Refresh now" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await options.locator("summary").click();
    await expect(options.locator("div")).toBeVisible();
    for (const button of await options.locator("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

for (const state of ["full", "empty", "loading"] as const) {
  test(`summary ${state} matches the desktop section structure`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelityDesktop: state === "empty" ? "empty" : "summary", slowFidelity: state === "loading" });
    await page.goto("/#/summary");
    await expect(page.locator(".fidelity-summary")).toBeVisible();
    await expect(page.locator(".t3-fidelity-sidebar nav a[href='#/goals']")).toHaveAttribute("aria-label", /2 unread/);
    if (state !== "loading") await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    else await expect(page.locator(".fidelity-summary > [role=status]")).toBeVisible();
    if (state === "full") {
      await expect(page.locator(".t3-fidelity-topbar .t3-date-trigger")).toHaveAttribute("aria-description", /Jul 1.*Oct 31, 2026/);
      expect((await page.locator(".fidelity-summary-pnl").boundingBox())!.y).toBe(137);
      const sol = page.locator(".fidelity-attribution-row").filter({ has: page.locator(".t3-asset-label-name:text-is('SOL')") }).first();
      const solBars = sol.locator(".fidelity-attribution-track i");
      const zero = await sol.locator(".fidelity-attribution-track b").evaluate((node) => parseFloat((node as HTMLElement).style.left));
      const quantityLeft = await solBars.nth(1).evaluate((node) => parseFloat((node as HTMLElement).style.left));
      expect(quantityLeft).toBeCloseTo(zero, 5);
      await expect(page.locator(".fidelity-attribution-axis")).not.toContainText("−$50");
      await expect(page.locator(".fidelity-summary-pnl strong.big")).toHaveText("+$188,809.27");
      const pnlHint = page.locator(".fidelity-period-card").first()
        .getByRole("button", { name: "How P&L % is calculated" });
      await pnlHint.click();
      for (const ticker of ["BTC", "ETH", "SOL", "BNB", "NVDA", "AAPL"]) {
        await expect(page.getByRole("tooltip")).toContainText(ticker);
      }
      await expect(page.getByRole("tooltip")).toContainText("stablecoins are excluded.");
      await pnlHint.click();
      await expect(page.locator(".fidelity-month-card")).toHaveCount(10);
      await expect(page.locator(".fidelity-month-card").nth(1)).toContainText("0 up · 6 down");
      await expect(page.locator(".fidelity-year-card").nth(1)).toContainText("5 up · 1 down");
      await expect(page.locator(".fidelity-summary-chart [data-point]").first()).toHaveAttribute("aria-label", /Jul 2025.*\$0/);
      await expect(page.locator(".t3-fidelity-ranges button").last()).toHaveAttribute("aria-pressed", "true");
    }
    if (state === "empty") await expect(page.locator(".fidelity-summary-chart-empty")).toBeVisible();
    if (state === "empty") await expect(page.locator(".t3-fidelity-ranges button").first()).toBeDisabled();
    if (state === "loading") {
      await expect(page.locator(".fidelity-skeleton")).toHaveCount(6);
      await expect(page.locator(".t3-fidelity-stamp")).toContainText("Loading");
      await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled();
    }
    if (state !== "loading") {
      await page.waitForTimeout(1200);
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false");
      await expect(page.locator(".fidelity-skeleton")).toHaveCount(0);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    }
    await page.evaluate(() => document.fonts.ready);
    if (state === "loading") await page.waitForTimeout(1200);
    const dir = "/tmp/fidelity-desktop/summary";
    mkdirSync(dir, { recursive: true });
    await page.locator("body").screenshot({ path: `${dir}/summary-${state}-desktop.png`, animations: "disabled" });
    if (state === "loading") {
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "true");
      await expect(page.locator(".fidelity-skeleton")).toHaveCount(6);
    }
    if (state !== "loading") await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("heading", { name: "Profit and loss", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "All-time high" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "By year" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profit attribution" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top profit and loss coins" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1600);
    if (state === "full") {
      await page.locator(".t3-fidelity-ranges").getByRole("button", { name: "7D" }).click();
      await expect(page.locator(".t3-fidelity-ranges").getByRole("button", { name: "7D" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".t3-fidelity-ranges").getByRole("button", { name: "1D" })).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".fidelity-summary-pnl-kpis > div").first()).toContainText("Net P&L (7D)");
      await expect(page.locator(".fidelity-summary-chart line[data-direction]").first()).toBeVisible();
      await expect(page.locator(".fidelity-summary-chart-empty")).toHaveCount(0);
      await page.locator(".t3-fidelity-ranges").getByRole("button", { name: "All" }).click();
      await expect(page.locator(".fidelity-summary-pnl strong.big")).toHaveText("+$188,809.27");
    }
  });
}

test("zero up and down counts remain muted on Summary cards and Positions", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  for (const label of ["0 up", "0 down"]) {
    const count = page.locator(".fidelity-month-count span").filter({ hasText: label }).first();
    await expect(count).toHaveText(label);
    expect(await count.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(155, 157, 163)");
  }
});

test("choosing an earlier year shows its months and keeps the year cards", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await page.locator(".fidelity-year-card").filter({ hasText: "2025" }).click();
  await expect(page.locator(".fidelity-year-section .fidelity-year-card")).toHaveCount(2);
  await expect(page.locator(".fidelity-year-card.selected")).toContainText("2025");
  await expect(page.getByText("Months of 2025")).toBeVisible();
  await expect(page.locator(".fidelity-month-card")).toHaveCount(6);
});

test("Summary values and chart labels stay inside the card at the default width", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const card = page.locator(".fidelity-summary-pnl");
  const cardBox = (await card.boundingBox())!;
  const bigBox = await card.locator(".fidelity-kpis strong.big").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    return { x: box.x, width: box.width };
  });
  const secondCell = (await card.locator(".fidelity-kpis > div").nth(1).boundingBox())!;
  expect(bigBox.x + bigBox.width).toBeLessThanOrEqual(secondCell.x);
  for (const item of [card.locator(".fidelity-kpis strong.big"), card.locator(".fidelity-summary-chart text").first()]) {
    const box = (await item.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  }
  await page.screenshot({ path: "/tmp/fidelity-desktop/summary/summary-1400.png", fullPage: true });
});

test("one snapshot keeps every unknown KPI muted and uses the source refresh icon", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "empty" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const dashes = page.locator(".fidelity-summary-pnl-kpis strong").filter({ hasText: "–" });
  await expect(dashes).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    expect(await dashes.nth(index).evaluate((node) => getComputedStyle(node).color)).toBe("rgb(155, 157, 163)");
  }
  const icon = page.locator(".fidelity-summary-chart-empty button svg");
  expect((await icon.boundingBox())!.width).toBe(14);
  await expect(icon.locator("path")).toHaveAttribute("d", "M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3");
});

test("light theme keeps one-snapshot dashes at the light muted text color", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelityDesktop: "empty" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const color = await page.locator(".fidelity-summary-pnl-kpis").evaluate((node) => [
    getComputedStyle(node.querySelector("small")!).color,
    getComputedStyle(node.querySelector("strong")!).color,
  ]);
  expect(color[1]).toBe(color[0]);
});

test("light theme uses a light Summary card surface", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const background = await page.locator(".fidelity-card").first().evaluate((card) => getComputedStyle(card).backgroundColor);
  expect(background).toBe("rgb(255, 255, 255)");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.html}`).join(", ")}`)).toEqual([]);
});

test("the empty Summary refresh action works in Chinese", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  const bridge = await installTauriBridge(page, { fidelityDesktop: "empty" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await page.locator(".t3-fidelity-topbar .t3-refresh-button").evaluate((button) => button.classList.remove("t3-refresh-button"));
  await page.locator(".fidelity-summary-chart-empty button").click();
  await expect.poll(() => bridge.persistedRefreshes()).toBeGreaterThan(0);
});

test("Chinese Summary captions use Chinese dates", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await expect(page.locator(".fidelity-page-head p")).toContainText("2025年7月");
  await expect(page.locator(".fidelity-summary-pnl .fidelity-caption")).toContainText("2025年7月1日");
});

test("Summary subtitle stays clear of the visible controls", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const subtitle = await page.locator(".fidelity-page-head p").evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  const controls = (await page.locator(".t3-fidelity-ranges").boundingBox())!;
  expect(subtitle.y + subtitle.height <= controls.y || controls.y + controls.height <= subtitle.y ||
    subtitle.x + subtitle.width <= controls.x || controls.x + controls.width <= subtitle.x).toBe(true);
});

test("Summary KPI values align with the net value and selected rail has a visible rule", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const values = await page.locator(".fidelity-summary-pnl-kpis strong").evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().bottom)));
  expect(values.slice(1)).toEqual([values[0], values[0], values[0]]);
  const labels = await page.locator(".fidelity-summary-pnl-kpis > div > span").evaluateAll((nodes) =>
    nodes.slice(1).map((node) => node.getBoundingClientRect().x));
  expect(labels).toEqual([362.84375, 595.4375, 828.046875]);
  const active = page.locator(".t3-fidelity-sidebar nav a[aria-current='page']");
  expect(await active.evaluate((node) => {
    const rule = getComputedStyle(node, "::before");
    const box = node.getBoundingClientRect();
    return { left: Math.round(parseFloat(rule.left) + box.left), width: rule.width };
  })).toEqual({ left: 0, width: "3px" });
});

test("Summary leaders and attribution footer follow the source spacing", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  expect((await page.locator(".summary-top-heading").first().boundingBox())!.y).toBeCloseTo(1145, 0);
  expect((await page.locator(".fidelity-attribution-axis > span:nth-child(2) > span").last().boundingBox())!.y).toBeCloseTo(1609, 0);
  expect((await page.locator(".fidelity-attribution-row.total").boundingBox())!.y).toBeCloseTo(1627, 0);
  const totalRange = page.locator(".fidelity-attribution-row.total > span:nth-child(2)");
  await expect(totalRange).toHaveText("$310,000 → $763,809");
  const arrow = await totalRange.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      const index = text.textContent?.indexOf("→") ?? -1;
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      const box = range.getBoundingClientRect();
      return { x: box.x, width: box.width };
    }
    throw new Error("Missing attribution arrow");
  });
  expect(arrow.x).toBeCloseTo(321.5, 0);
  expect(arrow.width).toBeCloseTo(10.1, 0);
});

test("Summary loading leader bars have the source pitch and width", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary", slowFidelity: true });
  await page.goto("/#/summary");
  const rows = page.locator(".fidelity-skeleton.leaders .fidelity-skeleton-rows > div");
  await expect(rows).toHaveCount(6);
  const boxes = await page.evaluate(() => {
    const leaders = document.querySelectorAll(".fidelity-skeleton.leaders .fidelity-skeleton-rows > div");
    return {
      pitch: leaders[1].getBoundingClientRect().y - leaders[0].getBoundingClientRect().y,
      leaderWidth: leaders[0].querySelector("i:last-child")!.getBoundingClientRect().width,
      attributionWidth: document.querySelector(".fidelity-skeleton.attribution .fidelity-skeleton-rows > div i:last-child")!.getBoundingClientRect().width,
    };
  });
  expect(boxes.pitch).toBe(42);
  expect(boxes.leaderWidth).toBeCloseTo(219.2, 0);
  expect(boxes.attributionWidth).toBeCloseTo(514, 0);
});

test("one-snapshot Summary fills the lower empty panels", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "empty" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const panel = page.locator(".fidelity-summary-single .fidelity-attribution > .fidelity-empty");
  expect((await panel.boundingBox())!.height).toBe(260);
  expect((await page.locator(".fidelity-summary-chart-empty button").boundingBox())!.width).toBeCloseTo(109, 0);
});

test("Summary P&L grid reaches the card edge", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const edge = await page.locator(".fidelity-summary-chart line").first().evaluate((line) => {
    const svgLine = line as SVGLineElement;
    return svgLine.getScreenCTM()!.e + svgLine.x2.baseVal.value * svgLine.getScreenCTM()!.a;
  });
  expect(edge).toBeGreaterThan(1035);
});

test("Summary end label, rail separators and Refresh control match the source", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const label = page.locator(".fidelity-summary-chart > text:last-child");
  expect(await label.evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.fontWeight, style.fill];
  })).toEqual(["600", "rgb(95, 196, 155)"]);
  expect((await label.boundingBox())!.x).toBeCloseTo(976.4, 0);
  const separators = await page.locator(".t3-fidelity-nav-group").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return [box.x, box.width, style.borderTopWidth, style.borderTopColor];
    }));
  expect(separators).toEqual([[8, 40, "1px", "rgb(34, 34, 36)"], [8, 40, "1px", "rgb(34, 34, 36)"]]);
  const refresh = page.locator(".t3-fidelity-topbar .t3-refresh-button");
  expect(await refresh.evaluate((node) => {
    const button = getComputedStyle(node);
    const icon = getComputedStyle(node.querySelector("svg")!);
    return [button.paddingLeft, button.paddingRight, button.gap, icon.marginRight];
  })).toEqual(["14px", "14px", "8px", "0px"]);
});

test("Best month leader reaches the label above the chart", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const label = page.locator(".fidelity-summary-chart text").filter({ hasText: "Best month" });
  const leader = label.locator("xpath=..").locator("line");
  expect(Number(await leader.getAttribute("y1"))).toBeLessThan(Number(await label.getAttribute("y")));
});

test("two snapshots in one month draw a profit line", async ({ page }) => {
  const bridge = await installTauriBridge(page, { fidelityDesktop: "full" });
  await bridge.keepTwoOctoberSnapshots();
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const profitLine = page.locator(".fidelity-summary-chart line[data-direction]");
  expect(await profitLine.count()).toBeGreaterThan(0);
  await expect(profitLine.first()).toHaveAttribute("stroke", "hsl(var(--muted-foreground))");
  expect(await profitLine.evaluateAll((lines) => lines.every((line) =>
    Number(line.getAttribute("x2")) > Number(line.getAttribute("x1")) &&
    getComputedStyle(line).stroke !== "none"))).toBe(true);
  await expect(page.locator(".fidelity-summary-chart-empty")).toHaveCount(0);
});

test("Summary KPI, ATH rule and chart axes use the source page coordinates", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const metrics = await page.evaluate(() => {
    const y = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().y;
    const line = document.querySelector(".fidelity-summary-chart g:first-child line")!;
    return {
      big: y(".fidelity-summary-pnl-kpis strong.big"),
      percent: y(".fidelity-summary-pnl-kpis > div:nth-child(2) strong"),
      athRule: y(".fidelity-facts"),
      gridX: line.getBoundingClientRect().x,
      gridY: line.getBoundingClientRect().y,
      gridColor: getComputedStyle(line).stroke,
    };
  });
  expect(metrics).toMatchObject({
    big: 212, percent: 212, athRule: 336,
    gridColor: "rgb(38, 38, 41)",
  });
  expect(metrics.gridX).toBeCloseTo(149, 0);
  expect(metrics.gridY).toBeCloseTo(499, 0);
});

test("Summary range starts at the source heading position", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const box = (await page.locator(".t3-fidelity-ranges").boundingBox())!;
  expect(box.x).toBeCloseTo(1100, 0);
  expect(box.width).toBeCloseTo(260, 0);
});

test("Summary month cards and calculation hint follow the source row spacing", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const card = (await page.locator(".fidelity-period-card").first().boundingBox())!;
  const months = (await page.locator(".fidelity-month-grid").boundingBox())!;
  const hint = (await page.locator(".fidelity-period-card").first()
    .getByRole("button", { name: "How P&L % is calculated" }).boundingBox())!;
  expect(card.y).toBe(572);
  expect(months.y).toBe(663);
  expect(months.height).toBe(346);
  expect(hint.y).toBe(621);
});

test("Summary card labels and year amounts use tabular digits", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  expect(await page.locator(".fidelity-year-card").first().evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("tabular-nums");
  expect(await page.locator(".fidelity-month-main").first().evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("tabular-nums");
  expect(await page.locator(".fidelity-year-card strong").first().evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("tabular-nums");
  expect(await page.locator(".fidelity-month-value").first().evaluate((node) => getComputedStyle(node).fontVariantNumeric)).toBe("normal");
});

test("Goals unread dot follows the source rail geometry", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  const goals = page.locator(".t3-fidelity-sidebar nav a[href='#/goals']");
  await expect(goals).toHaveAttribute("aria-label", /2 unread/);
  expect(await goals.locator("span[aria-hidden=true]").evaluate((node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return { x: box.x, y: box.y, width: box.width, height: box.height, border: style.borderTopWidth, color: style.backgroundColor };
  })).toEqual({ x: 34, y: 409, width: 7, height: 7, border: "2px", color: "rgb(238, 106, 130)" });
});

test("Summary attribution header and leaders footnote match source vertical rhythm", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  expect((await page.locator(".fidelity-attribution-row.head").boundingBox())!.y).toBe(1159);
  expect(await page.locator(".fidelity-attribution-row.head > span").first().evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().y;
  })).toBe(1166);
  expect(await page.locator(".fidelity-leaders .fidelity-caption").evaluate((node) => getComputedStyle(node).lineHeight)).toBe("18px");
});
