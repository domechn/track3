import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const directory = "test-results/calc-core-review";
const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("coin metrics and Profit Summary remain legible across platforms, themes, and languages", async ({ browser }) => {
  test.setTimeout(240_000);
  mkdirSync(directory, { recursive: true });
  for (const platform of ["desktop", "mobile"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const locale of ["en", "zh"] as const) {
        const context = await browser.newContext({
          viewport: platform === "desktop" ? { width: 1280, height: 900 } : { width: 390, height: 844 },
          ...(platform === "mobile" ? { userAgent: iPhoneUserAgent, isMobile: true, hasTouch: true } : {}),
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        try {
          const page = await context.newPage();
          await page.addInitScript(({ theme, locale }) => {
            localStorage.setItem("track3-ui-theme", theme);
            localStorage.setItem("track3-ui-locale", locale);
          }, { theme, locale });
          await installTauriBridge(page, { richPortfolio: true, zeroCostUSDC: true });

          await page.goto("/#/coins/BTC");
          const buyTitle = locale === "en" ? "Avg. buy price (selected range)" : "所选区间平均买入价";
          const sellTitle = locale === "en" ? "Avg. sell price (selected range)" : "所选区间平均卖出价";
          await expect(page.getByText(buyTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
          await expect(page.getByText(sellTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
          const sellCard = page.getByText(sellTitle, { exact: true }).locator("../..");
          await expect(sellCard.locator(".text-xl")).not.toHaveText("—");
          if (platform === "mobile") {
            await expect(page.getByTestId("coin-page-loading-overlay")).toHaveClass(/opacity-0/);
            await sellCard.scrollIntoViewIfNeeded();
            await sellCard.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-sell-price.png` });
          }
          await page.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-coin.png`, fullPage: true });

          if (platform === "mobile" && theme === "light" && locale === "en") {
            await page.getByRole("button", { name: "Holdings at the start of the range are counted at the market price of the first day." }).tap();
            await expect(page.getByText("Holdings at the start of the range are counted at the market price of the first day.")).toBeVisible();
            await page.keyboard.press("Escape");
            await page.getByRole("button", { name: "Cost price minus realised profit per coin held." }).tap();
            await expect(page.getByText("Cost price minus realised profit per coin held.")).toBeVisible();
            await page.goto("/#/coins/AVAX");
            const emptySellCard = page.getByText(sellTitle, { exact: true }).locator("../..");
            await expect(emptySellCard.locator(".text-xl")).toHaveText("—");
            await emptySellCard.screenshot({ path: `${directory}/mobile-no-sales.png` });
            await page.goto("/#/coins/USDC");
            await expect(page.locator(".coin-metric-card").filter({ hasText: "Return" })).toContainText("∞");
            await page.locator(".coin-metric-card").filter({ hasText: "Return" }).screenshot({ path: `${directory}/mobile-infinite-return.png` });
          }

          await page.goto("/#/summary");
          const summary = platform === "desktop"
            ? page.getByText(locale === "en" ? "Profit Summary" : "盈亏汇总", { exact: true }).locator("../../..")
            : page.locator(".d2-summary .profit-summary-card");
          await expect(summary).toBeVisible({ timeout: 30_000 });
          await expect(summary).toContainText(locale === "en" ? "Periods" : "共");
          await summary.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-profit-summary.png` });
        } finally {
          await context.close();
        }
      }
    }
  }
});
