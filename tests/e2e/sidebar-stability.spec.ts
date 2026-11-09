import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";
import { expectSameGeometry, measureNav, sidebarRoutes } from "./sidebar-measure";

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });

for (const theme of ["light", "dark", "system"] as const) {
  test(`desktop ${theme} rail keeps every icon, divider and footer fixed across routes`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const rail = page.locator(".t3-desktop-rail");
    await expect(rail).toBeVisible();
    await expect(rail.locator('a[href="#/assistant"]')).toHaveCount(1);
    const resolved = theme === "dark" ? "dark" : "light";
    await expect(page.locator("html")).toHaveClass(new RegExp(resolved));
    mkdirSync("/tmp/track3-sidebar", { recursive: true });
    for (const expanded of [false, true]) {
      if (expanded) await rail.getByRole("button", { name: "Expand sidebar" }).click();
      await expect(rail).toHaveCSS("width", expanded ? "216px" : "56px");
      let reference: Awaited<ReturnType<typeof measureNav>> | undefined;
      for (const route of sidebarRoutes) {
        await page.evaluate((path) => { window.location.hash = `#/${path}`; }, route);
        const active = rail.locator(".t3-nav-item[aria-current='page']");
        await expect(active, route).toHaveCount(1);
        const target = route.startsWith("coins/") ? "overview" : route.split("/")[0];
        await expect(active, route).toHaveAttribute("href", `#/${target}`);
        const state = await measureNav(rail, "desktop");
        expect(state.tile[1]).toBe(expanded ? 36 : 40);
        if (!expanded) expect(state.tile[0]).toBe(40);
        expect(state.radius).toBe("8px");
        expect(state.activeBackground).toBe(state.token);
        expect(state.bar).toEqual([3, 20, 0]);
        expect(state.activeContrast).toBeGreaterThanOrEqual(4.5);
        expect(state.inactiveContrast).toBeGreaterThanOrEqual(3);
        if (resolved === "light") {
          expect(state.railBackground).not.toBe("rgb(13, 13, 14)");
          expect(state.borderColor).not.toBe("rgb(255, 255, 255)");
        } else expect(state.railBackground).toBe("rgb(13, 13, 14)");
        if (reference) expectSameGeometry(state, reference, `${theme} ${expanded} ${route}`);
        else reference = state;
        if (route === "summary" && theme !== "system") {
          await page.screenshot({ path: `/tmp/track3-sidebar/desktop-${theme}-${expanded ? "expanded" : "collapsed"}.png` });
        }
      }
    }
  });
}

test("desktop system rail follows OS appearance without reloading", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  const rail = page.locator(".t3-desktop-rail");
  await expect(rail).toHaveCSS("background-color", "rgb(13, 13, 14)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(rail).not.toHaveCSS("background-color", "rgb(13, 13, 14)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(rail).toHaveCSS("background-color", "rgb(13, 13, 14)");
});

test("Pro item and unread badge leave the other rail icons and footer fixed", async ({ browser }) => {
  const captures: Record<string, Record<string, number[]>> = {};
  for (const pro of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true, checkoutFixture: !pro });
      await page.goto("/#/overview");
      const rail = page.locator(".t3-desktop-rail");
      await expect(rail.locator('a[href="#/assistant"]')).toHaveCount(pro ? 1 : 0);
      const positions = () => rail.evaluate((node) => Object.fromEntries(
        [...node.querySelectorAll("nav a svg, .t3-rail-footer svg, :scope > button:last-child svg")].map((icon) => {
          const link = icon.closest("a");
          const rect = icon.getBoundingClientRect();
          return [link?.getAttribute("href") ?? (icon.closest(".t3-rail-footer") ? "footer" : "collapse"),
            [rect.x, rect.y, rect.width, rect.height]];
        }),
      ));
      for (const expanded of [false, true]) {
        if (expanded) await rail.getByRole("button", { name: "Expand sidebar" }).click();
        const before = await positions();
        if (!expanded) {
          await page.evaluate(async () => (window as typeof window & {
            __e2eInvoke: (command: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
          }).__e2eInvoke("plugin:sql|execute", {
            query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES (?, ?, ?, ?, ?)",
            values: ["price", "BTC alert", "Navigation badge fixture", 1, "2026-10-31T09:41:00.000Z"],
          }));
          await page.reload();
          await expect(rail.locator('a[href="#/goals"]')).toHaveAttribute("aria-label", /unread/);
          await expect(rail.locator('a[href="#/assistant"]')).toHaveCount(pro ? 1 : 0);
        }
        expect(await positions()).toEqual(before);
        captures[`${pro}-${expanded}`] = before;
      }
    } finally {
      await context.close();
    }
  }
  for (const expanded of [false, true]) {
    const withPro = captures[`true-${expanded}`], withoutPro = captures[`false-${expanded}`];
    for (const [key, box] of Object.entries(withoutPro)) expect(withPro[key], key).toEqual(box);
  }
});
