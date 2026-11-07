import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function seedElevenAssetSummary(page: Page, withBuyTransaction = true) {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.evaluate(async (withBuyTransaction) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await run("DELETE FROM transactions");
    await run("DELETE FROM assets_v2");
    const assets = [
      ["1211.HK", "stock", 5956, 115956, 6328, 1, 19.468770987],
      ["IOTA", "crypto", 3000, 3000, 1000, 1, 1],
      ["EUL", "crypto", 500, 500, 100, 1, 1],
      ["BNB", "crypto", 5000, 5000, 4000, 1, 1],
      ["BTC", "crypto", 10000, 10000, 12000, 1, 1],
      ["ETH", "crypto", 10000, 10000, 11000, 1, 1],
      ["SOL", "crypto", 10000, 10000, 10500, 1, 1],
      ["ADA", "crypto", 1000, 1000, 1050, 1, 1],
      ["USDT", "crypto", 1000, 1000, 1000, 1, 1],
      ["USDC", "crypto", 500, 500, 500, 1, 1],
      ["DAI", "crypto", 300, 300, 300, 1, 1],
    ] as const;
    for (const [symbol, type, start, middle, end, startAmount, endAmount] of assets) {
      for (const [uuid, createdAt, amount, value] of [
        ["top-start", "2026-10-01T09:00:00.000Z", startAmount, start],
        ["top-middle", "2026-10-15T09:00:00.000Z", endAmount, middle],
        ["top-end", "2026-10-30T09:00:00.000Z", endAmount, end],
      ] as const) await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'top-wallet', ?, ?, ?, ?, ?)`, [uuid, createdAt, type, symbol, amount, value, value / amount]);
    }
    if (withBuyTransaction) await run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
      SELECT 'top-middle', id, 'stock', 'top-wallet', '1211.HK', ?, ?, 'buy', '2026-10-15T09:00:00.000Z'
      FROM assets_v2 WHERE uuid = 'top-middle' AND symbol = '1211.HK'`,
    [18.468770987, 5956]);
  }, withBuyTransaction);
}

export async function expectSummaryTopGeometry(page: Page, rowHeight: number) {
  const groups = page.locator(".summary-top-collection .summary-top-list");
  await expect(groups).toHaveCount(3);
  for (const [symbol, percentage] of [
    ["1211.HK", "−94.5%"], ["IOTA", "−66.7%"], ["EUL", "−80.0%"], ["BNB", "−20.0%"],
  ]) await expect(page.locator(".summary-top-row").filter({ has: page.locator(`b:text-is("${symbol}")`) }).locator("small"))
    .toHaveText(percentage);
  const geometry = await groups.evaluateAll((elements) => elements.map((group) => {
    const rows = [...group.querySelectorAll(".summary-top-row")];
    const axis = group.querySelector(".summary-top-axis")!.getBoundingClientRect();
    const zero = parseFloat(getComputedStyle(group).getPropertyValue("--summary-zero")) / 100;
    return {
      axisX: axis.x + axis.width * zero,
      axisHeight: axis.height,
      rows: rows.map((row) => {
        const [ticker, track, amount, percentage] = [...row.children] as HTMLElement[];
        const rowBox = row.getBoundingClientRect();
        const trackBox = track.getBoundingClientRect();
        const barBox = track.querySelector("i")?.getBoundingClientRect();
        const text = [ticker, amount, percentage].map((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const box = range.getBoundingClientRect();
          return { x: box.x, right: box.right, y: box.y, bottom: box.bottom };
        });
        return { height: rowBox.height, right: rowBox.right, track: { x: trackBox.x, right: trackBox.right, width: trackBox.width },
          bar: barBox && { x: barBox.x, right: barBox.right, y: barBox.y, bottom: barBox.bottom, width: barBox.width }, text };
      }),
    };
  }));
  const rows = geometry.flatMap((group) => group.rows);
  expect(rows.length).toBe(11);
  for (const group of geometry) {
    if (group.rows.length) expect(group.axisHeight).toBeCloseTo(group.rows.length * rowHeight, 0);
    expect(group.axisX).toBeCloseTo(geometry[0].axisX, 0);
  }
  for (const row of rows) {
    expect(row.height).toBeCloseTo(rowHeight, 0);
    expect(row.track.width).toBeGreaterThanOrEqual(80);
    expect(row.text[0].right).toBeLessThanOrEqual(row.track.x - 6);
    expect(row.text[1].x).toBeGreaterThanOrEqual(row.track.right + 6);
    expect(row.text[2].x).toBeGreaterThanOrEqual(row.text[1].right + 6);
    expect(row.text[2].right).toBeLessThanOrEqual(row.right + 1);
    if (row.bar) {
      expect(row.bar.width).toBeGreaterThanOrEqual(2);
      expect(row.bar.x).toBeGreaterThanOrEqual(row.track.x + 12 - 1);
      expect(row.bar.right).toBeLessThanOrEqual(row.track.right - 12 + 1);
    }
  }
  const textBoxes = rows.flatMap((row) => row.text);
  for (const bar of rows.flatMap((row) => row.bar ? [row.bar] : []))
    for (const text of textBoxes)
      expect(bar.right <= text.x || bar.x >= text.right || bar.bottom <= text.y || bar.y >= text.bottom).toBe(true);
}
