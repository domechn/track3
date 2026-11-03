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
          const buyTitle = platform === "desktop"
            ? locale === "en" ? "Cost price" : "成本价格"
            : locale === "en" ? "Avg. buy price (selected range)" : "平均买入价（所选时间）";
          const sellTitle = platform === "desktop"
            ? locale === "en" ? "Avg. sell price" : "平均卖出价格"
            : locale === "en" ? "Avg. sell price" : "平均卖出价";
          const buyLabel = platform === "desktop" ? page.locator(".coin-fidelity-metric > span").filter({ hasText: buyTitle }) : page.getByText(buyTitle, { exact: true });
          const sellLabel = platform === "desktop" ? page.locator(".coin-fidelity-metric > span").filter({ hasText: sellTitle }) : page.getByText(sellTitle, { exact: true });
          await expect(buyLabel).toBeVisible({ timeout: 30_000 });
          await expect(sellLabel).toBeVisible({ timeout: 30_000 });
          const sellCard = sellLabel.locator(platform === "desktop" ? ".." : "..");
          await expect(sellCard.locator("strong")).not.toHaveText(/^[—–]$/);
          if (platform === "mobile") {
            await sellCard.scrollIntoViewIfNeeded();
            await sellCard.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-sell-price.png` });
          }
          await page.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-coin.png`, fullPage: true });

          if (platform === "mobile" && theme === "light" && locale === "en") {
            await expect(page.getByText("Breakeven price", { exact: true })).toBeVisible();
            await page.goto("/#/coins/AVAX");
            const emptySellCard = page.getByText(sellTitle, { exact: true }).locator("..");
            await expect(emptySellCard.locator("strong")).toHaveText("–");
            await emptySellCard.screenshot({ path: `${directory}/mobile-no-sales.png` });
          }
          if (platform === "mobile") {
            await page.goto("/#/coins/BTC");
            const costHelp = locale === "en"
              ? "Holdings at the start of the range are counted at the market price of the first day."
              : "区间开始时持有的资产按首日市场价格计入。";
            await expect(page.locator(".fd-position-grid .fd-coin-metric").nth(1).locator(".fd-info-button"))
              .toHaveAttribute("aria-description", costHelp);
            const breakevenHelp = locale === "en"
              ? "Cost price minus realised profit per coin held."
              : "成本价减去每单位当前持仓分摊的已实现利润。";
            await expect(page.locator(".fd-position-grid .fd-coin-metric").nth(3).locator(".fd-info-button"))
              .toHaveAttribute("aria-description", breakevenHelp);
            await expect(page.locator(".fd-position-grid .fd-info-button")).toHaveCount(2);
            await page.goto("/#/coins/USDC");
            await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
            await expect(page.getByText(locale === "en" ? "Return" : "收益率", { exact: true })).toHaveCount(0);
          }

          await page.goto("/#/summary");
          const summary = platform === "desktop"
            ? page.locator(".fidelity-period-card").first()
            : page.locator(".fd-summary .fd-profit-summary");
          await expect(summary).toBeVisible({ timeout: 30_000 });
          if (platform === "desktop") await expect(summary.locator(".fidelity-month-card").first()).toBeVisible();
          else await expect(summary).toContainText(locale === "en" ? "Profit summary" : "盈亏摘要");
          await summary.screenshot({ path: `${directory}/${platform}-${theme}-${locale}-profit-summary.png` });
        } finally {
          await context.close();
        }
      }
    }
  }
});
