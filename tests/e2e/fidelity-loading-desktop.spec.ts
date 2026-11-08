import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const contrast = (foreground: string, background: string) => {
  const luminance = (value: string) => {
    const [r, g, b] = value.match(/\d+/g)!.slice(0, 3).map((part) => {
      const channel = Number(part) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test("Loading desktop captures the real portfolio boot state", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync("/tmp/fidelity-desktop/loading", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 }, colorScheme: "dark",
    reducedMotion: "reduce", timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.addInitScript(() => {
      const original = (window as any).__e2eInvoke;
      (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
        if (cmd === "plugin:sql|select" && /assets_v2/i.test(args.query)) {
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }
        return original(cmd, args, ...rest);
      };
    });
    await page.goto("/#/overview");
    await expect(page.getByRole("status", { name: "Loading overview" })).toBeVisible();
    const kpiBottoms = await page.locator(".t3-desktop-skeleton-kpis > div").evaluateAll((columns) =>
      columns.map((column) => column.lastElementChild!.getBoundingClientRect().bottom));
    expect(Math.max(...kpiBottoms) - Math.min(...kpiBottoms)).toBeLessThan(1);
    await page.screenshot({ path: "/tmp/fidelity-desktop/loading/loading-desktop.png", fullPage: true, animations: "disabled" });
  } finally {
    await context.close();
  }
});

test("light desktop Overview loading cards follow the page palette at 1440px", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.addInitScript(() => {
      const original = (window as any).__e2eInvoke;
      (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
        if (cmd === "plugin:sql|select" && /assets_v2/i.test(args.query)) {
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }
        return original(cmd, args, ...rest);
      };
    });
    await page.goto("/#/overview", { waitUntil: "domcontentloaded" });
    const loading = page.getByRole("status", { name: "Loading overview" });
    await expect(loading).toBeVisible();
    const colors = await loading.evaluate((node) => ({
      page: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(node.querySelector(".t3-desktop-skeleton-card")!).backgroundColor,
      title: getComputedStyle(node.querySelector(".t3-desktop-skeleton-card h2")!).color,
      refresh: getComputedStyle(node.querySelector(".t3-desktop-skeleton-head button")!).color,
      refreshOpacity: Number(getComputedStyle(node.querySelector(".t3-desktop-skeleton-head button")!).opacity),
    }));
    expect(colors.card).not.toBe("rgb(19, 18, 23)");
    expect(contrast(colors.title, colors.card)).toBeGreaterThanOrEqual(4.5);
    const effectiveRefresh = `rgb(${colors.refresh.match(/\d+/g)!.slice(0, 3).map((channel, index) =>
      Math.round(Number(channel) * colors.refreshOpacity + Number(colors.page.match(/\d+/g)![index]) * (1 - colors.refreshOpacity))).join(", ")})`;
    expect(contrast(effectiveRefresh, colors.page)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await context.close();
  }
});
