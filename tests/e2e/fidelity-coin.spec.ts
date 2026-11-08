import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== "mobile"); });

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("Chinese coin and edit copy uses whole translated phrases", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
    await installTauriBridge(page, { fidelitySample: "NOVA" });
    await page.goto("/#/coins/NOVA");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-coin-primary small")).toContainText(/由您设置$/);
    await expect(page.locator(".fd-position-grid .fd-warning")).toHaveText("仅已定价买入：4,000 / 12,000");
    await expect(page.locator(".fd-coin-head nav button:nth-of-type(2)")).toHaveText("币种");
    await page.locator(".fd-tx-row").nth(1).click();
    await page.getByRole("button", { name: "编辑类型或价格" }).click();
    await expect(page.locator(".fd-price-input span")).toHaveText("每 NOVA 计价（USD）");
    await expect(page.locator(".fd-sheet.edit h3")).toHaveText("资产：NOVA");
  } finally { await context.close(); }
});

for (const symbol of ["BTC", "NVDA", "NOVA"] as const) {
  test(`coin ${symbol} shows the approved detail sections and captures at 390px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: phone,
      isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
      await installTauriBridge(page, { fidelitySample: symbol });
      await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
        { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [] }));
      await page.goto(`/#/coins/${symbol}${symbol === "NVDA" ? "?assetType=stock" : ""}`);
      await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
      await expect(page.locator(".fd-coin")).toHaveAttribute("data-asset-type", symbol === "NVDA" ? "stock" : "crypto");
      if (symbol === "NOVA") await expect(page.locator(".fd-coin")).toHaveAttribute("data-manual", "true");
      await expect(page.getByText("Position", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Holdings by source", { exact: true })).toBeVisible();
      await expect(page.getByText("Open lots", { exact: true })).toBeVisible();
      await expect(page.getByText("Transactions", { exact: true })).toBeVisible();
      await expect(page.locator(".fd-position-grid .fd-info-button")).toHaveCount(2);
      await expect(page.locator(".fd-position-grid .fd-coin-metric").nth(1).locator(".fd-info-button")).toHaveAttribute("aria-description", /Holdings at the start/);
      await expect(page.locator(".mobile-tab-badge")).toHaveText("2");
      const heroHeight = (await page.locator(".fd-coin-hero").boundingBox())!.height;
      expect(await page.locator(".fd-cost-link").evaluate((node) =>
        node.getBoundingClientRect().y + parseFloat(getComputedStyle(node, "::before").top))).toBe(94.3125);
      expect(heroHeight).toBe(symbol === "NOVA" ? 600 : 586);
      if (symbol === "NOVA") {
        expect(Math.round((await page.locator(".fd-position-grid").boundingBox())!.y)).toBe(449);
        expect(Math.round((await page.locator(".fd-position-grid>.fd-coin-metric").nth(2).boundingBox())!.y)).toBe(579);
        expect(Math.round((await page.locator(".fd-position-grid>.fd-coin-metric").nth(4).boundingBox())!.y)).toBe(673);
        expect(Math.round((await page.locator(".fd-coin-trend").boundingBox())!.height)).toBe(380);
        expect(Math.round((await page.locator(".fd-coin-trend > .fd-outline-pill").boundingBox())!.y)).toBe(1089);
        expect(Math.round((await page.locator(".fd-coin-trend > .fd-outline-pill").boundingBox())!.width)).toBe(136);
        await expect(page.locator(".fd-coin-trend > .fd-outline-pill")).toHaveCSS("color", "rgb(155, 157, 163)");
        await expect(page.locator(".fd-coin-trend > .fd-outline-pill")).toHaveCSS("font-weight", "500");
      }
      if (symbol !== "NOVA") {
        const stats = await page.locator(".fd-coin-stats .fd-coin-metric").evaluateAll((metrics) =>
          metrics.map((metric) => metric.getBoundingClientRect().top));
        if (symbol === "BTC") expect(Math.max(...stats) - Math.min(...stats)).toBeGreaterThan(1);
        else expect(Math.max(...stats) - Math.min(...stats)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.getElementById("app-main-content")!.scrollHeight)).toBe(symbol === "BTC" ? 2578 : 1964);
      }
      const captureOutput = process.env.WUI18_CAPTURE_DIR ?? `/tmp/fidelity/coin-${symbol.toLowerCase()}`;
      mkdirSync(captureOutput, { recursive: true });
      writeFileSync(`${captureOutput}/geometry.json`, JSON.stringify(await page.evaluate(() => ({
        cards: [...document.querySelectorAll(".fd-coin>.fd-card,.fd-coin-detail-grid .fd-card")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { y: rect.y, height: rect.height, width: rect.width };
        }),
        inner: [...document.querySelectorAll(".fd-coin-primary,.fd-coin-changes,.fd-position,.fd-position-grid,.fd-coin-trend .fd-empty,.fd-coin-trend .fd-card-heading,.fd-coin-chart,.fd-coin-lots,.fd-lot-row,.fd-tx-list")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { className: element.className, y: rect.y, height: rect.height };
        }),
        metrics: [...document.querySelectorAll(".fd-position-grid>.fd-coin-metric")].map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent, y: rect.y, height: rect.height };
        }),
        height: document.getElementById("app-main-content")!.scrollHeight,
      })), null, 2));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${captureOutput}/coin-${symbol.toLowerCase()}-phone-long.png`, fullPage: true });
      await page.screenshot({ path: `${captureOutput}/coin-${symbol.toLowerCase()}-phone.png` });
      if (symbol !== "NOVA") {
        const valueCard = page.locator(".fd-coin-trend");
        await valueCard.evaluate((node) => document.getElementById("app-main-content")!.scrollTo(
          0, node.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await valueCard.screenshot({ path: `${captureOutput}/coin-${symbol.toLowerCase()}-value-card.png` });
      }
      if (symbol === "BTC") {
        await expect(page.locator(".fd-coin-head h1")).toContainText("Bitcoin BTC");
        await expect(page.locator(".fd-coin-head p")).toHaveText("Held on Binance and a Ledger cold wallet");
        await expect(page.locator(".fd-coin-primary .fd-label")).toHaveText("Bitcoin price");
        await expect(page.locator(".fd-source-row").first()).toContainText("Ledger cold wallet");
        await expect(page.locator(".fd-coin-changes")).toContainText("+7.32%");
        await expect(page.locator(".fd-coin-stats")).toContainText("Since 1 Oct");
        await expect(page.locator(".fd-position-grid .fd-coin-metric").nth(1)).toContainText("$53,647.29");
        await expect(page.locator(".fd-position-grid .fd-coin-metric").nth(2)).toContainText("$71,000.00");
        await expect(page.locator(".fd-tx-row").nth(3)).toContainText("← Binance");
        await page.getByRole("button", { name: "Price", exact: true }).click();
        await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
        await expect(page.locator("#app-top-bar")).toBeHidden();
        await page.screenshot({ path: `${captureOutput}/coin-btc-price-phone.png` });
        const priceCard = page.locator(".fd-coin-trend");
        expect(Math.round((await priceCard.boundingBox())!.height)).toBe(378);
        expect(Math.round((await page.locator(".fd-coin-chart").boundingBox())!.y)).toBe(820);
        expect(Math.round((await page.locator(".fd-coin-stats").boundingBox())!.y)).toBe(1034);
        expect(Math.round((await page.locator(".fd-coin-chart text").filter({ hasText: "24 Oct" }).boundingBox())!.y)).toBe(1001);
        writeFileSync(`${captureOutput}/price-card-geometry.json`, JSON.stringify(await page.evaluate(() =>
          Object.fromEntries([".fd-coin-trend", ".fd-coin-trend .fd-card-heading", ".fd-coin-trend .fd-sub", ".fd-coin-chart", ".fd-coin-stats"].map((selector) => {
            const element = document.querySelector(selector)!;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return [selector, { y: rect.y, height: rect.height, margin: style.margin, padding: style.padding }];
          }))), null, 2));
        await priceCard.evaluate((node) => document.getElementById("app-main-content")!.scrollTo(0, node.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await priceCard.screenshot({ path: `${captureOutput}/coin-btc-price-card.png` });
        await page.getByRole("button", { name: "Value", exact: true }).click();
        await page.locator(".fd-tx-row").nth(1).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog")).toContainText("Quantity");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.locator(".fd-tx-row").nth(1)).toBeFocused();
        await page.locator(".fd-tx-row").nth(1).click();
        await page.screenshot({ path: `${captureOutput}/coin-btc-sheet-phone.png` });
        await expect(page.locator(".fd-sheet.detail .mobile-sheet-heading h2")).toHaveCSS("text-transform", "capitalize");
        await expect(page.locator(".fd-detail-list>div:first-child strong")).toHaveCSS("background-color", "rgb(33, 32, 35)");
        writeFileSync(`${captureOutput}/sheet-geometry.json`, JSON.stringify(await page.evaluate(() =>
          Object.fromEntries([".fd-sheet", ".mobile-sheet-handle-area", ".mobile-sheet-heading", ".mobile-sheet-heading h2", ".mobile-sheet-body", ".fd-detail-list", ".fd-sheet.detail .fd-primary-pill", ".fd-sheet.detail .fd-outline-pill"].map((selector) => {
            const element = document.querySelector(selector);
            const rect = element?.getBoundingClientRect();
            const style = element ? getComputedStyle(element) : null;
            return [selector, rect && style ? { y: rect.y, height: rect.height, padding: style.padding, margin: style.margin } : null];
          }))), null, 2));
        expect(Math.round((await page.locator(".fd-sheet.detail .fd-detail-list").boundingBox())!.y)).toBe(386);
        expect(Math.round((await page.locator(".fd-sheet.detail .fd-primary-pill").boundingBox())!.y)).toBe(718);
        expect(Math.round((await page.locator(".fd-sheet.detail .mobile-sheet-heading h2").boundingBox())!.x)).toBe(24);
        await page.locator(".fd-sheet.detail .fd-outline-pill").click();
        await page.locator(".fd-tx-row").nth(2).click();
        await page.getByRole("button", { name: "Edit type or price" }).click();
        await page.screenshot({ path: `${captureOutput}/coin-btc-edit-phone.png` });
        writeFileSync(`${captureOutput}/edit-geometry.json`, JSON.stringify(await page.evaluate(() =>
          ({ labels: [...document.querySelectorAll(".fd-sheet.edit .fd-edit-label")].map(node => ({ text: node.textContent, y: node.getBoundingClientRect().y })),
            ...Object.fromEntries([".fd-sheet.edit .fd-sheet-content>p", ".fd-sheet.edit .fd-edit-summary",
            ".fd-sheet.edit .fd-edit-label", ".fd-sheet.edit .fd-edit-footer"].map((selector) => {
            const element = document.querySelector(selector)!;
            const rect = element.getBoundingClientRect();
            return [selector, { y: rect.y, height: rect.height }];
          })) })), null, 2));
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-edit-summary").boundingBox())!.y)).toBe(407);
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-sheet-actions").boundingBox())!.y)).toBe(715);
      }
      if (symbol === "NVDA") {
        await expect(page.locator(".fd-coin-head")).toContainText("Interactive Brokers");
        await expect(page.locator(".fd-coin-head p")).toContainText("NVIDIA");
        await page.locator(".fd-coin-trend").getByRole("button", { name: "7D" }).click();
        const labels = await page.locator(".fd-coin-chart g text").allTextContents();
        expect(new Set(labels).size).toBe(labels.length);
      }
      if (symbol === "NOVA") {
        await expect(page.locator(".fd-coin-head h1")).toContainText("Nova NOVA");
        await expect(page.locator(".fd-coin-head")).toContainText("0x4f…a91c");
        await expect(page.locator(".fd-tx-row").filter({ hasText: "30 Sep 2026" })).toContainText("Edited");
        await page.locator(".fd-tx-row").nth(1).click();
        await page.getByRole("button", { name: "Edit type or price" }).click();
        await page.locator(".fd-edit-types").getByRole("button", { name: "deposit" }).click();
        await page.locator(".fd-edit-types").getByRole("button", { name: "buy" }).click();
        await page.locator("#fd-edit-price").fill("0.3600");
        await page.screenshot({ path: `${captureOutput}/coin-nova-edit-phone.png` });
        writeFileSync(`${captureOutput}/edit-geometry.json`, JSON.stringify(await page.evaluate(() =>
          ({ labels: [...document.querySelectorAll(".fd-sheet.edit .fd-edit-label")].map(node => ({ text: node.textContent, y: node.getBoundingClientRect().y })),
            ...Object.fromEntries([".fd-sheet.edit .fd-sheet-content>p", ".fd-sheet.edit .fd-edit-summary",
            ".fd-sheet.edit .fd-info-banner", ".fd-sheet.edit .fd-edit-label",
            ".fd-sheet.edit .fd-edit-footer"].map((selector) => {
            const element = document.querySelector(selector)!;
            const rect = element.getBoundingClientRect();
            return [selector, { y: rect.y, height: rect.height }];
          })) })), null, 2));
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-edit-summary").boundingBox())!.y)).toBe(142);
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-info-banner").boundingBox())!.y)).toBe(226);
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-sheet-actions").boundingBox())!.y)).toBe(715);
        await expect(page.locator(".fd-info-banner")).toHaveCSS("background-color", "rgb(20, 36, 58)");
        await expect(page.locator(".fd-info-banner")).toHaveCSS("border-top-color", "rgb(31, 58, 92)");
        expect(Math.round((await page.locator(".fd-sheet.edit .fd-edit-label").last().boundingBox())!.y)).toBe(665);
      }
    } finally { await context.close(); }
  });
}

test("coin dates follow the selected Chinese language", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin-transactions .fd-tx-row").first()).toContainText("2026年10月2日");
    await expect(page.locator(".fd-coin-transactions .fd-tx-row").first()).not.toContainText("Oct");
  } finally { await context.close(); }
});

test("coin transaction times use the viewer's local timezone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "Asia/Shanghai" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.locator(".fd-tx-row").filter({ hasText: "0.3500 BTC" }).click();
    await expect(page.getByRole("dialog")).toContainText("9 Jun 2026, 00:03");
  } finally { await context.close(); }
});

test("coin labels cost basis with the saved LIFO method", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (993, 'LIFO')", values: [] }));
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-position")).toContainText("sale, LIFO");
    await page.locator(".fd-tx-row").filter({ hasText: "8 Jun 2026" }).click();
    await expect(page.getByRole("dialog")).toContainText("Realized (LIFO)");
  } finally { await context.close(); }
});

test("edited BTC shows its imported type and resets through the saved edit commands", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const row = page.locator(".fd-tx-row").filter({ hasText: "9 Feb 2026" });
    await expect(row).toContainText("Edited");
    await row.click();
    await expect(page.getByRole("dialog")).toContainText("Edited");
    await page.getByRole("button", { name: "Edit type or price" }).click();
    await expect(page.getByRole("dialog")).toContainText("Imported as deposit");
    await expect(page.getByRole("dialog")).toContainText("Changed from deposit");
    await page.getByRole("button", { name: "Reset to imported" }).click();
    await expect(page.locator(".fd-tx-row").filter({ hasText: "9 Feb 2026" })).toContainText("deposit");
    const record = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|select",
      { query: "SELECT txnType, price FROM transactions WHERE symbol = 'BTC' AND txnCreatedAt LIKE '2026-02-09%'", values: [] }));
    expect(record[0]).toMatchObject({ txnType: "deposit", price: 0 });
  } finally { await context.close(); }
});

test("coin help stays available to touch and breadcrumbs use visible names", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Coins", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cost price help" }).click();
    await expect(page.getByText("Holdings at the start of the range are counted at the market price of the first day.")).toBeVisible();
  } finally { await context.close(); }
});

test("manual price action opens the saved asset in the existing editor", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "NOVA" });
    await page.goto("/#/coins/NOVA");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-manual", "true");
    await page.getByRole("button", { name: "Set current price" }).click();
    await expect(page).toHaveURL(/#\/settings\/configuration\?edit=NOVA$/);
    await expect(page.getByText("Edit custom asset").first()).toBeVisible();
    await expect(page.getByText("Your price", { exact: true })).toBeVisible();
    await page.getByRole("spinbutton", { name: "USD per unit" }).fill("0.5");
    await page.getByRole("dialog", { name: "Edit custom asset" }).getByRole("button", { name: "Save" }).click();
    await expect.poll(() => page.evaluate(async () => {
      const rows = await (window as any).__e2eInvoke("plugin:sql|select",
        { query: "SELECT data FROM configuration WHERE id = 12", values: [] });
      return String(rows[0]?.data).includes("usd: 0.5");
    })).toBe(true);
  } finally { await context.close(); }
});

test("transaction sheet keeps the designed page backdrop and restores the transaction scroll position", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [] }));
    await page.goto("/#/coins/BTC");
    const row = page.locator(".fd-tx-row").first();
    await row.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => document.getElementById("app-main-content")!.scrollTop);
    expect(before).toBeGreaterThan(500);
    await row.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(before);
    await expect(row).toBeFocused();
  } finally { await context.close(); }
});

test("transaction detail respects red-up quote colour", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [] }));
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
    await page.evaluate(() => document.documentElement.setAttribute("data-quote", "red-up"));
    await page.locator(".fd-tx-row").filter({ hasText: "Sell" }).first().click();
    const realized = page.locator(".fd-detail-list").getByText("Realized (FIFO)").locator("..").locator("strong");
    await expect(realized).toHaveAttribute("data-tone", "gain");
    await expect(realized).toHaveCSS("color", "rgb(239, 103, 128)"); // --negative token rounds differently from the old fixed hex.
  } finally { await context.close(); }
});

test("coin data loading hides placeholder holdings and announces progress", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true, fidelitySlowCoin: true });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [] }));
    await page.goto("/#/overview");
    await expect(page.locator("#app-main-content")).toBeVisible();
    await page.evaluate(() => { location.hash = "#/coins/BTC"; });
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "loading");
    await expect(page.locator(".fd-coin")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".fd-coin [role=status]")).toBeVisible();
    await expect(page.locator(".fd-coin")).not.toContainText("0 sources · Not in portfolio total");
  } finally { await context.close(); }
});

test("two exchange sources use grammatical coin description", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "BTC" });
    const [changed] = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
      { query: "UPDATE assets_v2 SET wallet = (SELECT wallet FROM assets_v2 WHERE symbol = 'USDC' LIMIT 1) WHERE symbol = 'BTC' AND ABS(amount - 2.0226) < 0.00001", values: [] }));
    expect(changed).toBeGreaterThan(0);
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin-head p")).toHaveText("Held on Binance and OKX", { timeout: 30_000 });
  } finally { await context.close(); }
});

test("transaction edit retains typed price and saves type and price to the stored coin", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: phone,
    isMobile: true, hasTouch: true, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "BTC" });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
    await page.locator(".fd-tx-row").filter({ hasText: "Sell" }).first().click();
    await page.getByRole("button", { name: "Edit type or price" }).click();
    await page.locator("#fd-edit-price").fill("71,111.50");
    await expect(page.locator("#fd-edit-price")).toHaveValue("71,111.50");
    await page.locator(".fd-edit-types").getByRole("button", { name: "Buy" }).click();
    await page.locator(".fd-sheet.edit").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT asset_type, txnType, price FROM transactions WHERE symbol = 'BTC' AND txnCreatedAt LIKE '2026-06-08%'",
      values: [],
    }));
    expect(saved).toEqual([{ asset_type: "crypto", txnType: "buy", price: 71111.5 }]);
  } finally { await context.close(); }
});
