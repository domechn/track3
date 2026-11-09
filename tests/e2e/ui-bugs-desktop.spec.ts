import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { installTauriBridge } from "./tauri-bridge";
import { installManySourceFixture } from "./ui-bugs-scenes";

for (const width of [1440, 1100]) for (const sources of [3, 8, 16, 30]) {
  test(`Wallet matrix keeps ${sources} sources readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installManySourceFixture(page, sources);
    await page.goto("/#/wallets");
    const scroll = page.locator(width >= 1400 ? ".t3-wallet-matrix .t3-wallet-table-scroll" : ".wallet-asset-change-scroll").first();
    const sourceIds = new Set<string>();
    const matrixPager = page.locator(".wallet-asset-change-card [data-layout-pager]");
    const perPage = width >= 1400 ? sources : 4;
    for (let start = 0; start < sources; start += perPage) {
      await expect(scroll.locator("thead th")).toHaveCount(Math.min(perPage, sources - start) + 2);
      for (const id of await scroll.locator("thead th[title]").evaluateAll((cells) =>
        cells.map((cell) => cell.getAttribute("title") ?? ""))) sourceIds.add(id);
      if (width < 1400 && start + perPage < sources) await matrixPager.getByRole("button", { name: "Next" }).click();
    }
    expect(sourceIds.size).toBe(sources);
    await expect(scroll).toHaveAttribute("tabindex", "0");
    const rendered = await page.locator(".analyze-wallets").textContent();
    expect(rendered).not.toMatch(/[0-9a-f]{12,}/i);
    expect(rendered).not.toMatch(/[0-9a-f]{6,}…[0-9a-f]{4,}/i);
    const headers = scroll.locator("thead th");
    expect(await headers.allTextContents()).not.toContainEqual(expect.stringMatching(/[0-9a-f]{12,}/i));
    const firstSourceName = await headers.nth(1).locator(".t3-asset-label-name").textContent();
    await expect(headers.nth(1)).toHaveAttribute("title", /^[0-9a-f]{32}$/i);
    await expect(headers.nth(1)).toHaveAttribute("aria-label", firstSourceName!);
    const boxes = await headers.evaluateAll((cells) => cells.map((cell) => {
      const box = cell.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, position: getComputedStyle(cell).position };
    }));
    for (let index = 1; index < boxes.length - 1; index++) {
      expect(boxes[index].left, `headers ${index - 1} and ${index}`).toBeGreaterThanOrEqual(boxes[index - 1].right - 1);
    }
    expect(boxes.slice(1, -1).every((box) => box.width >= 103)).toBe(true);
    expect(boxes[0].position).toBe("sticky");
    expect(boxes.at(-1)?.position).toBe("sticky");
    if (sources >= 8) {
      const size = await scroll.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
      if (width >= 1400 && sources >= 16) expect(size.scrollWidth).toBeGreaterThan(size.clientWidth + 1);
      if (size.scrollWidth > size.clientWidth + 1) {
        await scroll.evaluate((element) => { element.scrollLeft = 500; });
        expect(await scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        const lastBox = (await headers.last().boundingBox())!;
        const scrollBox = (await scroll.boundingBox())!;
        expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 1);
      }
    }
    if (sources === 16 && width === 1440) {
      await expect(page.locator(".t3-wallet-chips button")).toHaveCount(17);
      await expect(page.locator(".t3-wallet-chips button").nth(1)).toHaveAttribute("title", /^[0-9a-f]{32}$/i);
      await expect(page.locator(".t3-wallet-balances tbody th small").filter({ hasText: "broker" })).toHaveCount(1);
      await expect(page.locator(".t3-wallet-kpis")).toContainText("— of 16 sources current");
      const allocation = (await page.locator(".t3-wallet-allocation").boundingBox())!;
      for (const chip of await page.locator(".t3-wallet-chips button").all()) {
        const box = (await chip.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(allocation.y);
      }
      const legend = page.locator(".t3-wallet-legend");
      expect(await legend.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
        await legend.evaluate((element) => element.clientWidth) + 1);
      for (const selector of [".t3-wallet-matrix", ".t3-wallet-moved"]) {
        const card = page.locator(selector);
        const content = card.locator(selector === ".t3-wallet-matrix" ? "table" : ".t3-wallet-movers");
        const cardBox = (await card.boundingBox())!;
        const contentBox = (await content.boundingBox())!;
        expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
      }
      const matrix = (await page.locator(".t3-wallet-matrix").boundingBox())!;
      const moved = (await page.locator(".t3-wallet-moved").boundingBox())!;
      expect(Math.abs(matrix.x - moved.x)).toBeLessThanOrEqual(1);
      expect(moved.y).toBeGreaterThanOrEqual(matrix.y + matrix.height + 16);
    }
    if (sources === 3 || sources === 16) await scroll.screenshot({ path: `/tmp/wallet-matrix-${width}-${sources}.png` });
  });
}

test("Summary pages 47 attribution groups and keeps the total row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/summary");
  const attribution = page.getByRole("table", { name: "Profit attribution" });
  await expect(attribution.getByRole("rowheader")).toHaveCount(11);
  await expect(page.getByText("Showing 1-10 of 47")).toBeVisible();
  await page.locator(".fidelity-attribution").screenshot({ path: "/tmp/attribution-1440-47.png" });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 11-20 of 47")).toBeVisible();
  await expect(attribution.locator(".fidelity-attribution-row.total")).toContainText("+$470");
});

test("History detail names sources without hash fragments", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/history");
  const sources = page.locator(".fidelity-history-source-row");
  await expect(sources).toHaveCount(12, { timeout: 30_000 });
  await page.getByRole("button", { name: "Show all (16)" }).click();
  await expect(sources).toHaveCount(16);
  expect(await sources.allTextContents()).not.toContainEqual(expect.stringMatching(/[0-9a-f]{12,}/i));
  await expect(sources.first()).toContainText("Wallet 1");
});

test("History, Wallets, and Overview share an alias and gapless opaque wallet numbers", async ({ page }) => {
  const address = "0x1234567890abcdef1234567890abcdefabcd1234";
  const id = createHash("md5").update(address).digest("hex");
  const oldId = createHash("md5").update("wallet-1").digest("hex");
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 3);
  await page.evaluate(async ({ address, id, oldId }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 11",
      values: [`btc: {addresses: []}\nerc20:\n  addresses:\n    - address: '${address}'\n      alias: Cold vault\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`],
    });
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET wallet = ? WHERE wallet = ?", values: [id, oldId] });
  }, { address, id, oldId });
  await page.goto("/#/history");
  await expect(page.locator(".fidelity-history-source-row")).toHaveCount(3);
  const labels = await page.locator(".fidelity-history-source-row span:first-child").allTextContents();
  expect(labels).toEqual(expect.arrayContaining(["Wallet 1", "Cold vault", "Wallet 2"]));
  await page.goto("/#/wallets");
  await expect(page.locator(`.t3-wallet-chips button[title="${id}"]`)).toContainText("Cold vault");
  expect(await page.locator(".t3-wallet-chips button").allTextContents()).toEqual(
    expect.arrayContaining(["All sources", "Wallet 1", "Cold vault", "Wallet 2"]),
  );
  await page.goto("/#/overview");
  await expect(page.locator(".t3-sources-list")).toContainText("Cold vault");
});

test("History detail uses configured exchange and broker names", async ({ page }) => {
  const exchange = createHash("md5").update("binance-demo-key").digest("hex");
  const broker = createHash("md5").update("ibkr:demo-query").digest("hex");
  const oldExchange = createHash("md5").update("wallet-0").digest("hex");
  const oldBroker = createHash("md5").update("wallet-1").digest("hex");
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 3);
  await page.evaluate(async ({ exchange, broker, oldExchange, oldBroker }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", {
      query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (10, ?)",
      values: ["!ent:e2e:exchanges:\n  - name: binance\n    initParams:\n      apiKey: demo-key\n      secret: demo-secret\n"],
    });
    await invoke("plugin:sql|execute", {
      query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (20, ?)",
      values: ["!ent:e2e:brokers:\n  - name: ibkr\n    alias: Interactive Brokers\n    initParams:\n      token: demo-token\n      queryId: demo-query\n"],
    });
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET wallet = ? WHERE wallet = ?", values: [exchange, oldExchange] });
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET wallet = ? WHERE wallet = ?", values: [broker, oldBroker] });
  }, { exchange, broker, oldExchange, oldBroker });
  await page.goto("/#/history");
  await expect(page.locator(".fidelity-history-source-row")).toHaveCount(3);
  const labels = await page.locator(".fidelity-history-source-row span:first-child").allTextContents();
  expect(labels).toEqual(expect.arrayContaining(["Binance", "Interactive Brokers", "Wallet 1"]));
});

test("unaliased address counts current when refresh uses a different source id", async ({ page }) => {
  const address = "0x1234567890abcdef1234567890abcdefabcd1234";
  const id = createHash("md5").update(address).digest("hex");
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page);
  await page.evaluate(async ({ address, id }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 11",
      values: [`btc: {addresses: []}\nerc20: {addresses: ['${address}']}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`],
    });
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET wallet = ?", values: [id] });
  }, { address, id });
  await page.addInitScript(() => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([{
    sourceId: "erc20:0", label: "ERC20 wallet 1", status: "ok", kind: "wallet", provider: "ERC20", hint: "0x1234…1234",
    lastSuccessAt: "2026-10-31T09:00:00.000Z", startedAt: "2026-10-31T09:00:00.000Z", finishedAt: "2026-10-31T09:00:00.000Z",
  }])));
  await page.goto("/#/wallets");
  await expect(page.locator(".t3-wallet-status-stamp")).toContainText("1 of 1 refreshed");
  await expect(page.locator(".t3-wallet-kpis")).toContainText("1 of 1 sources current");
});

test("Overview source cards avoid hash-shaped names", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/overview");
  const sources = page.locator(".t3-sources-list");
  await expect(sources).toBeVisible();
  expect(await sources.textContent()).not.toMatch(/[0-9a-f]{12,}/i);
});

test("an opaque wallet keeps its latest-value number on the coin page", async ({ page }) => {
  const id = createHash("md5").update("wallet-0").digest("hex");
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/wallets");
  const name = await page.locator(`.t3-wallet-chips button[title="${id}"]`).textContent();
  expect(name).toMatch(/^Wallet \d+$/);
  await page.goto("/#/coins/COIN01");
  await expect(page.locator(".coin-fidelity")).toContainText(name!);
});

test("an unaliased SOL source stays short in wallet and overview cards", async ({ page }) => {
  const address = "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH";
  const id = createHash("md5").update(address).digest("hex");
  const oldId = createHash("md5").update("wallet-0").digest("hex");
  await page.setViewportSize({ width: 1440, height: 900 });
  await installManySourceFixture(page, 3);
  await page.evaluate(async ({ address, id, oldId }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 11",
      values: [`btc: {addresses: []}\nerc20: {addresses: []}\nsol: {addresses: ['${address}']}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`],
    });
    await invoke("plugin:sql|execute", { query: "UPDATE assets_v2 SET wallet = ? WHERE wallet = ?", values: [id, oldId] });
  }, { address, id, oldId });
  await page.goto("/#/wallets");
  await expect(page.locator(`.t3-wallet-chips button[title="${id}"]`)).toContainText("HN7cAB…YWrH");
  expect(await page.locator(".t3-wallet-fidelity").textContent()).not.toContain(address);
  await page.goto("/#/overview");
  await expect(page.locator(".t3-sources-list")).toContainText("HN7cAB…YWrH");
  expect(await page.locator(".t3-sources-list").textContent()).not.toContain(address);
});

test("Settings uses a cog in expanded and collapsed rails", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  const sidebar = page.locator(".t3-desktop-rail");
  const settings = sidebar.getByRole("link", { name: "Settings" });
  const expand = sidebar.getByRole("button", { name: "Expand sidebar" });
  if (await expand.isVisible()) await expand.click();
  await expect(settings).toBeVisible();
  expect(await settings.locator("svg").innerHTML()).toContain("M7 1.5h4");
  await sidebar.screenshot({ path: "/tmp/settings-expanded-1440.png" });
  await sidebar.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(settings).toBeVisible();
  await sidebar.screenshot({ path: "/tmp/settings-collapsed-1440.png" });
});
