import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { installManySourceFixture } from "./ui-bugs-scenes";
import { seedSummaryYears } from "./summary-years-scenes";

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

for (const width of [1100, 1280, 1440, 1920]) {
  for (const theme of ["dark", "light"]) {
    test(`2026 month and year cards stay compact at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { fidelityDesktop: "summary" });
      await page.goto("/#/summary");
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      await expect(page.locator(".fidelity-month-card")).toHaveCount(10);
      await page.evaluate(() => document.fonts.ready);

      const layout = await page.evaluate(() => {
        const rect = (node: Element) => node.getBoundingClientRect();
        const months = [...document.querySelectorAll(".fidelity-month-card")];
        const grid = document.querySelector(".fidelity-month-grid")!;
        const panel = grid.closest(".fidelity-period-card")!;
        const years = [...document.querySelectorAll(".fidelity-year-card")];
        return {
          months: months.map((card) => ({
            x: rect(card).x,
            y: rect(card).y,
            height: rect(card).height,
            blank: rect(card).bottom - rect(card.querySelector(".fidelity-month-count")!).bottom,
          })),
          years: years.map((card) => ({
            height: rect(card).height,
            blank: rect(card).bottom - rect(card.querySelector(".fidelity-year-foot")!).bottom,
          })),
          gridBottom: rect(grid).bottom,
          panelBottom: rect(panel).bottom,
        };
      });
      expect(new Set(layout.months.slice(0, 5).map(({ y }) => y)).size).toBe(1);
      expect(new Set(layout.months.slice(0, 5).map(({ x }) => x)).size).toBe(5);
      expect(new Set(layout.months.slice(0, 5).map(({ height }) => height)).size).toBe(1);
      expect(new Set(layout.months.slice(5).map(({ y }) => y)).size).toBe(1);
      expect(new Set(layout.months.slice(5).map(({ height }) => height)).size).toBe(1);
      for (const month of layout.months) {
        expect(month.height).toBeGreaterThanOrEqual(140);
        expect(month.height).toBeLessThanOrEqual(200);
        expect(month.blank).toBeLessThan(40);
      }
      if (width === 1280) expect(layout.months[0].height).toBe(167);
      for (const year of layout.years) {
        expect(year.height).toBeLessThanOrEqual(200);
        expect(year.blank).toBeLessThan(40);
      }
      expect(layout.panelBottom - layout.gridBottom).toBeLessThanOrEqual(24);

      if ([1280, 1920].includes(width)) {
        mkdirSync("/tmp/summary-card-height", { recursive: true });
        await page.screenshot({ path: `/tmp/summary-card-height/summary-${width}-${theme}.png`, fullPage: true });
        await page.locator(".fidelity-period-card").first().screenshot({
          path: `/tmp/summary-card-height/months-${width}-${theme}.png`,
        });
        if (theme === "dark") await page.locator(".fidelity-month-grid").screenshot({
          path: `/tmp/summary-card-height/month-grid-${width}-${theme}.png`,
        });
        await page.locator(".fidelity-year-section").screenshot({
          path: `/tmp/summary-card-height/years-${width}-${theme}.png`,
        });
      }
    });
  }
}

test("a sparse month grid does not leave a tall empty panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const blank = await page.locator(".fidelity-month-grid").evaluate((grid) => {
    [...grid.children].slice(1).forEach((card) => card.remove());
    return grid.closest(".fidelity-period-card")!.getBoundingClientRect().bottom - grid.getBoundingClientRect().bottom;
  });
  expect(blank).toBeLessThanOrEqual(24);
});

test("a full twelve months wrap without stretching their rows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const rows = await page.locator(".fidelity-month-grid").evaluate((grid) => {
    for (const card of [...grid.children].slice(0, 2)) grid.append(card.cloneNode(true));
    return [...grid.children].map((card) => {
      const box = card.getBoundingClientRect();
      return { y: box.y, height: box.height };
    });
  });
  expect(rows).toHaveLength(12);
  expect(new Set(rows.map(({ y }) => y)).size).toBe(3);
  for (const { height } of rows) {
    expect(height).toBeGreaterThanOrEqual(140);
    expect(height).toBeLessThanOrEqual(200);
  }
});

test("twelve years show four recent cards per page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installTauriBridge(page, { fidelityDesktop: "summary" });
  await seedSummaryYears(page, 2024);
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 50_000 });
  await expect(page.locator(".fidelity-year-card")).toHaveCount(3);
  const threeYearHeight = (await page.locator(".fidelity-year-section").boundingBox())!.height;
  await seedSummaryYears(page, 2015);
  await page.reload();
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 50_000 });
  const section = page.locator(".fidelity-year-section");
  const cards = section.locator(".fidelity-year-card");
  await expect(cards).toHaveCount(4);
  expect(Math.abs((await section.boundingBox())!.height - threeYearHeight)).toBeLessThanOrEqual(2);
  expect((await page.locator(".fidelity-month-card").first().boundingBox())!.height).toBe(167);
  await expect(cards.first()).toContainText("2026");
  await expect(section.getByRole("navigation", { name: "By year" })).toContainText("Showing 1-4 of 12");
  await page.evaluate(() => document.fonts.ready);
  mkdirSync("/tmp/summary-card-height", { recursive: true });
  await section.screenshot({ path: "/tmp/summary-card-height/years-1280-twelve.png", animations: "disabled" });
  await section.getByRole("button", { name: "Next" }).click();
  await expect(cards.first()).toContainText("2022");
  await section.getByRole("button", { name: "Previous" }).click();
  await expect(cards.first()).toContainText("2026");
  await cards.filter({ hasText: "2024" }).click();
  await section.getByRole("button", { name: "Next" }).click();
  await section.getByRole("button", { name: "Previous" }).click();
  await expect(cards.filter({ hasText: "2024" })).toHaveClass(/selected/);
});

test("Wallet mover cards use their content height with three sources", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installManySourceFixture(page, 3);
  await page.goto("/#/wallets");
  const card = page.locator(".t3-wallet-moved");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".t3-wallet-fidelity")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
  await expect(card.locator(".t3-wallet-movers > div").first()).toBeVisible();
  const layout = await card.evaluate((node) => ({
    blank: node.getBoundingClientRect().bottom - node.lastElementChild!.getBoundingClientRect().bottom,
    rowHeights: [...node.querySelectorAll(".t3-wallet-movers > div")]
      .map((row) => row.getBoundingClientRect().height),
  }));
  expect(layout.blank).toBeLessThan(40);
  expect(layout.rowHeights.length).toBeGreaterThan(0);
  expect(Math.max(...layout.rowHeights)).toBeLessThanOrEqual(80);
});

for (const width of [1280, 1920]) {
  for (const route of ["overview", "summary", "wallets", "comparison", "cost-basis", "history",
    "rebalance", "goals", "goals/kinds", "assistant", "settings/configuration?section=sources",
    "settings/appearance?section=theme", "settings/data?section=backup", "settings/systemInfo?section=pro", "settings/assistant",
    "settings/sync", "coins/BTC?assetType=crypto"]) {
    test(`${route} cards have no mostly blank vertical slab at ${width}px`, async ({ page }) => {
      const cardSelector = "#app-main-content [class*=card], #app-main-content .t3-fidelity-appearance > section";
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
      await installTauriBridge(page, { fidelityDesktop: "summary" });
      await page.goto(`/#/${route}`);
      await expect(page.locator("#app-main-content")).toBeVisible();
      await expect.poll(() => page.locator(cardSelector).count()).toBeGreaterThan(0);
      if (route === "overview") {
        await expect(page.locator(".t3-total-overview")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("#app-main-content [aria-busy]").first()).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      }
      if (route === "summary") await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      if (route === "wallets" && width === 1920) await expect(page.locator(".t3-wallet-fidelity")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
      if (route === "comparison") {
        await expect(page.locator(".analyze-comparison")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
        await expect(page.locator(".t3-cmp-assets tbody tr, .comparison-assets-table tbody tr").first())
          .toBeVisible({ timeout: 30_000 });
      }
      if (route === "cost-basis") await expect(page.locator(".fidelity-cost-grid")).toBeVisible({ timeout: 30_000 });
      if (route === "history") {
        await expect(page.getByTestId("history-desktop-detail")).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("history-desktop-loading")).toHaveCount(0, { timeout: 30_000 });
      }
      if (route === "assistant") await expect(page.getByRole("heading", { name: "Ask about your portfolio" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".t3-desktop-skeleton-card, .fidelity-skeleton, .fd-skeleton")).toHaveCount(0, { timeout: 30_000 });
      if (route === "goals" && await page.locator(".t3-manage-goals").count()) {
        await expect(page.locator(".t3-goals-chart [role=status]")).toHaveCount(0, { timeout: 30_000 });
      }
      await page.evaluate(() => document.fonts.ready);
      const cards = await page.evaluate((selector) => [...document.querySelectorAll(selector)].flatMap((card) => {
        const box = card.getBoundingClientRect();
        if (box.height <= 0 || box.width <= 0 || getComputedStyle(card).display === "none") return [];
        if (card.closest("[data-empty-state], .fidelity-skeleton, .fd-skeleton")) return [];
        let contentBottom = box.top;
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim() || getComputedStyle(node.parentElement!).visibility !== "visible") continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          contentBottom = Math.max(contentBottom, range.getBoundingClientRect().bottom);
        }
        for (const visual of card.querySelectorAll("svg, canvas, img, [role=img]")) {
          if (getComputedStyle(visual).visibility === "visible") contentBottom = Math.max(contentBottom, visual.getBoundingClientRect().bottom);
        }
        if (contentBottom === box.top) {
          for (const child of card.querySelectorAll("*")) {
            const style = getComputedStyle(child);
            const painted = (style.backgroundImage !== "none" && style.backgroundImage !== "") ||
              !["transparent", "rgba(0, 0, 0, 0)"].includes(style.backgroundColor);
            const childBox = child.getBoundingClientRect();
            if (painted && style.visibility === "visible" && childBox.height <= 60) {
              contentBottom = Math.max(contentBottom, childBox.bottom);
            }
          }
        }
        const blankFraction = (box.bottom - contentBottom) / box.height;
        return [{ className: card.getAttribute("class"), blankFraction, height: box.height }];
      }), cardSelector);
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.filter(({ blankFraction }) => blankFraction > 0.6)).toEqual([]);
    });
  }
}
