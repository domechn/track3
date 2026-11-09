import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

const sources = Array.from({ length: 16 }, (_, index) => `Source ${String(index + 1).padStart(2, "0")}`);
const coins = Array.from({ length: 47 }, (_, index) => `COIN${String(index + 1).padStart(2, "0")}`);

async function seedRealScale(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript((labels) => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-cost-basis-settings", JSON.stringify({
      from: "2026-01-01", to: "2026-12-31", holdingPeriodDays: 365,
    }));
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(labels.map((label, index) => ({
      sourceId: `source:${index}`, label, kind: "wallet", provider: "wallet", status: "ok",
      finishedAt: "2026-10-31T09:41:00.000Z", lastSuccessAt: "2026-10-31T09:41:00.000Z",
    }))));
  }, sources);
  await installTauriBridge(page);
  await page.goto("/");
  const assets = [0, 1].flatMap((snap) => coins.map((symbol, index) => [
    snap ? "scale-latest" : "scale-base",
    snap ? "2026-10-31T09:41:00.000Z" : "2026-09-01T09:41:00.000Z",
    sources[index % sources.length], "crypto", symbol, 10000, snap ? 20000 : 19000, snap ? 2 : 1.9,
  ]));
  const transactions = [
    ...Array.from({ length: 493 }, (_, index) => [
      `scale-buy-${index}`, 1, "crypto", sources[index % sources.length], coins[index % coins.length],
      1000, 1, "buy", "2025-01-01T12:00:00.000Z",
    ]),
    ...Array.from({ length: 1676 }, (_, index) => [
      `scale-sell-${index}`, 1, "crypto", sources[index % sources.length], coins[index % coins.length],
      0.1, 2, "sell", "2026-06-01T12:00:00.000Z",
    ]),
    ...Array.from({ length: 40 }, (_, index) => [
      `scale-gap-${index}`, 1, "crypto", sources[index % sources.length], `GAP${index}`,
      1, 2, "sell", "2026-06-01T12:00:00.000Z",
    ]),
  ];
  await page.evaluate(async ({ assets, transactions }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "DELETE FROM transactions", values: [] });
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2", values: [] });
    for (const [table, columns, rows] of [
      ["assets_v2", ["uuid", "createdAt", "wallet", "asset_type", "symbol", "amount", "value", "price"], assets],
      ["transactions", ["uuid", "assetID", "asset_type", "wallet", "symbol", "amount", "price", "txnType", "txnCreatedAt"], transactions],
    ] as const) {
      for (let start = 0; start < rows.length; start += 80) {
        const part = rows.slice(start, start + 80);
        const query = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${part.map(() =>
          `(${columns.map(() => "?").join(",")})`).join(",")}`;
        await invoke("plugin:sql|execute", { query, values: part.flat() });
      }
    }
  }, { assets, transactions });
}

async function checkScrollableCard(page: Page, selector: string, title: string, height: number) {
  const card = page.locator(selector);
  const body = card.getByRole("region", { name: title });
  await expect(body).toHaveAttribute("tabindex", "0");
  const before = await card.evaluate((node) => node.querySelector("h2, h3")!.getBoundingClientRect().top);
  const size = await card.boundingBox();
  expect(Math.abs(size!.height - height)).toBeLessThanOrEqual(1);
  const scrolled = await body.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return { top: node.scrollTop, range: node.scrollHeight - node.clientHeight, horizontal: node.scrollWidth - node.clientWidth };
  });
  expect(scrolled.range).toBeGreaterThan(0);
  expect(scrolled.top).toBeGreaterThan(0);
  expect(scrolled.horizontal).toBeLessThanOrEqual(1);
  expect(await card.evaluate((node) => node.querySelector("h2, h3")!.getBoundingClientRect().top)).toBeCloseTo(before, 0);
}

async function checkPager(page: Page, selector: string, rows: string, count: number) {
  const card = page.locator(selector);
  await expect(card.locator(rows)).toHaveCount(count);
  const cardBox = (await card.boundingBox())!;
  const pagerBox = (await card.locator(":scope > .fidelity-pager").boundingBox())!;
  expect(pagerBox.y).toBeGreaterThanOrEqual(cardBox.y);
  expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
}

test("desktop cards stay aligned and page real scale records at both requested sizes", async ({ page }) => {
  test.setTimeout(180_000);
  await seedRealScale(page);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/#/cost-basis");
    await expect(page.getByTestId("cost-desktop-table")).toBeVisible({ timeout: 60_000 });
    const height = Math.min(460, Math.max(320, viewport.height * 0.42));
    await checkScrollableCard(page, ".fidelity-cost-chart", "Realized P&L by asset", height);
    await checkScrollableCard(page, ".fidelity-cost-averages", "Avg. buy/sell price (selected range)", height);
    await expect(page.locator(".fidelity-cost-averages thead th").first()).toHaveCSS("position", "sticky");
    const chart = (await page.locator(".fidelity-cost-chart").boundingBox())!;
    const averages = (await page.locator(".fidelity-cost-averages").boundingBox())!;
    expect(Math.abs(chart.y - averages.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(chart.y + chart.height - averages.y - averages.height)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("cost-desktop-table")).toContainText("Dispositions 1676");
    await expect(page.getByTestId("cost-desktop-table")).toContainText("Open lots 493");
    await checkPager(page, ".fidelity-cost-table", "tbody tr:not(.fidelity-subtotal):not(.fidelity-total)", 10);
    await checkPager(page, ".fidelity-cost-gaps", "tbody tr:not(.fidelity-gap-group)", 8);
    const tableBefore = (await page.locator(".fidelity-cost-table").boundingBox())!;
    await page.getByRole("button", { name: /^Dispositions 1676$/ }).click();
    await page.getByRole("button", { name: "Next page of Realized disposals" }).click();
    await checkPager(page, ".fidelity-cost-table", "tbody tr:not(.fidelity-subtotal):not(.fidelity-total)", 10);
    expect((await page.locator(".fidelity-cost-table").boundingBox())!.height).toBeCloseTo(tableBefore.height, 0);
    await page.getByRole("button", { name: /^Open lots 493$/ }).click();
    await checkPager(page, ".fidelity-cost-table", "tbody tr:not(.fidelity-subtotal):not(.fidelity-total)", 10);
    await page.locator(".fidelity-cost-chart").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/fixed-height-cost-desktop-${viewport.width}.png`, fullPage: true });
  }
  await page.goto("/#/wallets");
  await expect(page.locator(".t3-wallet-status-list > div")).toHaveCount(16, { timeout: 30_000 });
  await checkScrollableCard(page, ".t3-wallet-side", "Source status", 378);
  const balances = (await page.locator(".t3-wallet-balances").boundingBox())!;
  const status = (await page.locator(".t3-wallet-side").boundingBox())!;
  expect(Math.abs(balances.y - status.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(balances.y + balances.height - status.y - status.height)).toBeLessThanOrEqual(1);
  await page.locator(".t3-wallet-side").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/fixed-height-wallets-desktop.png", fullPage: true });
});

test("phone cards scroll within 60vh and show eight lots and six gaps", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await seedRealScale(page);
    await page.goto("/#/cost-basis");
    await expect(page.locator(".fidelity-cost-lots .fidelity-lot-row")).toHaveCount(8, { timeout: 60_000 });
    await checkScrollableCard(page, ".fidelity-cost-by-asset", "Realized P&L by asset", 844 * 0.6);
    await checkScrollableCard(page, ".fidelity-cost-prices", "Avg. buy/sell price (selected range)", 844 * 0.6);
    await expect(page.locator(".fidelity-cost-gaps thead th").first()).toHaveCSS("position", "sticky");
    await checkPager(page, ".fidelity-cost-lots", ".fidelity-lot-row", 8);
    await checkPager(page, ".fidelity-cost-gaps", "tbody tr", 6);
    await page.locator(".fidelity-cost-by-asset").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/fixed-height-cost-phone.png", fullPage: true });
    await page.goto("/#/wallets");
    await expect(page.locator(".fd-wallet-status-row")).toHaveCount(16, { timeout: 30_000 });
    await checkScrollableCard(page, ".fd-wallet-status", "Source status", 844 * 0.6);
    await page.locator(".fd-wallet-status").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/fixed-height-wallets-phone.png", fullPage: true });
  } finally {
    await context.close();
  }
});
