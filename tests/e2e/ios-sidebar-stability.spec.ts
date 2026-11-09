import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { expectSameGeometry, measureNav, sidebarRoutes } from "./sidebar-measure";

for (const width of [820, 390]) {
  for (const theme of ["light", "dark", "system"] as const) {
    test(`${width}px ${theme} navigation keeps icon positions across routes`, async ({ browser }) => {
      test.setTimeout(300_000);
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        userAgent: width === 820 ? "Track3 iPad" : "Track3 iPhone",
        hasTouch: true, isMobile: true, reducedMotion: "reduce",
        colorScheme: theme === "dark" ? "dark" : "light",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page, { richPortfolio: true });
        await page.goto("/#/overview");
        const nav = page.locator(width === 820 ? ".mobile-sidebar" : ".mobile-tab-bar");
        await expect(nav).toBeVisible();
        const resolved = theme === "dark" ? "dark" : "light";
        await expect(page.locator("html")).toHaveClass(new RegExp(resolved));
        mkdirSync("/tmp/track3-sidebar", { recursive: true });
        for (const expanded of width === 820 ? [false, true] : [false]) {
          if (width === 820) {
            const collapsed = await nav.getAttribute("data-collapsed") === "true";
            if (collapsed === expanded) await nav.getByRole("button", { name: collapsed ? "Expand sidebar" : "Collapse sidebar" }).click();
            await expect(nav).toHaveAttribute("data-collapsed", String(!expanded));
          }
          let reference: Awaited<ReturnType<typeof measureNav>> | undefined;
          for (const route of sidebarRoutes) {
            await page.evaluate((path) => { window.location.hash = `#/${path}`; }, route);
            const active = nav.locator(".t3-nav-item[aria-current='page']");
            await expect(active, route).toHaveCount(1);
            const target = width === 820
              ? route.startsWith("coins/") ? "overview" : route.split("/")[0]
              : route === "history" ? "history"
                : route === "overview" || route.startsWith("coins/") ? "overview"
                  : ["summary", "wallets", "comparison", "cost-basis"].includes(route) ? "summary" : "more";
            await expect(active, route).toHaveAttribute("href", `#/${target}`);
            const state = await measureNav(nav, width === 820 ? "ipad" : "phone");
            expect(state.activeBackground).toBe(state.token);
            expect(state.radius).toBe("8px");
            expect(state.bar).toEqual([3, 20, width === 820 ? 0 : state.activeX]);
            expect(state.activeContrast).toBeGreaterThanOrEqual(4.5);
            expect(state.inactiveContrast).toBeGreaterThanOrEqual(3);
            if (width === 820) {
              expect(state.tile[1]).toBe(expanded ? 36 : 40);
              if (!expanded) expect(state.tile[0]).toBe(40);
            }
            if (resolved === "light") {
              expect(state.railBackground).not.toBe("rgb(13, 13, 14)");
              expect(state.borderColor).not.toBe("rgb(255, 255, 255)");
            } else expect(state.railBackground).toBe("rgb(13, 13, 14)");
            if (reference) expectSameGeometry(state, reference, `${width} ${theme} ${expanded} ${route}`);
            else reference = state;
            if (route === "summary" && theme !== "system") {
              await page.screenshot({ path: `/tmp/track3-sidebar/${width}-${theme}-${expanded ? "expanded" : "collapsed"}.png` });
            }
          }
        }
      } finally {
        await context.close();
      }
    });
  }
}

for (const width of [820, 390]) {
  test(`${width}px system rail repaints with OS appearance without a reload`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      userAgent: width === 820 ? "Track3 iPad" : "Track3 iPhone",
      hasTouch: true, isMobile: true, colorScheme: "dark",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      const nav = page.locator(width === 820 ? ".mobile-sidebar" : ".mobile-tab-bar");
      await expect(nav).toHaveCSS("background-color", "rgb(13, 13, 14)");
      await page.emulateMedia({ colorScheme: "light" });
      await expect(nav).not.toHaveCSS("background-color", "rgb(13, 13, 14)");
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(nav).toHaveCSS("background-color", "rgb(13, 13, 14)");
    } finally {
      await context.close();
    }
  });
}
