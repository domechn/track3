import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge, seedDesktopAiSummary } from "./fidelity-scenes";
import { seedComparisonMoversFixture } from "./comparison-movers-scenes";

test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop"));

const output = "/tmp/track3-card-row-heights";

async function measureOverviewRows(page: import("@playwright/test").Page) {
  return page.locator(".t3-overview-grid").evaluate((grid) => {
    const bounds = (element: Element) => element.getBoundingClientRect();
    return [...grid.children].map((cell) => {
      const card = cell.querySelector(".t3-overview-panel, .t3-insights-card, .t3-hero-card") ?? cell.firstElementChild!;
      const content = card.querySelector(".t3-moved-pager") ??
        card.querySelector(".t3-moved-list li:last-child") ??
        card.querySelector(".t3-daily-direction span:last-child") ??
        [...card.children].filter((child) => getComputedStyle(child).display !== "none").at(-1)!;
      return {
        cell: cell.className,
        y: bounds(cell).y,
        cellHeight: bounds(cell).height,
        cardHeight: bounds(card).height,
        blank: bounds(card).bottom - bounds(content).bottom,
      };
    });
  });
}

async function measurePageGrids(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const selectors = [
      ".t3-overview-grid", ".fidelity-summary-grid:not([role='status'])", ".t3-cmp-grid",
      ".comparison-movers", ".t3-wallet-grid", ".cost-dashboard", ".fidelity-cost-grid", ".t3-manage-goals",
      ".t3-b-grid", ".t3-assistant-settings", ".t3-fr-grid", ".t3-fidelity-grid",
      ".t3-settings-appearance-content > .grid", ".t3-fidelity-appearance", ".sync-settings-page",
    ];
    const bounds = (element: Element) => element.getBoundingClientRect();
    let pairedCells = 0;
    const cards = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].flatMap((grid) => {
      if (getComputedStyle(grid).display !== "grid" || bounds(grid).width === 0) return [];
      const cells = [...grid.children].filter((cell) => {
        const style = getComputedStyle(cell);
        return style.display !== "none" && style.visibility !== "hidden" && bounds(cell).width > 0;
      });
      const rows = new Map<number, typeof cells>();
      for (const cell of cells) {
        const y = Math.round(bounds(cell).y);
        rows.set(y, [...rows.get(y) ?? [], cell]);
      }
      const pairedRows = [...rows].filter(([, row]) => row.length > 1);
      pairedCells += pairedRows.reduce((count, [, row]) => count + row.length, 0);
      return pairedRows.flatMap(([y, row]) => row.flatMap((cell) => {
        const card = cell.matches("[data-ui-card], .fidelity-card, .t3-wallet-card, .t3-cmp-card, .t3-b-card, .t3-fr-card, .t3-fidelity-card, .comparison-movers > section, .t3-fidelity-appearance > section")
          ? cell : cell.querySelector("[data-ui-card], .fidelity-card, .t3-wallet-card, .t3-cmp-card, .t3-b-card, .t3-fr-card, .t3-fidelity-card");
        if (!card) return [];
        const visibleChildren = [...card.children].filter((child) => {
          const style = getComputedStyle(child);
          return style.display !== "none" && style.visibility !== "hidden" &&
            style.position !== "absolute" && bounds(child).height > 0;
        });
        const axes = card.querySelectorAll(".t3-daily-x-axis, .t3-daily-direction span:last-child");
        const lastBottom = Math.max(bounds(card).top, ...visibleChildren.map((child) => bounds(child).bottom),
          ...[...axes].map((axis) => bounds(axis).bottom));
        return [{
          grid: selector, y, card: card.className, heading: card.querySelector("h2,h3,.heading")?.textContent,
          height: bounds(card).height,
          cellHeight: bounds(cell).height, blank: bounds(card).bottom - lastBottom,
          overflow: Math.max(0, lastBottom - bounds(card).bottom),
          pager: !!card.querySelector("[class*='pager']"),
        }];
      }));
    }));
    return { cards, pairedCells };
  });
}

test("Overview row cards share their height and fill their last content row", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedDesktopAiSummary(page);
  await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".t3-insights-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".t3-moved-list li")).toHaveCount(8, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  const rows = await measureOverviewRows(page);
  expect(rows).toHaveLength(7);
  for (const row of rows) {
    expect(Math.abs(row.cardHeight - row.cellHeight), row.cell).toBeLessThanOrEqual(1);
    expect(row.blank, row.cell).toBeLessThan(24);
  }
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/overview-1280-full.png`, fullPage: true });
});

test("Overview keeps the owner's eleven assets accessible inside equal-height cards", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedComparisonMoversFixture(page);
  await seedDesktopAiSummary(page);
  await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".t3-holdings-panel .t3-holdings-row")).toHaveCount(7, { timeout: 30_000 });
  await expect(page.locator(".t3-holdings-pager")).toContainText("11", { timeout: 30_000 });
  await expect(page.locator(".t3-moved-list li")).toHaveCount(8, { timeout: 30_000 });
  await expect(page.locator(".t3-moved-pager")).toContainText("15", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  const rows = await measureOverviewRows(page);
  for (const row of rows) {
    expect(Math.abs(row.cardHeight - row.cellHeight), row.cell).toBeLessThanOrEqual(1);
    expect(row.blank, row.cell).toBeLessThan(/t3-grid-moved/.test(row.cell) ? 40 : 24);
  }
  const holdings = page.locator(".t3-holdings-panel");
  const lastHolding = holdings.locator(".t3-holdings-row").last();
  const cardBox = (await holdings.boundingBox())!;
  const lastBox = (await lastHolding.boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 40);
  const sources = page.locator(".t3-sources-panel");
  const sourceLink = sources.getByRole("link", { name: "Manage sources" });
  const sourceBox = (await sources.boundingBox())!;
  const sourceLinkBox = (await sourceLink.boundingBox())!;
  expect(sourceBox.y + sourceBox.height - sourceLinkBox.y - sourceLinkBox.height).toBeLessThan(24);
  const sourceHeadingBox = (await sources.locator(".t3-overview-panel-heading").boundingBox())!;
  const sourceListBox = (await sources.locator(".t3-sources-list").boundingBox())!;
  const aboveSource = sourceListBox.y - sourceHeadingBox.y - sourceHeadingBox.height;
  const belowSource = sourceLinkBox.y - sourceListBox.y - sourceListBox.height;
  expect(Math.abs(aboveSource - belowSource)).toBeLessThan(24);
  await page.locator(".t3-holdings-pager").getByRole("button", { name: "Next" }).click();
  await expect(holdings).toContainText("USD");
  await page.locator(".t3-moved-pager").getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".t3-moved-list")).toContainText("USD");
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: `${output}/overview-1280-eleven.png`, fullPage: true });
});

test("Overview Show all expands the row so every insight stays visible", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedDesktopAiSummary(page, "One — first line.\nTwo — second line.\nThree — third line.\nFour — fourth line.\nFive — fifth line.");
  await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
  const card = page.locator(".t3-insights-summary");
  await expect(card.getByRole("button", { name: "Show all (5)" })).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: "Show all (5)" }).click();
  await expect(card.locator(".t3-insights-summary-lines > div")).toHaveCount(5);
  const cardBox = (await card.boundingBox())!;
  const lastBox = (await card.locator(".t3-insights-summary-lines > div").last().boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 40);
  const rows = await measureOverviewRows(page);
  for (const row of rows.filter((item) => Math.abs(item.y - rows[2].y) <= 1))
    expect(Math.abs(row.cardHeight - row.cellHeight), row.cell).toBeLessThanOrEqual(1);
});

for (const width of [1280, 1440]) test(`review: daily axis and one source stay within their cards at ${width}px`, async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedComparisonMoversFixture(page);
  await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".t3-daily-x-axis")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".t3-sources-panel .t3-source-row")).toHaveCount(1);
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const daily = bounds(".t3-daily-panel");
    const source = bounds(".t3-sources-panel .t3-source-row");
    return {
      datesBottomGap: daily.bottom - bounds(".t3-daily-x-axis").bottom,
      downBottomGap: daily.bottom - bounds(".t3-daily-direction span:last-child").bottom,
      sourceHeight: source.height,
    };
  });
  expect(geometry.datesBottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.downBottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.sourceHeight).toBeLessThan(80);
});

test("review: assistant summary switch stays beside its label", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/settings/assistant", { waitUntil: "domcontentloaded" });
  const label = page.locator("label[for='assistant-insight-summary']");
  const control = page.locator("#assistant-insight-summary");
  await expect(label).toBeVisible({ timeout: 30_000 });
  const labelBox = (await label.boundingBox())!;
  const controlBox = (await control.boundingBox())!;
  expect(controlBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
  expect(controlBox.y).toBeLessThan(labelBox.y + labelBox.height + 16);
});

for (const [width, stale] of [[1100, false], [1440, true]] as const) {
  test(`review: five long insights fit at ${width}px${stale ? " with stale source" : ""}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    if (stale) await page.addInitScript(() => {
      localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([{
        sourceId: "sample:binance", label: "Binance", kind: "exchange", provider: "binance",
        status: "failed", lastSuccessAt: "2026-10-31T08:12:00Z", detail: "Source timed out",
      }]));
    });
    await seedDesktopAiSummary(page, Array.from({ length: 5 }, (_, index) =>
      `Position ${index + 1} — ${"The weekly movement needs a complete explanation for this asset and its contribution. ".repeat(2)}`).join("\n"));
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    if (stale) await expect(page.locator(".t3-source-banner")).toBeVisible({ timeout: 30_000 });
    const card = page.locator(".t3-insights-summary");
    await card.getByRole("button", { name: "Show all (5)" }).click({ timeout: 30_000 });
    await expect(card.locator(".t3-insights-summary-lines > div")).toHaveCount(5);
    const geometry = await card.evaluate((element) => {
      const lastLine = element.querySelector(".t3-insights-summary-lines > div:last-child")!.getBoundingClientRect();
      const button = element.querySelector(".t3-insights-more")!.getBoundingClientRect();
      const card = element.getBoundingClientRect();
      return { lastGap: card.bottom - lastLine.bottom, buttonGap: card.bottom - button.bottom,
        cardHeight: card.height, cellHeight: element.parentElement!.getBoundingClientRect().height };
    });
    expect(Math.abs(geometry.cardHeight - geometry.cellHeight)).toBeLessThanOrEqual(1);
    expect(geometry.lastGap, JSON.stringify(geometry)).toBeGreaterThanOrEqual(8);
    expect(geometry.buttonGap).toBeGreaterThanOrEqual(8);
  });
}

for (const width of [1100, 1280, 1440, 1920]) for (const theme of ["light", "dark"] as const)
  for (const fixture of ["eleven", "new-user"] as const) test(`paired desktop cards at ${width}px in ${theme} with ${fixture} data`, async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
  if (fixture === "eleven") {
    await installTauriBridge(page, { fidelitySample: "full" });
    await seedComparisonMoversFixture(page);
    await seedDesktopAiSummary(page);
  } else {
    await installTauriBridge(page, { emptyPortfolio: true });
  }
  const withoutData = fixture === "new-user";
  const routes = [
    ["/overview", withoutData ? width >= 1400 ? ".t3-fr-grid" : ".t3-first-run-legacy [data-empty-state]" : ".t3-overview-grid"],
    ["/summary", withoutData ? "main [data-empty-state]" : ".fidelity-summary"],
    ["/comparison", withoutData ? "main [data-empty-state]" : ".analyze-comparison"],
    ["/wallets", withoutData ? "main [data-empty-state]" : ".analyze-wallets"],
    ["/cost-basis", ".fidelity-cost"],
    ["/rebalance", ".t3-manage-rebalance, .t3-fidelity-rebalance"],
    ["/goals", ".t3-manage-goals, .t3-fidelity-goals"],
    ["/settings/appearance", ".t3-settings[data-design-section='appearance']"],
    ["/settings/data?section=backup", ".t3-settings[data-design-section='backup']"],
    ["/settings/data?section=security", ".t3-settings[data-design-section='security']"],
    ["/settings/assistant", ".t3-settings[data-design-section='ai']"],
    ["/settings/sync", ".t3-settings[data-design-section='sync']"],
  ] as const;
  const expectedContainers: Record<string, string> = {
    "/overview": withoutData ? ".t3-fr-grid" : ".t3-overview-grid",
    "/summary": ".fidelity-summary-grid:not([role='status'])",
    "/comparison": ".t3-cmp-grid, .analyze-comparison",
    "/wallets": ".t3-wallet-grid, .analyze-wallets",
    "/cost-basis": ".cost-dashboard, .fidelity-cost-grid",
    "/rebalance": ".t3-fidelity-grid, .t3-manage-rebalance",
    "/goals": ".t3-manage-goals, .t3-fidelity-grid",
    "/settings/appearance": ".t3-settings-appearance-content > .grid, .t3-fidelity-appearance",
    "/settings/data?section=backup": ".t3-b-grid, .t3-settings-content > .space-y-6",
    "/settings/data?section=security": ".t3-b-grid, .t3-settings-content > .space-y-6",
    "/settings/assistant": ".t3-b-grid, .t3-assistant-settings",
    "/settings/sync": ".t3-b-grid, .sync-settings-page",
  };
  const issues: string[] = [];
  for (const [route, ready] of routes) {
    await page.goto(`/#${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(ready)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
    if (route === "/rebalance" && withoutData && width >= 1500 && theme === "dark")
      await expect(page.locator(".t3-fidelity-allocation-empty")).toBeVisible();
    if (route === "/overview" && fixture === "eleven") {
      await expect(page.locator(".t3-top-coins .t3-top-row")).toHaveCount(6);
      await expect(page.locator(".t3-sources-panel .t3-source-row")).toHaveCount(1);
    }
    await page.evaluate(() => document.fonts.ready);
    const { cards, pairedCells } = await measurePageGrids(page);
    if (!withoutData || route.startsWith("/settings")) {
      const container = page.locator(expectedContainers[route]).filter({ visible: true }).first();
      await expect(container, route).toBeVisible();
      expect(await container.locator(":scope > *").count(), route).toBeGreaterThan(0);
    }
    if (pairedCells > 0)
      expect(cards.length, route).toBeGreaterThan(0);
    for (const card of cards) {
      const label = `${route} ${card.grid} ${card.y} ${card.card} ${card.heading}`;
      if (Math.abs(card.height - card.cellHeight) > 1) issues.push(`${label}: card ${card.height}, cell ${card.cellHeight}`);
      if (card.blank >= (card.pager ? 40 : 24)) issues.push(`${label}: blank ${card.blank}`);
      if (card.overflow > 1) issues.push(`${label}: overflow ${card.overflow}`);
    }
    if (width === 1100) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) issues.push(`${route}: horizontal overflow ${overflow}`);
    }
    if (route === "/overview" || width === 1440 && theme === "light" ||
      route === "/rebalance" && width === 1920 && theme === "dark" && withoutData) {
      mkdirSync(output, { recursive: true });
      if (route === "/overview" && fixture === "eleven")
        await page.locator("#app-main-content").evaluate((scroller) => { scroller.scrollTop = 500; });
      await page.screenshot({ path: `${output}/${route.slice(1).replaceAll("/", "-").replaceAll("?", "-")}-${width}-${theme}-${fixture}.png` });
    }
  }
  expect(issues).toEqual([]);
});
