import { expect, type Page } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { installTauriBridge as installBaseBridge } from "./tauri-bridge";

export async function coinCardContentGaps(page: Page) {
  return page.locator(".coin-fidelity-grid > .coin-fidelity-card").evaluateAll((cards) =>
    cards.map((card) => {
      const content = card.matches(".coin-fidelity-manual-history")
        ? card.querySelector(".coin-fidelity-set-price")
        : card.matches(".coin-fidelity-chart")
          ? card.querySelector(".coin-fidelity-chart-stats")
        : card.querySelector(".coin-fidelity-show-lots, .coin-fidelity-lots .t3-empty-state")
          ?? card.querySelector(".coin-fidelity-lots tbody tr:last-child");
      const style = getComputedStyle(card);
      return card.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth) -
        parseFloat(style.paddingBottom) - content!.getBoundingClientRect().bottom;
    }));
}

export async function assertNoBlankSlabs(page: Page, contentSelector = ".analyze-coin") {
  const problems = await page.locator(contentSelector).evaluate((content) => {
    const contentBounds = content.getBoundingClientRect();
    const cards = [...content.querySelectorAll<HTMLElement>("[data-card], [data-ui-card], .card, .fd-card, .coin-fidelity-card")]
      .filter((node) => getComputedStyle(node).display !== "none")
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const issues: string[] = [];
    if (!cards.length) return ["no cards found in content area"];
    const bounds = {
      left: contentBounds.left,
      top: Math.max(contentBounds.top, Math.min(...cards.map((rect) => rect.top))),
      width: contentBounds.width,
      height: Math.min(contentBounds.bottom, Math.max(...cards.map((rect) => rect.bottom))) -
        Math.max(contentBounds.top, Math.min(...cards.map((rect) => rect.top))),
    };
    for (const axis of ["left", "top", "right", "bottom"] as const) {
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        const difference = Math.abs(cards[i][axis] - cards[j][axis]);
        if (difference > 1 && difference <= 6) issues.push(`${axis} edges differ by ${difference.toFixed(1)}px`);
      }
    }
    const step = 6;
    const columns = Math.ceil(bounds.width / step), rows = Math.ceil(bounds.height / step);
    const filled = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => {
      const px = bounds.left + (x + 0.5) * step, py = bounds.top + (y + 0.5) * step;
      return cards.some((rect) => px >= rect.left && px < rect.right && py >= rect.top && py < rect.bottom);
    }));
    const heights = Array(columns).fill(0) as number[];
    for (let y = 0; y < rows; y++) {
      const stack: number[] = [];
      for (let x = 0; x <= columns; x++) {
        if (x < columns) heights[x] = filled[y][x] ? 0 : heights[x] + 1;
        const current = x < columns ? heights[x] : 0;
        while (stack.length && heights[stack.at(-1)!] > current) {
          const index = stack.pop()!, height = heights[index];
          const left = stack.length ? stack.at(-1)! + 1 : 0;
          const width = x - left;
          if (width * step < 120 || height * step < 120) continue;
          const top = y - height + 1;
          const sides = [
            left === 0 || Array.from({ length: height }, (_, n) => filled[top + n]?.[left - 1]).some(Boolean),
            x === columns || Array.from({ length: height }, (_, n) => filled[top + n]?.[x]).some(Boolean),
            top === 0 || filled[top - 1]?.slice(left, x).some(Boolean),
            y === rows - 1 || filled[y + 1]?.slice(left, x).some(Boolean),
          ].filter(Boolean).length;
          if (sides >= 2) {
            issues.push(`blank ${width * step}x${height * step}px at ${left * step},${top * step}`);
            return issues;
          }
        }
        stack.push(x);
      }
    }
    return issues;
  });
  expect(problems).toEqual([]);
}


export type LayoutFixture = "real" | "small" | "empty";

export async function captureLayoutPage(page: Page, path: string) {
  await page.screenshot({ path, fullPage: true, animations: "disabled", timeout: 30_000 });
  const scroll = await page.locator("#app-main-content").evaluate((main) => {
    let node: Element | null = main;
    let depth = 0;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 16 && /auto|scroll/.test(getComputedStyle(node).overflowY)) {
        const element = node as HTMLElement;
        const previous = element.scrollTop;
        element.scrollTop = element.scrollHeight;
        return { depth, previous };
      }
      node = node.parentElement;
      depth++;
    }
    return null;
  });
  if (!scroll) return;
  try {
    await page.screenshot({ path: path.replace(/\.png$/, "-bottom.png"), animations: "disabled", timeout: 30_000 });
  } finally {
    await page.locator("#app-main-content").evaluate((main, { depth, previous }) => {
      let node = main as HTMLElement;
      for (let index = 0; index < depth; index++) node = node.parentElement!;
      node.scrollTop = previous;
    }, scroll);
  }
}

export async function seedLayoutFixture(page: Page, fixture: LayoutFixture) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  if (fixture === "empty") {
    await installBaseBridge(page, { emptyPortfolio: true });
    return;
  }
  await installTauriBridge(page, { fidelityDesktop: "full" });
  const run = (query: string, values: unknown[] = []) =>
    page.evaluate(({ query, values }) =>
      (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown) => Promise<unknown> })
        .__e2eInvoke("plugin:sql|execute", { query, values }), { query, values });

  if (fixture === "small") {
    await run("DELETE FROM assets_v2 WHERE symbol NOT IN ('BTC', 'ETH') OR wallet != ?", [md5("binance-fidelity-key")]);
    await run("DELETE FROM transactions WHERE symbol NOT IN ('BTC', 'ETH')");
    await run("DELETE FROM configuration WHERE id IN (20)");
    await run("UPDATE configuration SET data = ? WHERE id = 10", [
      "!ent:e2e:exchanges:\n  - name: binance\n    alias: Binance\n    initParams: {apiKey: fidelity-key, secret: fixture}\n",
    ]);
    await run("UPDATE configuration SET data = ? WHERE id = 11", [
      "btc: {addresses: []}\nerc20: {addresses: []}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n",
    ]);
    return;
  }

  const chatTitles = [
    "What drove my gain this week?", "Rebalance plan, 30% BTC", "Explain my 30D P&L",
    "Is my stablecoin share too high?", "Compare 24 Oct with 31 Oct", "Alert ideas for SOL",
    "What changed since 1 Oct?",
  ];
  for (const [index, title] of chatTitles.entries()) {
    const id = `layout-chat-${index}`;
    const updatedAt = new Date(Date.UTC(2026, 9, 31 - index, 9, 40)).toISOString();
    await run("INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, 1, ?)",
      [id, title, updatedAt, updatedAt, "Saved portfolio discussion"]);
    await page.evaluate(({ id, title, updatedAt }) => {
      const text = `!ent:e2e:${JSON.stringify({ version: 1, messages: [{ role: "user", content: title, at: updatedAt }] })}`;
      return (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown, options: unknown) => Promise<unknown> })
        .__e2eInvoke("plugin:fs|write_text_file", [...new TextEncoder().encode(text)],
          { headers: { path: encodeURIComponent(`/e2e/app/ai/sessions/${id}.json.ent`) } });
    }, { id, title, updatedAt });
  }

  const wallets = Array.from({ length: 11 }, (_, index) => ({
    address: `bc1qlayoutauditwallet${String(index + 1).padStart(2, "0")}`,
    alias: `Cold ${index + 1} storage account with a long descriptive source name`,
  }));
  await run("UPDATE configuration SET data = ? WHERE id = 11", [
    `btc:\n  addresses:\n    - {address: bc1q-fidelity-ledger, alias: Ledger cold wallet}\n${wallets.map((wallet) =>
      `    - {address: ${wallet.address}, alias: '${wallet.alias}'}`).join("\n")}\nerc20:\n  addresses:\n    - {address: '0x4fa91c', alias: '0x4f…a91c'}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`,
  ]);
  await run("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2026-10-31T09:41:00.000Z')");
  await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'CNY')");
  const symbols = ["BTC", "ETH", "SOL", "USDT", "USDC", "BNB", "AAPL", "NVDA", "ADA", "DOGE", "TSLA"];
  const newRows: unknown[][] = [];
  const brokerAmounts = new Map<string, number>();
  for (const [index, wallet] of wallets.entries()) {
    for (let offset = 0; offset < 3; offset++) {
      const symbol = symbols[(index * 3 + offset) % symbols.length];
      const price = symbol === "BTC" ? 63842.11 : symbol === "ETH" ? 2497.7 : symbol === "TSLA" ? 260 : 12.34;
      const amount = index + offset + 1;
      if (symbol === "AAPL" || symbol === "NVDA" || symbol === "TSLA") {
        brokerAmounts.set(symbol, (brokerAmounts.get(symbol) ?? 0) + amount);
      } else {
        newRows.push(["fidelity-oct-31", "2026-10-31T09:41:00.000Z", md5(wallet.address),
          "crypto", symbol, amount, amount * price, price]);
      }
    }
  }
  for (const [symbol, amount] of brokerAmounts) {
    const price = symbol === "TSLA" ? 260 : 12.34;
    newRows.push(["fidelity-oct-31", "2026-10-31T09:41:00.000Z", md5("ibkr:fidelity-query"),
      "stock", symbol, amount, amount * price, price]);
  }
  for (const symbol of ["USDC", "BNB"]) {
    newRows.push(["fidelity-oct-31", "2026-10-31T09:41:00.000Z", md5(wallets[0].address),
      "crypto", symbol, 1, 12.34, 12.34]);
  }
  for (const [index, symbol] of ["USDT", "BTC", "BTC", "ETH", "BTC", "BTC"].entries()) {
    const price = symbol === "BTC" ? 63842.11 : symbol === "ETH" ? 2497.7 : 12.34;
    newRows.push(["fidelity-oct-31", "2026-10-31T09:41:00.000Z", md5(wallets[index].address),
      "crypto", symbol, 0.01, 0.01 * price, price]);
  }
  for (const symbol of ["ADA", "DOGE"]) {
    newRows.push(["fidelity-oct-31", "2026-10-31T09:41:00.000Z", md5("binance-fidelity-key"), "crypto",
      symbol, 100, 1234, 12.34]);
  }
  await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ${newRows.map(() =>
    "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    ON CONFLICT(uuid, asset_type, symbol, wallet) DO UPDATE SET
      amount = assets_v2.amount + excluded.amount,
      value = assets_v2.value + excluded.amount * assets_v2.price`, newRows.flat());
  await run(`WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i + 1 FROM n WHERE i < 999)
    INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
    SELECT 'audit-old-' || i, datetime('2024-01-01', '+' || i || ' hours'), ?, 'crypto', 'BTC', 1, 40000 + i, 40000 + i FROM n`,
  [md5("binance-fidelity-key")]);
  await run(`WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i + 1 FROM n WHERE i < 39)
    INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
    SELECT 'audit-lot-' || i, (SELECT id FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' LIMIT 1),
      'crypto', ?, 'BTC', 0.01, 50000 + i, 'buy', datetime('2026-09-01', '+' || i || ' hours') FROM n`,
  [md5("binance-fidelity-key")]);
  const values = await page.evaluate(() =>
    (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown) => Promise<{ symbol: string; value: number }[]> })
      .__e2eInvoke("plugin:sql|select", {
        query: "SELECT symbol, SUM(value) AS value FROM assets_v2 WHERE uuid = 'fidelity-oct-31' GROUP BY symbol ORDER BY value DESC",
        values: [],
      }));
  const total = values.reduce((sum, row) => sum + row.value, 0);
  const btc = values.find((row) => row.symbol === "BTC")!;
  const stablecoins = values.filter((row) => row.symbol === "USDT" || row.symbol === "USDC")
    .reduce((sum, row) => sum + row.value, 0);
  const share = (value: number) => (value / total * 100).toFixed(1);
  const card = {
    snapshotUuid: "fidelity-oct-31", dismissedIds: [],
    insights: [
      { id: "audit-concentration", severity: "info", messageKey: "insights.concentration",
        data: { symbol: "BTC", top1Percent: Number(share(btc.value)),
          top3Percent: Number(share(values.slice(0, 3).reduce((sum, row) => sum + row.value, 0))),
          hhi: Math.round(values.reduce((sum, row) => sum + (row.value / total) ** 2, 0) * 10_000),
          stablecoinPercent: Number(share(stablecoins)) } },
      { id: "audit-stablecoins", severity: "info", messageKey: "insights.stablecoins",
        data: { stablecoinPercent: Number(share(stablecoins)) } },
    ],
    summary: `BTC is the largest holding — ${share(btc.value)}% of the portfolio's current value.\n` +
      `Stablecoins — USDT and USDC together hold ${share(stablecoins)}%.\n` +
      "Portfolio sources — The latest snapshot includes 16 sources.",
    summaryLocale: "en", summarySnapshotUuid: "fidelity-oct-31",
  };
  await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (992, ?)", [`!ent:e2e:${JSON.stringify(card)}`]);
}
