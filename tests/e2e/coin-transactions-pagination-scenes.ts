import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge as installDesktop } from "./fidelity-desktop-scenes";
import { installTauriBridge as installPhone } from "./fidelity-scenes";

export function coinTransactionPaginationTests() {
  for (const theme of ["dark", "light"] as const) {
  test(`coin transactions page at ${theme} theme`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    if (mobile) await installPhone(page, { fidelitySample: "full" });
    else await installDesktop(page, { fidelityDesktop: "full" });
    await page.evaluate(async () => {
      const [base] = await (window as any).__e2eInvoke("plugin:sql|select", {
        query: "SELECT COUNT(*) AS count FROM transactions WHERE symbol = 'BTC'", values: [],
      }) as { count: number }[];
      return (window as any).__e2eInvoke("plugin:sql|execute", {
      query: `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < ${312 - base.count})
        INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        SELECT a.uuid, a.id, 'crypto', a.wallet, 'BTC', n, 100, 'buy',
          strftime('%Y-%m-%dT%H:%M:%fZ', '2026-10-31T09:00:00', '-' || n || ' minutes')
        FROM seq CROSS JOIN (SELECT * FROM assets_v2 WHERE symbol = 'BTC' LIMIT 1) a`,
      values: [],
    }); });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/#/coins/BTC");
    const card = page.locator(mobile ? ".fd-coin-transactions" : ".coin-fidelity-transactions");
    const rows = card.locator(mobile ? ".fd-tx-row" : "tbody tr");
    await expect(rows).toHaveCount(mobile ? 15 : 25, { timeout: 30_000 });
    await expect(card).toContainText(mobile ? "Showing 1-15 of 312" : "Showing 1-25 of 312");
    if (!mobile) {
      const ruleColors = await card.evaluate((element) => ({
        header: getComputedStyle(element.querySelector("th")!).borderBottomColor,
        body: getComputedStyle(element.querySelector("td")!).borderBottomColor,
      }));
      expect(ruleColors.header).toBe(ruleColors.body);
      const scrollArea = card.locator(".coin-fidelity-transaction-scroll");
      await scrollArea.evaluate((element) => { element.scrollTop = 300; });
      expect(Math.abs((await card.locator("thead").boundingBox())!.y - (await scrollArea.boundingBox())!.y)).toBeLessThan(2);
    }
    const first = await rows.first().textContent();
    const height = (await card.boundingBox())!.height;
    if (mobile) expect((await card.getByRole("button", { name: "Next" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const output = "/tmp/coin-transactions-pagination";
    mkdirSync(output, { recursive: true });
    await card.screenshot({ path: `${output}/${testInfo.project.name}-${theme}-page1.png` });
    await card.locator("nav").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${testInfo.project.name}-${theme}-footer1.png` });
    await card.getByRole("button", { name: "Next" }).click();
    await expect(card).toContainText(mobile ? "Showing 16-30 of 312" : "Showing 26-50 of 312");
    if (!mobile) {
      const scrollArea = card.locator(".coin-fidelity-transaction-scroll");
      await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(rows.first()).toBeInViewport();
      await expect(rows.first().locator("td").nth(2)).toHaveText("26.0000");
    }
    expect(await rows.first().textContent()).not.toBe(first);
    expect((await card.boundingBox())!.height).toBe(height);
    const cardOffset = await card.evaluate((element) => element.getBoundingClientRect().top
      - document.getElementById("app-main-content")!.getBoundingClientRect().top);
    expect(Math.abs(cardOffset)).toBeLessThan(65);
    await card.screenshot({ path: `${output}/${testInfo.project.name}-${theme}-page2.png` });
    await card.locator("nav").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${testInfo.project.name}-${theme}-footer2.png` });
    const pageSize = card.getByRole("combobox", { name: "Rows per page" });
    await pageSize.selectOption("50");
    await expect(rows).toHaveCount(50);
    await expect(card).toContainText("Showing 1-50 of 312");
    await pageSize.selectOption(mobile ? "15" : "25");
    await expect(rows).toHaveCount(mobile ? 15 : 25);
    await card.getByRole("button", { name: "Last" }).click();
    await expect(rows).toHaveCount(12);
    await expect(card).toContainText("Showing 301-312 of 312");
    expect((await card.boundingBox())!.height).toBe(height);
    await card.screenshot({ path: `${output}/${testInfo.project.name}-${theme}-last.png` });
    if (mobile) {
      await page.setViewportSize({ width: 768, height: 1024 });
      const ipad = page.locator(".coin-ipad-transactions");
      await expect(ipad.locator(".mobile-list-row")).toHaveCount(25, { timeout: 30_000 });
      await expect(ipad).toContainText("Showing 1-25 of 301");
      await ipad.getByRole("button", { name: "Next" }).click();
      await expect(ipad).toContainText("Showing 26-50 of 301");
      const ipadHeight = (await ipad.boundingBox())!.height;
      await ipad.getByRole("button", { name: "Last" }).click();
      await expect(ipad).toContainText("Showing 301-301 of 301");
      expect((await ipad.boundingBox())!.height).toBe(ipadHeight);
      await ipad.getByRole("button", { name: "First" }).click();
      await ipad.getByRole("button", { name: "Next" }).click();
      await ipad.locator("nav").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/ipad-${theme}-footer2.png` });
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(ipad.locator(".mobile-list-row")).toHaveCount(25);
      await expect(ipad).toContainText("Showing 26-50 of 301");
      await ipad.locator("nav").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/ipad-wide-${theme}-footer2.png` });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.goto("/#/coins/ETH");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ETH", { timeout: 30_000 });
    await page.goto("/#/coins/BTC");
    await expect(card).toContainText(mobile ? "Showing 1-15 of 312" : "Showing 1-25 of 312", { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
  }
}
