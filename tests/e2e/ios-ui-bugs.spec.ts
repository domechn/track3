import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { installManySourceFixture } from "./ui-bugs-scenes";

test.use({
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

for (const sources of [3, 8, 16, 30]) {
  test(`phone Wallets keeps ${sources} sources reachable at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installManySourceFixture(page, sources);
    await page.goto("/#/wallets");
    await page.getByRole("button", { name: "Detailed analysis" }).click();
    const scroll = page.locator(".d2-wallets .wallet-asset-change-scroll").first();
    await expect(page.locator(".fd-wallet-chips button").nth(1)).toHaveAttribute("title", /^[0-9a-f]{32}$/i);
    await expect(scroll.locator("thead th")).toHaveCount(sources + 2);
    await expect(scroll).toHaveAttribute("tabindex", "0");
    const rendered = await page.locator(".analyze-wallets").textContent();
    expect(rendered).not.toMatch(/[0-9a-f]{12,}/i);
    expect(rendered).not.toMatch(/[0-9a-f]{6,}…[0-9a-f]{4,}/i);
    const text = await scroll.locator("thead th").allTextContents();
    expect(text).not.toContainEqual(expect.stringMatching(/[0-9a-f]{12,}/i));
    await expect(scroll.locator("thead th").nth(1)).toHaveAttribute("title", /^[0-9a-f]{32}$/i);
    await expect(scroll.locator("thead th").nth(1)).toHaveAttribute("aria-label", text[1]);
    const list = page.locator(".d2-wallets .wallet-asset-change-mobile");
    expect(await list.evaluate((element) => getComputedStyle(element).display)).toBe("none");
    const boxes = await scroll.locator("thead th").evaluateAll((cells) => cells.map((cell) => {
      const box = cell.getBoundingClientRect();
      return { left: box.left, right: box.right, position: getComputedStyle(cell).position };
    }));
    for (let index = 1; index < boxes.length - 1; index++) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right - 1);
    expect(boxes[0].position).toBe("sticky");
    expect(boxes.at(-1)?.position).toBe("sticky");
    const size = await scroll.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
    expect(size.scrollWidth).toBeGreaterThan(size.clientWidth);
    await scroll.evaluate((element) => { element.scrollLeft = 400; });
    expect(await scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    const lastBox = (await scroll.locator("thead th").last().boundingBox())!;
    const scrollBox = (await scroll.boundingBox())!;
    expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(scrollBox.x + scrollBox.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (sources === 3 || sources === 16) await scroll.screenshot({ path: `/tmp/wallet-matrix-390-${sources}.png` });
  });
}

test("long phone source names stay inside the viewport and their header cell", async ({ page }) => {
  const longName = "Long term cold storage account in another country with several additional descriptive words";
  await page.setViewportSize({ width: 390, height: 844 });
  await installManySourceFixture(page, 3);
  await page.goto("/#/wallets");
  const chip = page.locator(".fd-wallet-chips button").nth(1);
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.locator("span").evaluate((node, name) => { node.textContent = name; }, longName);
  expect((await chip.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect(await chip.locator("span").evaluate((node) => getComputedStyle(node).textOverflow)).toBe("ellipsis");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Detailed analysis" }).click();
  const header = page.locator(".d2-wallets .wallet-asset-change-scroll thead th").nth(1);
  await expect(header).toBeVisible({ timeout: 30_000 });
  const label = header.locator("span");
  await label.evaluate((node, name) => { node.textContent = name; }, longName);
  expect((await header.boundingBox())!.width).toBeLessThanOrEqual(160);
  expect(await label.evaluate((node) => getComputedStyle(node).textOverflow)).toBe("ellipsis");
});

test("phone Summary pages 47 groups while retaining its total", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/summary");
  const attribution = page.locator(".fd-attribution");
  await expect(attribution.locator(".fd-attr-row")).toHaveCount(11);
  await expect(attribution.getByText("Showing 1-10 of 47")).toBeVisible();
  expect((await attribution.getByRole("button", { name: "Next" }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await attribution.screenshot({ path: "/tmp/attribution-390-47.png" });
  await attribution.getByRole("button", { name: "Next" }).click();
  await expect(attribution.getByText("Showing 11-20 of 47")).toBeVisible();
  await expect(attribution.locator(".fd-attr-total")).toContainText("$5,781 → $6,251");
  await expect(attribution.locator(".fd-attr-total")).toContainText("Known P&L +$470");
});

test("phone coin detail never uses a source hash as its name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/coins/COIN47");
  const sources = page.locator(".fd-source-list");
  await expect(sources).toBeVisible();
  expect(await sources.textContent()).not.toMatch(/[0-9a-f]{12,}/i);
});

test("unaliased SOL stays short on phone Wallets and coin detail", async ({ page }) => {
  const address = "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH";
  const id = createHash("md5").update(address).digest("hex");
  const oldId = createHash("md5").update("wallet-0").digest("hex");
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(page.locator(`.fd-wallet-chips button[title="${id}"]`)).toContainText("HN7cAB…YWrH");
  expect(await page.locator(".fd-page").textContent()).not.toContain(address);
  await page.goto("/#/coins/COIN01");
  await expect(page.locator(".fd-source-list")).toContainText("HN7cAB…YWrH");
  expect(await page.locator(".fd-source-list").textContent()).not.toContain(address);
});

test("opaque wallet keeps its number from phone Wallets to coin detail", async ({ page }) => {
  const id = createHash("md5").update("wallet-0").digest("hex");
  await page.setViewportSize({ width: 390, height: 844 });
  await installManySourceFixture(page, 16);
  await page.goto("/#/wallets");
  const chip = page.locator(`.fd-wallet-chips button[title="${id}"]`);
  await expect(chip).toBeVisible();
  const name = (await chip.textContent())?.trim();
  expect(name).toMatch(/^Wallet \d+$/);
  await page.goto("/#/coins/COIN01");
  await expect(page.locator(".fd-source-list")).toContainText(name!);
});
