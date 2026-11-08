import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { analyzePage } from "./fidelity-analyze-scenes";
import { installTauriBridge as installPartialBridge } from "./tauri-bridge";
import { installPlanFidelityScene } from "./phone-plan-fidelity-scenes";

const capture = (page: import("@playwright/test").Page, name: string) => {
  mkdirSync(".local/tag-theme", { recursive: true });
  return page.screenshot({ path: `.local/tag-theme/${name}.png`, fullPage: true });
};

async function measurePhoneDesign(page: import("@playwright/test").Page, name: string, sourceFile: string, appSelector: string) {
  const sourcePath = `/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/${sourceFile}`;
  if (!existsSync(sourcePath)) return;
  const design = await page.context().newPage();
  try {
    await design.goto(`file://${sourcePath}`);
    await design.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.fonts.ready);
    const source = await design.screenshot({ path: `.local/tag-theme/${name}-design-viewport.png`, animations: "disabled" });
    const app = await page.screenshot({ path: `.local/tag-theme/${name}-app-viewport.png`, animations: "disabled" });
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
        if ([0, 1, 2].some((channel) => Math.abs(actual.data[a + channel] - reference.data[b + channel]) > 20)) different++;
      }
      return { percent: Math.round(different / (width * height) * 10000) / 100, width, height };
    }, [app.toString("base64"), source.toString("base64")] as const);
    const bounds = (current: import("@playwright/test").Page, selector: string) =>
      current.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          backgroundColor: css.backgroundColor, color: css.color, fontSize: css.fontSize };
      });
    writeFileSync(`.local/tag-theme/${name}-remeasure.json`, JSON.stringify({
      ratio,
      source: await bounds(design, ".card"),
      app: await bounds(page, appSelector),
    }, null, 2));
  } finally {
    await design.close();
  }
}

const phone = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  timezoneId: "UTC",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
} as const;

test("phone tags and label screens render at 390 in both themes", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const { context, page } = await analyzePage(browser, "comparison", theme);
    try {
      for (const route of ["comparison", "overview", "wallets"] as const) {
        if (route !== "comparison") await page.goto(`/#/${route}`);
        await expect(page.locator("#app-main-content")).toBeVisible({ timeout: 90_000 });
        if (route === "overview") await expect(page.locator(".fd-overview")).toHaveAttribute("data-state", "ready", { timeout: 90_000 });
        else await expect(page.locator(route === "comparison" ? ".fd-comparison" : ".fd-wallets")).toHaveAttribute("aria-busy", "false", { timeout: 90_000 });
        if (route === "comparison") {
          const positions = await page.locator(".fd-comparison-asset").evaluateAll((rows) =>
            rows.slice(0, 3).map((row) => ({ edge: row.getBoundingClientRect().left, ticker: row.querySelector("b")!.getBoundingClientRect().left })));
          expect(positions).toHaveLength(3);
          expect(Math.abs(positions[0].ticker - positions[2].ticker)).toBeLessThanOrEqual(1);
          expect(positions[0].ticker - positions[0].edge).toBeGreaterThanOrEqual(8);
        }
        await capture(page, `phone-${route}-${theme}`);
        if (theme === "dark") await measurePhoneDesign(page, `phone-${route}`,
          route === "overview" ? "core-overview.html" : `analyze-${route}.html`, ".fd-card");
      }
    } finally {
      await context.close();
    }
  }
});

test("phone Wallets status tags keep the shared size in both themes", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const { context, page } = await analyzePage(browser, "wallets", theme);
    try {
      const status = page.locator(".fd-wallet-status");
      await expect(status.locator(".t3-tag").first()).toBeVisible({ timeout: 45_000 });
      const height = await status.locator(".t3-tag").first().evaluate((tag) => tag.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(18);
      expect(height).toBeLessThanOrEqual(22);
      await expect(status.locator(".t3-tag").first()).toHaveCSS("border-radius", "999px");
      mkdirSync(".local/tag-theme", { recursive: true });
      await status.screenshot({ path: `.local/tag-theme/phone-wallet-status-${theme}.png`, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});

test("phone alert labels render in both themes", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ ...phone, colorScheme: theme });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installPlanFidelityScene(page, "goals");
      await page.goto("/#/goals");
      await expect(page.locator(".pf-rules-list .t3-tag").first()).toBeVisible({ timeout: 90_000 });
      const heights = await page.locator(".pf-rules-list .t3-tag").evaluateAll((tags) =>
        tags.map((tag) => tag.getBoundingClientRect().height));
      expect(heights.every((height) => height >= 18 && height <= 22)).toBe(true);
      await capture(page, `phone-goals-${theme}`);
      if (theme === "dark") await measurePhoneDesign(page, "phone-goals", "plan-goals.html", ".pf-card");
      await page.locator(".pf-rules-list").screenshot({ path: `.local/tag-theme/phone-goals-rules-${theme}.png`, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});

test("phone Summary partial markers render in both themes", async ({ browser }) => {
  test.setTimeout(540_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ ...phone, colorScheme: theme });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installPartialBridge(page, { partialProfitHistory: true });
      await page.goto("/#/summary");
      await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
      await expect(page.locator(".fd-month[data-partial='true']").first()).toBeVisible();
      await capture(page, `phone-summary-${theme}`);
      if (theme === "dark") await measurePhoneDesign(page, "phone-summary", "analyze-summary.html", ".fd-card");
      await page.locator(".fd-month[data-partial='true']").first().screenshot({ path: `.local/tag-theme/phone-summary-partial-${theme}.png`, animations: "disabled" });
    } finally {
      await context.close();
    }
  }
});
