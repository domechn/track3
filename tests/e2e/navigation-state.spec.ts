import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

const routes = [
  "overview", "summary", "comparison", "wallets", "coins/BTC", "cost-basis",
  "history", "rebalance", "goals", "assistant", "settings", "settings/appearance",
  "settings/sources", "settings/assistant", "settings/sync",
];
const delta = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(.5);

test("desktop navigation keeps one active tile and fixed icon geometry on every route", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    for (const expanded of [false, true]) {
      const rail = page.locator(".t3-desktop-rail");
      if (expanded) await rail.getByRole("button", { name: "Expand sidebar" }).click();
      let reference: Awaited<ReturnType<typeof sample>> | undefined;
      for (const route of routes) {
        await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
        const active = rail.locator(".t3-nav-item[aria-current='page']");
        await expect(active).toHaveCount(1);
        const activeRoute = route.startsWith("coins/") ? "overview" : route.split("/")[0];
        await expect(active).toHaveAttribute("href", `#/${activeRoute}`);
        const state = await sample(rail);
        if (route === "overview" && process.env.NAV_REVIEW_DIR) {
          await expect(page.locator(".t3-overview-grid")).toBeVisible();
          await expect(page.locator(".t3-overview-heading").locator("xpath=..")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
          mkdirSync(process.env.NAV_REVIEW_DIR, { recursive: true });
          await page.screenshot({ path: `${process.env.NAV_REVIEW_DIR}/desktop-${theme}-${expanded ? "expanded" : "collapsed"}.png` });
        }
        expect(state.activeSize[1]).toBe(expanded ? 36 : 40);
        if (!expanded) expect(state.activeSize[0]).toBe(40);
        expect(state.radius).toBe("8px");
        expect(state.bar).toEqual([3, 20, 0]);
        expect(state.clipLeft).toBeLessThanOrEqual(state.bar[2]);
        expect(state.background).toBe(state.token);
        expect(state.contrast).toBeGreaterThanOrEqual(4.5);
        if (reference) {
          delta(state.activeSize[0], reference.activeSize[0]);
          delta(state.activeSize[1], reference.activeSize[1]);
          expect(state.positions.map((p) => p.key)).toEqual(reference.positions.map((p) => p.key));
          for (const [i, position] of state.positions.entries()) {
            delta(position.x, reference.positions[i].x);
            delta(position.y, reference.positions[i].y);
          }
        } else reference = state;
      }
      if (expanded) await rail.getByRole("button", { name: "Collapse sidebar" }).click();
    }
  }
});

async function sample(rail: import("@playwright/test").Locator) {
  return rail.evaluate((node) => {
    const active = node.querySelector<HTMLElement>(".t3-nav-item[aria-current='page']")!;
    const rect = active.getBoundingClientRect();
    const css = getComputedStyle(active);
    const before = getComputedStyle(active, "::before");
    const icon = active.querySelector("svg")!;
    const base = getComputedStyle(node).backgroundColor;
    const channels = (value: string) => {
      const match = value.match(/[\d.]+/g);
      if (!match) throw new Error(JSON.stringify({ value, color: css.color, background: css.backgroundColor, base, token }));
      return match.slice(0, 3).map(Number);
    };
    const luminance = (value: string) => {
      const [r, g, b] = channels(value).map((v) => {
        const x = v / 255;
        return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const alpha = Number(css.backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
    const composite = `rgb(${channels(css.backgroundColor).map((v, i) => Math.round(v * alpha + channels(base)[i] * (1 - alpha))).join(", ")})`;
    const lights = [luminance(css.color), luminance(composite)].sort((a, b) => b - a);
    const tokenProbe = document.createElement("span");
    tokenProbe.style.background = "var(--nav-selected-background)";
    active.append(tokenProbe);
    const token = getComputedStyle(tokenProbe).backgroundColor;
    tokenProbe.remove();
    const positions = [...node.querySelectorAll<HTMLElement>(".t3-nav-item svg, .t3-nav-divider, :scope > div:first-child svg, :scope > button:last-child svg")].map((item) => {
      const box = item.getBoundingClientRect();
      return { key: item.closest("a")?.getAttribute("href") ?? (item.matches("svg") ? "toggle" : "divider"), x: box.x, y: box.y };
    });
    return {
      activeSize: [rect.width, rect.height], radius: css.borderTopLeftRadius,
      background: css.backgroundColor, token, contrast: (lights[0] + .05) / (lights[1] + .05),
      bar: [parseFloat(before.width), parseFloat(before.height), parseFloat(before.left) + rect.left],
      positions,
      clipLeft: (node.querySelector("nav") ?? node).getBoundingClientRect().left,
      iconColor: getComputedStyle(icon).color,
    };
  });
}

test("selected desktop controls use the navigation tint", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload();
    for (const [route, selector, action] of [
      ["summary", ".t3-fidelity-ranges button[aria-pressed='true']", ""],
      ["summary", ".fidelity-year-card.selected", "year"],
      ["wallets", ".t3-wallet-ranges button[aria-pressed='true']", ""],
      ["comparison", ".t3-cmp-quick button[aria-pressed='true']", ""],
      ["comparison", ".t3-cmp-calendar-days button.selected", "calendar"],
      ["settings/appearance?section=theme", ".t3-fidelity-appearance .theme-choice[aria-checked='true']", ""],
      ["settings/appearance?section=theme", ".t3-fidelity-appearance .colour-choice[aria-checked='true']", ""],
      ["settings/appearance?section=language", ".t3-fidelity-language .options button[aria-checked='true']", ""],
      ["settings", ".t3-settings-menu-link[aria-current='page']", ""],
    ] as const) {
      await page.goto(`/#/${route}`);
      if (action === "year") await page.locator(".fidelity-year-card").first().click();
      if (action === "calendar") await page.locator(".t3-cmp-picker-trigger").first().click();
      const item = page.locator(selector).first();
      await expect(item).toBeVisible({ timeout: 30_000 });
      const selectedPaint = () => item.evaluate((node) => {
        const probe = document.createElement("span");
        probe.style.background = "var(--nav-selected-background)";
        probe.style.color = "hsl(var(--foreground))";
        node.append(probe);
        const token = getComputedStyle(probe);
        const selected = getComputedStyle(node);
        const result = { background: selected.backgroundColor, color: selected.color,
          tokenBackground: token.backgroundColor, tokenColor: token.color };
        probe.remove();
        return result;
      });
      await expect.poll(async () => {
        const colors = await selectedPaint();
        return [colors.background === colors.tokenBackground, colors.color === colors.tokenColor];
      }, { message: `${theme} ${selector}`, timeout: 30_000 }).toEqual([true, true]);
    }
  }
});

test("Pro navigation and unread badge leave other icon and footer positions fixed", async ({ browser }) => {
  const captures: Record<string, Record<string, [number, number]>> = {};
  for (const pro of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true, checkoutFixture: !pro });
      await page.goto("/#/summary");
      const rail = page.locator(".t3-desktop-rail");
      await expect(rail.locator('a[href="#/assistant"]')).toHaveCount(pro ? 1 : 0);
      for (const expanded of [false, true]) {
        if (expanded) await rail.getByRole("button", { name: "Expand sidebar" }).click();
        const before = await iconPositions(rail);
        if (!expanded) {
          await page.evaluate(async () => (window as typeof window & {
            __e2eInvoke: (command: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
          }).__e2eInvoke("plugin:sql|execute", {
            query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
            values: ["price", "BTC price alert", "Navigation badge fixture", 1, "2026-10-31T09:41:00.000Z"],
          }));
          await page.reload();
          await expect(rail.locator('a[href="#/goals"]')).toHaveAttribute("aria-label", /unread/);
          const badge = rail.locator('a[href="#/goals"] > span[aria-hidden="true"]');
          const summaryBox = await badge.boundingBox();
          await page.goto("/#/history");
          await expect(badge).toBeVisible();
          const historyBox = await badge.boundingBox();
          expect(historyBox).toEqual(summaryBox);
        }
        const after = await iconPositions(rail);
        expect(after).toEqual(before);
        captures[`${pro}-${expanded}`] = after;
      }
    } finally {
      await context.close();
    }
  }
  for (const expanded of [false, true]) {
    const proItems = captures[`true-${expanded}`];
    for (const [key, position] of Object.entries(captures[`false-${expanded}`])) {
      expect(proItems[key], key).toEqual(position);
    }
  }
});

async function iconPositions(rail: import("@playwright/test").Locator) {
  return rail.evaluate((node) => Object.fromEntries(
    [...node.querySelectorAll<HTMLElement>(".t3-nav-item svg")].map((icon) => {
      const link = icon.closest("a");
      const key = link?.getAttribute("href") ?? "records";
      const box = icon.getBoundingClientRect();
      return [key, [box.x, box.y] as [number, number]];
    }),
  ));
}

test("wide dark routes keep the same desktop rail in both widths", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installPlanFidelityScene(page, "rebalance");
  const rail = page.locator(".t3-desktop-rail");
  for (const expanded of [false, true]) {
    let reference: Awaited<ReturnType<typeof sample>> | undefined;
    for (const route of ["overview", "summary", "rebalance", "goals", "goals/kinds"]) {
      await page.goto(`/#/${route}`, { waitUntil: "domcontentloaded" });
      await expect(rail).toBeVisible();
      await expect(page.locator('nav[aria-label="Main navigation"]')).toHaveCount(1);
      await expect(page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator(".t3-fidelity-rail")).toHaveCount(0);
      if (route === "rebalance") await expect(page.getByTestId("rebalance-summary")).toBeVisible();
      if (route === "goals") await expect(page.getByTestId("goals-summary")).toBeVisible();
      if (route === "goals/kinds") await expect(page.getByRole("heading", { name: "Rule kinds" })).toBeVisible();
      const state = await sample(rail);
      expect(state.activeSize[1]).toBe(expanded ? 36 : 40);
      expect(state.radius).toBe("8px");
      expect(state.bar).toEqual([3, 20, 0]);
      expect(state.background).toBe(state.token);
      expect(state.contrast).toBeGreaterThanOrEqual(4.5);
      if (reference) {
        expect(state.positions.map((p) => p.key)).toEqual(reference.positions.map((p) => p.key));
        for (const [index, position] of state.positions.entries()) {
          delta(position.x, reference.positions[index].x);
          delta(position.y, reference.positions[index].y);
        }
      } else reference = state;
      if (process.env.NAV_REVIEW_DIR) {
        mkdirSync(process.env.NAV_REVIEW_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.NAV_REVIEW_DIR}/wide-${route.replace("/", "-")}-${expanded ? "expanded" : "collapsed"}.png` });
      }
    }
    if (!expanded) await rail.getByRole("button", { name: "Expand sidebar" }).click();
  }
});
