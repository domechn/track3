import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge, seedDesktopAiSummary } from "./fidelity-scenes";
import { installTauriBridge as installPartialBridge } from "./tauri-bridge";
import { installTauriBridge as installRecordsBridge, seedFidelityCompletedSync } from "./fidelity-bridge-captures";

const capture = (page: import("@playwright/test").Page, name: string) => {
  mkdirSync(".local/tag-theme", { recursive: true });
  return page.screenshot({ path: `.local/tag-theme/${name}.png`, fullPage: true, animations: "disabled" });
};

async function remeasure(page: import("@playwright/test").Page, name: string, sourceFile: string, sourceSelector: string, appSelector: string) {
  if (!existsSync(`/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/${sourceFile}`)) return;
  const design = await page.context().newPage();
  try {
    await design.setViewportSize(page.viewportSize()!);
    await design.goto(`file:///home/ubuntu/.hermes/projects/track3-design/source/ds/pages/${sourceFile}`);
    await design.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.fonts.ready);
    const source = await design.screenshot({ path: `.local/tag-theme/${name}-design.png`, animations: "disabled" });
    const app = await page.screenshot({ path: `.local/tag-theme/${name}-app.png`, animations: "disabled" });
    const bounds = async (current: import("@playwright/test").Page, selector: string) =>
      current.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          display: css.display, backgroundColor: css.backgroundColor };
      });
    const [sourceBounds, appBounds] = await Promise.all([bounds(design, sourceSelector), bounds(page, appSelector)]);
    const ratio = await page.evaluate(async ([appPng, sourcePng]) => {
      const pixels = async (encoded: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${encoded}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const [actual, reference] = await Promise.all([pixels(appPng), pixels(sourcePng)]);
      const width = Math.min(actual.width, reference.width);
      const height = Math.min(actual.height, reference.height);
      let different = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const a = (y * actual.width + x) * 4;
        const b = (y * reference.width + x) * 4;
        if (Math.abs(actual.data[a] - reference.data[b]) +
          Math.abs(actual.data[a + 1] - reference.data[b + 1]) +
          Math.abs(actual.data[a + 2] - reference.data[b + 2]) > 60) different++;
      }
      return { percent: Math.round(different / (width * height) * 10000) / 100, width, height };
    }, [app.toString("base64"), source.toString("base64")] as const);
    writeFileSync(`.local/tag-theme/${name}-remeasure.json`,
      JSON.stringify({ ratio, sourceBounds, appBounds }, null, 2));
  } finally {
    await design.close();
  }
}

function channel(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: number[]) {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) =>
    sum + weight * channel(rgb[index] / 255), 0);
}

function rgb(value: string) {
  const values = [...value.matchAll(/[\d.]+/g)].map(([number]) => Number(number));
  return value.startsWith("color(srgb ") ? values.slice(0, 3).map((channel) => channel * 255) : values.slice(0, 3);
}

test("Top mover tags use theme colors, compact height, and aligned ticker rows at 1440", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { fidelitySample: "full" });
      await page.goto("/#/comparison");
      const rows = page.locator(".t3-cmp-table tbody tr");
      await expect(rows.first()).toBeVisible({ timeout: 45_000 });
      await expect(rows.first().locator(".t3-tag")).toHaveText("Top mover");
      await expect(rows.nth(1).locator(".t3-tag")).toHaveText("Top mover");
      const colors = await rows.first().locator(".t3-tag").evaluate((element) => {
        const css = getComputedStyle(element);
        const layers: Element[] = [];
        for (let current: Element | null = element; current; current = current.parentElement) layers.unshift(current);
        const background = layers.reduce((under, layer) => {
          const color = getComputedStyle(layer).backgroundColor;
          const channels = [...color.matchAll(/[\d.]+/g)].map(([value]) => Number(value));
          if (color.startsWith("color(srgb ")) channels.splice(0, 3, ...channels.slice(0, 3).map((channel) => channel * 255));
          const alpha = channels[3] ?? 1;
          return under.map((value, index) => channels[index] * alpha + value * (1 - alpha));
        }, [255, 255, 255]);
        return { background, rawBackground: css.backgroundColor, foreground: css.color,
          height: element.getBoundingClientRect().height, radius: css.borderRadius, fontSize: css.fontSize, padding: css.padding };
      });
      if (theme === "light") expect(colors.rawBackground).not.toBe("rgb(20, 36, 58)");
      const values = [luminance(colors.background), luminance(rgb(colors.foreground))].sort((a, b) => a - b);
      expect((values[1] + 0.05) / (values[0] + 0.05), JSON.stringify({ theme, colors })).toBeGreaterThanOrEqual(4.5);
      expect(colors.height).toBeGreaterThanOrEqual(18);
      expect(colors.height).toBeLessThanOrEqual(22);
      expect(colors.radius).toBe("999px");
      expect(colors.fontSize).toBe("11px");
      expect(colors.padding).toBe("0px 6px");
      const ticker = await rows.first().locator(".t3-asset-label-name").boundingBox();
      const tag = await rows.first().locator(".t3-tag").boundingBox();
      const normal = await rows.nth(2).locator(".t3-asset-label-name").boundingBox();
      expect(ticker && tag && normal).toBeTruthy();
      expect(Math.abs(ticker!.y + ticker!.height / 2 - tag!.y - tag!.height / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(ticker!.x - normal!.x)).toBeLessThanOrEqual(1);
      await capture(page, `comparison-1440-${theme}`);
      if (theme === "dark") await remeasure(page, "desktop-comparison",
        "analyze-comparison.html", ".banner.info", ".t3-cmp-info");
    } finally {
      await context.close();
    }
  }
});

test("Comparison keeps its compact layout below 1400", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/comparison");
  await expect(page.locator(".t3-cmp-legacy")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".t3-cmp-fidelity")).toBeHidden();
});

test("light warning tags have readable contrast on a highlighted row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/comparison");
  const row = page.locator(".t3-cmp-table tbody tr.top").first();
  await expect(row).toBeVisible({ timeout: 45_000 });
  const colors = await row.evaluate((node) => {
    const tag = document.createElement("span");
    tag.className = "t3-tag";
    tag.dataset.tone = "warning";
    tag.textContent = "Warning";
    node.querySelector("th")!.append(tag);
    const layers: Element[] = [];
    for (let current: Element | null = tag; current; current = current.parentElement) layers.unshift(current);
    const background = layers.reduce((under, layer) => {
      const color = getComputedStyle(layer).backgroundColor;
      const channels = [...color.matchAll(/[\d.]+/g)].map(([value]) => Number(value));
      if (color.startsWith("color(srgb ")) channels.splice(0, 3, ...channels.slice(0, 3).map((channel) => channel * 255));
      const alpha = channels[3] ?? 1;
      return under.map((value, index) => channels[index] * alpha + value * (1 - alpha));
    }, [255, 255, 255]);
    return { background, foreground: getComputedStyle(tag).color };
  });
  const values = [luminance(colors.background), luminance(rgb(colors.foreground))].sort((a, b) => a - b);
  expect((values[1] + 0.05) / (values[0] + 0.05), JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
});

test("desktop label screens render in both themes", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { fidelitySample: "full", fidelityPro: true });
      for (const route of ["overview", "wallets", "goals"] as const) {
        if (route === "goals") await page.evaluate(async () => {
          const execute = (query: string, values: unknown[] = []) =>
            (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
          await execute("INSERT INTO alert_rules (kind, asset_type, symbol, comparator, threshold, enabled, cooldown_seconds) VALUES ('asset_price_target', 'crypto', 'BTC', 'gte', 70000, 1, 86400)");
          await execute("INSERT INTO alert_history (kind, title, message, symbol, value, triggered_at) VALUES ('asset_price_move', 'SOL price moved', 'SOL price moved', 'SOL', 14.3, '2026-10-31T09:41:01.000Z')");
        });
        await page.goto(`/#/${route}`);
        if (route === "overview") {
          await page.getByRole("button", { name: "Expand sidebar" }).click();
          await expect(page.locator(".t3-desktop-rail .t3-tag")).toHaveText("PRO");
        }
        await expect(page.locator(route === "overview" ? ".t3-hero-value" : route === "wallets" ? ".t3-wallet-status-list" : theme === "dark" ? ".t3-fidelity-goals" : ".t3-goals-rule-row")).toBeVisible({ timeout: 45_000 });
        if (route === "goals") await expect(page.locator(theme === "dark" ? ".t3-fidelity-goals .t3-tag" : ".t3-goals-rule-row .t3-tag").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await capture(page, `desktop-${route}-${theme}`);
        if (route === "wallets") await page.locator(".t3-wallet-status-list").screenshot({
          path: `.local/tag-theme/desktop-wallet-status-${theme}.png`, animations: "disabled",
        });
        if (route === "goals") await page.locator(theme === "dark" ? ".t3-fidelity-goal-row:not(.t3-fidelity-table-head)" : ".t3-goals-rule-row").first().screenshot({
          path: `.local/tag-theme/desktop-goal-status-${theme}.png`, animations: "disabled",
        });
      }
    } finally {
      await context.close();
    }
    const partialContext = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
    try {
      const page = await partialContext.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installPartialBridge(page, { partialProfitHistory: true });
      await page.goto("/#/summary");
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      await expect(page.locator(".fidelity-month-card[data-partial='true']").first()).toBeVisible();
      await capture(page, `desktop-summary-${theme}`);
      await page.locator(".fidelity-month-card[data-partial='true']").first().screenshot({
        path: `.local/tag-theme/desktop-summary-partial-${theme}.png`, animations: "disabled",
      });
    } finally {
      await partialContext.close();
    }
  }
});

test("saved Overview summary fills its card with one Regenerate control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedDesktopAiSummary(page);
  await page.goto("/#/overview");
  const card = page.locator(".t3-insights-summary");
  await expect(card).toBeVisible({ timeout: 45_000 });
  await expect(card.getByRole("button", { name: "Regenerate" })).toHaveCount(1);
  const layout = await card.evaluate((element) => {
    const lines = element.querySelector(".t3-insights-summary-lines")!;
    const items = [...lines.children];
    const gaps = items.slice(1).map((item, index) =>
      item.getBoundingClientRect().top - items[index].getBoundingClientRect().bottom);
    return { display: getComputedStyle(lines).display, gaps,
      footerGap: element.getBoundingClientRect().bottom - element.querySelector("footer")!.getBoundingClientRect().bottom };
  });
  expect(layout.display).toBe("flex");
  expect(Math.max(...layout.gaps) - Math.min(...layout.gaps)).toBeLessThanOrEqual(1);
  expect(layout.footerGap).toBeLessThan(24);
  await capture(page, "desktop-overview-summary-review");
  await remeasure(page, "desktop-overview-summary", "core-overview.html", ".ins", ".t3-insights-summary-lines");
});

test("an Edited snapshot reserves the date column for its tag", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1024 });
  await installRecordsBridge(page, { fidelityRecords: "history" });
  await page.goto("/#/history");
  const list = page.locator(".fidelity-history-list");
  await expect(list.locator("tbody .t3-tag").first()).toBeVisible({ timeout: 45_000 });
  const columns = await list.locator("thead").evaluate((element) => {
    const [date, total] = [...element.querySelectorAll("th")].map((cell) => cell.getBoundingClientRect().width);
    return { date, total };
  });
  expect(columns.date).toBeGreaterThan(columns.total + 40);
  await list.locator("tbody tr:has(.t3-tag)").first().click();
  await expect(page.getByTestId("history-desktop-detail")).toContainText("28 Oct 2026, 08:51");
  await seedFidelityCompletedSync(page);
  await capture(page, "desktop-history-edited-review");
  await remeasure(page, "desktop-history-edited", "records-history.html", ".snap th:first-child", ".fidelity-history-list th:first-child");
});
