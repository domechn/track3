import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { contrast } from "./overlay-theme-scenes";

test.use({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: false, hasTouch: true, reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
});

for (const theme of ["light", "dark"] as const) {
  test(`phone refresh progress stays readable in ${theme} mode`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(page, { slowRefreshPersist: true });
    await page.goto("/#/overview");
    await page.locator(".fd-overview-refresh, .fd-partial-refresh").click();
    await page.getByRole("button", { name: "Source status" }).click();
    const sheet = page.getByRole("alertdialog", { name: "Source status" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".fd-refresh-progress-row").first()).toBeVisible();
    const parts = await sheet.locator(".fd-refresh-progress-head>p, .fd-refresh-progress-row small, .fd-refresh-progress-row > span")
      .evaluateAll((elements) => elements.map((element) => {
        let surface: Element | null = element;
        while (surface && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
        const probe = document.createElement("span");
        probe.style.backgroundColor = "hsl(var(--popover))";
        element.append(probe);
        const fallback = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          text: getComputedStyle(element).color,
          background: surface ? getComputedStyle(surface).backgroundColor : fallback,
        };
      }));
    expect(parts.length).toBeGreaterThan(0);
    for (const { text, background } of parts)
      expect(contrast(text, background), JSON.stringify({ text, background })).toBeGreaterThanOrEqual(4.5);
    mkdirSync("/tmp/track3-overlay-theme", { recursive: true });
    await page.screenshot({ path: `/tmp/track3-overlay-theme/phone-${theme}-refresh-progress.png`, animations: "disabled" });
  });
}
