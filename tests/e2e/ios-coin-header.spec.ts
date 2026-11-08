import { expect, test } from "@playwright/test";
import { installManySourceCoinFixture } from "./ui-bugs-scenes";
import { installTauriBridge } from "./fidelity-scenes";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("phone ellipsizes a long source name and keeps the full tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { fidelitySample: "BTC" });
  await page.evaluate(async () => {
    await (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = REPLACE(data, 'Ledger cold wallet', 'A very long wallet alias') WHERE id = 11",
      values: [],
    });
  });
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  const name = page.locator('.fd-coin-head .coin-source-name[title="A very long wallet alias"]');
  await expect(name).toBeVisible();
  expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
});

for (const symbol of ["NVDA", "NOVA"] as const) test(`${symbol} phone description keeps its first source when two hold it`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTauriBridge(page, { fidelitySample: symbol });
  const [inserted] = await page.evaluate(async (asset) => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      SELECT uuid, createdAt, (SELECT wallet FROM assets_v2 WHERE symbol = 'USDC' LIMIT 1),
        asset_type, symbol, 1, price, price FROM assets_v2 WHERE symbol = ? ORDER BY id DESC LIMIT 1`,
    values: [asset],
  }), symbol);
  expect(inserted).toBe(1);
  await page.goto(`/#/coins/${symbol}${symbol === "NVDA" ? "?assetType=stock" : ""}`);
  await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  const rows = page.locator(".fd-source-row:not(.total) .t3-asset-label-name");
  await expect(rows).toHaveCount(2);
  const summary = page.locator(".fd-coin-head .coin-source-summary");
  await expect(summary.locator(".coin-source-name")).toHaveCount(1);
  await expect(summary.locator(".coin-source-name")).toHaveText(await rows.first().textContent() ?? "");
  await expect(summary.locator(".coin-source-more")).toHaveCount(0);
});

for (const width of [390, 820]) for (const locale of ["en", "zh"] as const) test(`mobile coin header lists 16 readable sources at ${width}px in ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript((language) => localStorage.setItem("track3-ui-locale", language), locale);
  await installManySourceCoinFixture(page);
  await page.goto("/#/coins/BTC");
  if (width === 390) await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  if (width === 820) {
    const coin = page.locator(".analyze-coin");
    await expect(coin).toBeVisible({ timeout: 30_000 });
    const allocation = coin.locator(".analyze-coin-source-list ol");
    await expect(allocation.getByRole("listitem")).toHaveCount(9);
    await expect(allocation.getByRole("listitem").last()).toContainText(locale === "en" ? "Others (+8)" : "其他 (+8)");
    for (const label of await allocation.locator(".analyze-source-list-name").allTextContents())
      expect(label).not.toMatch(/[0-9a-f]{10,}/i);
    return;
  }
  const header = page.locator(".fd-coin-head");
  await expect(header).toBeVisible();
  await expect(header.getByRole("button", { name: /\+13/ })).toBeVisible();
  for (const label of await page.locator(".coin-source-summary, .fd-source-row .t3-asset-label-name").allTextContents())
    expect(label).not.toMatch(/[0-9a-f]{10,}/i);
  const description = (await header.locator("p").boundingBox())!;
  const action = (await header.locator(".fd-cost-link").boundingBox())!;
  expect(description.y + description.height).toBeLessThanOrEqual(action.y);
  await header.getByRole("button", { name: /\+13/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("li")).toHaveCount(16);
  expect(await dialog.textContent()).not.toMatch(/[0-9a-f]{10,}/i);
});
