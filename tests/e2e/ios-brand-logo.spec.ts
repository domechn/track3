import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const phoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone About and iPad rail show the two-peak brand in both themes", async ({ browser }) => {
  test.setTimeout(180_000);
  const output = "/tmp/track3-brand-shots";
  mkdirSync(output, { recursive: true });
  for (const theme of ["dark", "light"] as const) {
    for (const device of ["phone", "ipad"] as const) {
      const context = await browser.newContext({
        viewport: device === "phone" ? { width: 390, height: 844 } : { width: 834, height: 1112 },
        userAgent: phoneAgent, isMobile: true, hasTouch: true,
        colorScheme: theme, reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page);
        await page.goto(device === "phone" ? "/#/settings/systemInfo?section=about" : "/#/history");
        if (device === "phone") {
          const brand = page.locator(".fidelity-b-about-brand");
          await expect(brand.locator("polygon")).toHaveCount(2, { timeout: 30_000 });
          await expect(brand.getByText("Track3")).toBeVisible();
          if (theme === "light") await expect(brand.locator("svg")).toHaveCSS("background-color", /^rgb\(/);
        } else {
          const brand = page.getByRole("link", { name: "Track3" });
          await expect(brand.locator("polygon")).toHaveCount(2, { timeout: 30_000 });
          expect((await brand.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await brand.click();
          await expect(page).toHaveURL(/#\/overview$/);
          await expect(page.locator("#app-main-content h1")).toHaveText("Overview", { timeout: 30_000 });
        }
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
        await page.screenshot({ path: `${output}/${device}-${theme}.png` });
      } finally {
        await context.close();
      }
    }
  }
});
