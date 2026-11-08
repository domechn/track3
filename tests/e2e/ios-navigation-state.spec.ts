import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const routes = [
  "overview", "summary", "comparison", "wallets", "coins/BTC", "cost-basis",
  "history", "rebalance", "goals", "assistant", "settings", "settings/appearance",
  "settings/sources", "settings/assistant", "settings/sync",
];

test("iPad rail and phone tabs keep active paint and icon positions across routes", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const width of [820, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      userAgent: width === 820 ? "Track3 iPad" : "Track3 iPhone",
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      const nav = page.locator(width === 820 ? ".mobile-sidebar" : ".mobile-tab-bar");
      if (width === 820) await expect(nav.locator(".mobile-rail-footer")).toHaveCSS("border-top-width", "1px", { timeout: 60_000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await page.reload();
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        for (const expanded of width === 820 ? [false, true] : [false]) {
          if (width === 820 && !expanded && await nav.getAttribute("data-collapsed") !== "true") {
            await nav.getByRole("button", { name: "Collapse sidebar" }).click();
          }
          if (expanded) await nav.getByRole("button", { name: "Expand sidebar" }).click();
          let reference: Awaited<ReturnType<typeof sample>> | undefined;
          for (const route of routes) {
            await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
            const active = nav.locator(".t3-nav-item[aria-current='page']");
            await expect(active).toHaveCount(1);
            const expected = width === 820
              ? route.startsWith("coins/") ? "overview" : route.split("/")[0]
              : route === "history" ? "history"
                : route === "overview" || route.startsWith("coins/") ? "overview"
                  : ["summary", "wallets", "comparison", "cost-basis"].includes(route) ? "summary" : "more";
            await expect(active, `${width} ${theme} ${route}`).toHaveAttribute("href", `#/${expected}`, { timeout: 30_000 });
            const state = await sample(nav, width);
            if (route === "overview" && process.env.NAV_REVIEW_DIR) {
              await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible({ timeout: 60_000 });
              if (width === 390) await expect(page.locator(".fd-overview[data-state='ready']")).toBeVisible({ timeout: 60_000 });
              mkdirSync(process.env.NAV_REVIEW_DIR, { recursive: true });
              await page.screenshot({ path: `${process.env.NAV_REVIEW_DIR}/${width === 820 ? "ipad" : "phone"}-${theme}-${expanded ? "expanded" : "collapsed"}.png` });
            }
            expect(state.background).toBe(state.token);
            expect(state.radius).toBe(8);
            expect(state.bar[0]).toBe(3);
            expect(state.bar[1]).toBe(20);
            expect(Math.abs(state.bar[2] - (width === 820 ? 0 : state.activeX))).toBeLessThanOrEqual(.5);
            expect(state.clipLeft).toBeLessThanOrEqual(state.bar[2]);
            expect(state.contrast).toBeGreaterThanOrEqual(4.5);
            if (width === 820) {
              expect(state.activeSize[1]).toBe(expanded ? 36 : 40);
              if (!expanded) expect(state.activeSize[0]).toBe(40);
            }
            if (reference) {
              expect(Math.abs(state.activeSize[0] - reference.activeSize[0]), `${width} ${theme} ${route} tile width`)
                .toBeLessThanOrEqual(.5);
              expect(Math.abs(state.activeSize[1] - reference.activeSize[1]), `${width} ${theme} ${route} tile height`)
                .toBeLessThanOrEqual(.5);
              expect(state.positions.map((p) => p.key)).toEqual(reference.positions.map((p) => p.key));
              for (const [i, item] of state.positions.entries()) {
                expect(Math.abs(item.x - reference.positions[i].x), `${width} ${theme} ${route} ${item.key} x`).toBeLessThanOrEqual(.5);
                expect(Math.abs(item.y - reference.positions[i].y), `${width} ${theme} ${route} ${item.key} y`).toBeLessThanOrEqual(.5);
              }
            } else reference = state;
          }
        }
      }
    } finally {
      await context.close();
    }
  }
});

test("an unread badge leaves iPad and phone navigation positions fixed", async ({ browser }) => {
  for (const width of [820, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      userAgent: width === 820 ? "Track3 iPad" : "Track3 iPhone",
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      const nav = page.locator(width === 820 ? ".mobile-sidebar" : ".mobile-tab-bar");
      await expect(nav).toBeVisible();
      const before = (await sample(nav, width)).positions;
      await page.evaluate(async () => (window as typeof window & {
        __e2eInvoke: (command: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
      }).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
        values: ["price", "BTC price alert", "Navigation badge fixture", 1, "2026-10-31T09:41:00.000Z"],
      }));
      await page.reload();
      await expect(nav.locator(width === 820 ? 'a[href="#/goals"]' : 'a[href="#/more"]'))
        .toHaveAttribute("aria-label", /unread/);
      const after = (await sample(nav, width)).positions;
      expect(after).toEqual(before);
    } finally {
      await context.close();
    }
  }
});

test("expanded landscape rail clears the left safe area", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    userAgent: "Track3 iPhone",
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await page.evaluate(() => document.documentElement.style.setProperty("--mobile-safe-left", "44px"));
    const rail = page.locator(".mobile-sidebar");
    if (await rail.getAttribute("data-collapsed") === "true") {
      await rail.getByRole("button", { name: "Expand sidebar" }).click();
    }
    const icon = rail.locator('a[href="#/overview"] svg').first();
    await expect(icon).toBeVisible();
    expect((await icon.boundingBox())!.x).toBeGreaterThanOrEqual(44);
    const barX = await rail.locator(".t3-nav-item[aria-current='page']").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.x + parseFloat(getComputedStyle(node, "::before").left);
    });
    expect(Math.abs(barX)).toBeLessThanOrEqual(.5);
  } finally {
    await context.close();
  }
});

async function sample(nav: import("@playwright/test").Locator, width: number) {
  return nav.evaluate((node, width) => {
    const active = node.querySelector<HTMLElement>(".t3-nav-item[aria-current='page']")!;
    const rect = active.getBoundingClientRect();
    const css = getComputedStyle(active);
    const before = getComputedStyle(active, "::before");
    const sample = document.createElement("span");
    sample.style.background = "var(--nav-selected-background)";
    active.append(sample);
    const token = getComputedStyle(sample).backgroundColor;
    sample.remove();
    const base = getComputedStyle(node).backgroundColor;
    const channels = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r, g, b] = channels(value).map((v) => {
        const x = v / 255;
        return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const alpha = Number(css.backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
    const mixed = `rgb(${channels(css.backgroundColor).map((v, i) => Math.round(v * alpha + channels(base)[i] * (1 - alpha))).join(", ")})`;
    const lights = [luminance(css.color), luminance(mixed)].sort((a, b) => b - a);
    const positions = [...node.querySelectorAll<HTMLElement>(width === 820
      ? ".mobile-rail-item svg, .mobile-rail-group, .mobile-rail-brand svg, .mobile-sidebar-collapse svg"
      : ".mobile-tab-icon > svg:first-child")].map((item) => {
      const box = item.getBoundingClientRect();
      return { key: item.closest("a")?.getAttribute("href") ?? "divider", x: box.x, y: box.y };
    });
    const padX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
    const padY = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    return {
      activeX: rect.x, activeSize: [rect.width - padX, rect.height - padY],
      radius: parseFloat(css.borderTopLeftRadius) - parseFloat(css.paddingTop),
      background: css.backgroundColor, token, bar: [parseFloat(before.width), parseFloat(before.height), rect.x + parseFloat(before.left)],
      contrast: (lights[0] + .05) / (lights[1] + .05), positions,
      clipLeft: (node.querySelector(".mobile-rail-scroll") ?? node).getBoundingClientRect().left,
    };
  }, width);
}
