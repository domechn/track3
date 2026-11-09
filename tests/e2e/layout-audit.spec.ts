import { expect, test } from "@playwright/test";
import {
  assertCardFill, assertColumnsBalanced, assertGridSnap, assertNoBlankSlabs,
  assertListBounds, assertNoOverflow, assertRowAligned, collectCards,
} from "./layout-audit";
import { seedLayoutFixture, assertNoBlankSlabs as assertNoCoinBlankSlabs } from "./layout-audit-scenes";
import { registerLayoutAudit } from "./layout-audit-captures";

test.describe("audit rule fixtures", () => {
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
});

test("layout rules catch a misaligned row, a blank slab, an unfilled card and overflowing amount", async ({ page }) => {
  await page.setContent(`
    <main id="app-main-content" style="position:relative;width:520px;height:500px;background:white">
      <div data-ui-card style="position:absolute;left:0;top:0;width:200px;height:200px;background:#eee">
        <strong style="display:block;width:80px;white-space:nowrap">¥1,234,567,890.00</strong>
      </div>
      <div data-ui-card style="position:absolute;left:320px;top:0;width:200px;height:120px;background:#eee">
        <span>Value</span>
      </div>
      <div data-ui-card style="position:absolute;left:0;top:320px;width:200px;height:180px;background:#eee">
        <span>Value</span>
      </div>
    </main>`);
  const cards = await collectCards(page);
  const content = { x: 0, y: 0, width: 520, height: 500 };
  expect(assertRowAligned(cards).some((item) => item.rule === "R1")).toBe(true);
  expect(assertColumnsBalanced(cards).some((item) => item.rule === "R2")).toBe(true);
  expect(assertNoBlankSlabs(cards, content).some((item) => item.rule === "R3")).toBe(true);
  expect(assertCardFill(cards).some((item) => item.rule === "R4")).toBe(true);
  expect(assertGridSnap(cards, content).some((item) => item.rule === "R5")).toBe(true);
  expect((await assertNoOverflow(page)).some((item) => item.rule === "R7")).toBe(true);
});

test("text directly in a card counts as rendered content for fill", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:56px;padding:16px;box-sizing:border-box">No connected devices</section></main>`);
  expect(assertCardFill(await collectCards(page))).toEqual([]);
});

test("row padding inside a card counts as rendered content", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;padding:16px;box-sizing:border-box"><div
    style="border-top:1px solid #aaa;padding:10px 0 12px"><span>A stored balance</span></div></section></main>`);
  expect(assertCardFill(await collectCards(page))).toEqual([]);
});

test("an empty stretched wrapper does not hide unused card space", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:200px;padding:16px;box-sizing:border-box"><div
    style="height:168px"><span>A stored balance</span></div></section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toEqual(["R4"]);
});

test("space between rows inside a card is an R4 violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:240px;box-sizing:border-box;padding:8px;display:flex;flex-direction:column">
    <h2 style="margin:0">Alert history</h2><ol style="display:flex;flex:1;flex-direction:column;justify-content:space-between;margin:0;padding:0">
      <li>First alert</li><li>Second alert</li></ol></section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("grid align-content cannot spread two short rows across a card", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:240px;box-sizing:border-box;padding:8px">
    <ol style="display:grid;height:220px;align-content:space-between;margin:0;padding:0">
      <li>First asset</li><li>Second asset</li></ol></section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("a growing chat list cannot hide a gap above its footer", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="display:flex;flex-direction:column;width:240px;height:240px;box-sizing:border-box;padding:8px">
    <div style="flex:1"><p>No conversations yet</p></div><footer>New chat</footer></section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("content past a card bottom is an R4 violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:100px;overflow:hidden"><p style="margin-top:110px">Hidden value</p>
    </section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("text crossing a card side is an R4 violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:100px;box-sizing:border-box;padding:16px">
    <small style="display:block;white-space:nowrap">A caption that extends beyond the right edge of its card</small>
  </section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("a button crossing a card side is an R4 violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:240px;height:100px;box-sizing:border-box;padding:16px">
    <button style="display:block;width:260px;height:40px"></button>
  </section></main>`);
  expect(assertCardFill(await collectCards(page)).map((item) => item.rule)).toContain("R4");
});

test("number overflow remains a violation when the cell can scroll", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><strong
    style="display:block;width:40px;white-space:nowrap;overflow-x:auto">¥1,234,567.89</strong></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toEqual(["R7"]);
});

test("an ungrouped quantity cut by a table viewport is R7", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><div style="width:160px;overflow-x:auto">
    <table style="width:300px;table-layout:fixed"><tbody><tr><td style="width:150px">Long source name</td>
    <td style="width:100px;white-space:nowrap">9.0123</td><td>Value</td></tr></tbody></table></div></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toContain("R7");
});

test("partly visible amount outside a table scroll viewport is R7", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><div style="width:160px;overflow-x:auto">
    <table style="width:300px"><tbody><tr><td style="width:100px">Source</td>
    <td style="white-space:nowrap">¥8,742,653.42</td></tr></tbody></table></div></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toContain("R7");
});

test("keyboard scrolling does not excuse a partly cut amount", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><div tabindex="0" style="width:160px;overflow-x:auto">
    <table style="width:300px"><tbody><tr><td style="width:100px">Source</td>
    <td style="white-space:nowrap">¥8,742,653.42</td></tr></tbody></table></div></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toContain("R7");
});

test("wrapped KPI amount is an overflow violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><strong
    style="display:block;width:40px;line-height:20px;word-break:break-all">+¥7,364,507</strong></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toEqual(["R7"]);
});

test("a wrapped caption may keep its amount on one readable line", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><button type="button" style="width:130px">
    <span style="display:block;white-space:pre-line">Unrecorded changes:\n−$214,644</span>
  </button></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toEqual([]);
});

test("wrapped amount inside an overview KPI span is an overflow violation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><div class="fd-overview-kpis"><div>
    <span style="display:block;width:40px;word-break:break-all">+¥7,364,507</span>
  </div></div></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toEqual(["R7"]);
});

test("a button with a separate label still checks its numeric span", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><button type="button">
    <span>Wallet</span><span style="display:block;width:40px;word-break:break-all">+¥7,364,507</span>
  </button></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toContain("R7");
});

test("amount split across inline elements still counts as wrapped", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><strong style="display:block;width:76px">
    <span>+</span><span>¥7,364,507</span></strong></main>`);
  expect((await assertNoOverflow(page)).map((item) => item.rule)).toEqual(["R7"]);
});

test("desktop history keeps its list beside the detail at design width", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.setContent(`<div class="t3-records-fidelity-shell"><div class="fidelity-history-grid">
    <section class="fidelity-history-list">Snapshots</section>
    <section class="fidelity-history-detail">Detail</section>
  </div></div>`);
  await page.addStyleTag({ path: "src/style.css" });
  const list = await page.locator(".fidelity-history-list").boundingBox();
  const detail = await page.locator(".fidelity-history-detail").boundingBox();
  expect(detail!.x).toBeGreaterThan(list!.x + list!.width);
});

test("phone overview retains its overlay top bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<div class="app-layout"><div id="app-top-bar"
    class="mobile-topbar mobile-topbar-root fidelity-overview-topbar"><div>Live total</div></div>
    <main id="app-main-content">Overview</main></div>`);
  await page.addStyleTag({ path: "src/mobile/components/mobile/mobile.css" });
  expect((await page.locator("#app-top-bar").boundingBox())!.height).toBe(0);
});

test("cards in a closed details section are outside the visible grid", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><details><summary>More</summary>
    <div data-ui-card style="width:240px;height:100px">Hidden controls</div></details></main>`);
  expect(await collectCards(page)).toEqual([]);
});

test("closed details content does not count as clipped card content", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><details data-card
    style="width:240px;height:50px;padding:16px;box-sizing:border-box"><summary>Source security</summary>
    <div style="height:200px">Hidden explanation</div></details></main>`);
  expect(assertCardFill(await collectCards(page))).toEqual([]);
});

test("a hidden container cannot conceal a clipped label from the card audit", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="width:200px;height:100px;overflow:hidden"><div style="width:400px;overflow:hidden">
    A label whose visible words run well beyond the card</div></section></main>`);
  expect(assertCardFill(await collectCards(page)).some((item) => item.rule === "R4"
    && item.message.includes("text extends"))).toBe(true);
});

test("an ellipsis label remains an intentional card truncation", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card style="width:200px;height:100px">
    <span style="display:block;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
    A deliberately shortened source label that is accessible by title</span></section></main>`);
  expect(assertCardFill(await collectCards(page)).some((item) => item.message.includes("text extends"))).toBe(false);
});

test("a hidden swipe action does not count as card overflow", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card
    style="position:relative;width:200px;height:100px;overflow:hidden">
    <span>Saved snapshot</span>
    <div class="mobile-swipe-actions" aria-hidden="true" style="position:absolute;left:200px;top:0;width:96px">
      <button tabindex="-1">Delete</button>
    </div></section></main>`);
  expect(assertCardFill(await collectCards(page)).some((item) => item.message.includes("text extends"))).toBe(false);
});

test("a clipped swipe action never extends the visible card", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card style="width:200px;height:100px">
    <div class="mobile-swipe-row" style="display:flex;width:200px;overflow:hidden">
      <div style="flex:none;width:200px">Saved snapshot</div>
      <div class="mobile-swipe-actions" style="flex:none;width:96px"><button>Delete</button></div>
    </div></section></main>`);
  expect(assertCardFill(await collectCards(page)).some((item) => item.message.includes("text extends"))).toBe(false);
});

test("visible aria-hidden chart text still counts as card content", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-card style="width:200px;height:100px">
    <div aria-hidden="true" style="margin-left:190px;width:80px">+10000K</div></section></main>`);
  expect(assertCardFill(await collectCards(page)).some((item) => item.message.includes("text extends"))).toBe(true);
});

test("assistant grid exemption also applies outside the History width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<main id="app-main-content"><div data-card
    data-layout-exempt="R5: fixed assistant panes" style="position:absolute;left:23px;width:220px;height:80px">Chats</div></main>`);
  const cards = await collectCards(page);
  expect(cards[0].exempt).toContain("R5: fixed assistant panes");
  expect(assertGridSnap(cards, { x: 0, y: 0, width: 1280, height: 800 })).toEqual([]);
});

test("History grid exemption stops at its documented width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<main id="app-main-content"><div class="fidelity-history-grid"
    data-layout-exempt="R5: eleven tracks at 1100 to 1179 pixels"><div data-card
    style="position:absolute;left:23px;width:220px;height:80px">Snapshots</div></div></main>`);
  const cards = await collectCards(page);
  expect(cards[0].exempt).not.toContain("R5:");
  expect(assertGridSnap(cards, { x: 0, y: 0, width: 1280, height: 800 })).toHaveLength(1);
});

test("summary SVG end labels cannot touch the card border", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section class="fidelity-summary-pnl" style="width:200px">
    <svg width="200" height="40"><text data-direction-end x="195" y="20">+¥2,153,221</text></svg>
    </section></main>`);
  expect((await assertNoOverflow(page)).some((item) => item.rule === "R7"
    && item.message.includes("chart end label"))).toBe(true);
});

test("column audit catches an uneven bottom across multiple rows", async ({ page }) => {
  await page.setContent(`<main id="app-main-content" style="position:relative;width:416px;height:516px">
    <div data-card style="position:absolute;left:0;top:0;width:200px;height:200px">Left top</div>
    <div data-card style="position:absolute;left:216px;top:0;width:200px;height:200px">Right top</div>
    <div data-card style="position:absolute;left:0;top:216px;width:200px;height:200px">Left bottom</div>
    <div data-card style="position:absolute;left:216px;top:300px;width:200px;height:216px">Right bottom</div>
  </main>`);
  const cards = await collectCards(page);
  expect(assertColumnsBalanced(cards).some((item) => item.rule === "R2")).toBe(true);
});

test("row audit sees cards inside sibling grid wrappers", async ({ page }) => {
  await page.setContent(`<main id="app-main-content" style="display:grid;grid-template-columns:200px 200px;gap:16px">
    <div class="grid"><div data-card style="width:200px;height:200px">Left</div></div>
    <div class="grid"><div data-card style="width:200px;height:150px">Right</div></div>
  </main>`);
  expect(assertRowAligned(await collectCards(page)).some((item) => item.rule === "R1")).toBe(true);
});

test("row audit catches a shifted top even when bottom edges match", async ({ page }) => {
  await page.setContent(`<main id="app-main-content" style="position:relative;width:416px;height:120px">
    <div data-card style="position:absolute;left:0;top:0;width:200px;height:120px">Left</div>
    <div data-card style="position:absolute;left:216px;top:8px;width:200px;height:112px">Right</div>
  </main>`);
  expect(assertRowAligned(await collectCards(page)).some((item) => item.rule === "R1")).toBe(true);
});

test("collection audit catches an unbounded source list", async ({ page }) => {
  await page.setContent(`<main id="app-main-content"><section data-ui-card>
    <div class="wallet-source-change-list">${Array.from({ length: 16 }, (_, n) => `<div>Source ${n}</div>`).join("")}</div>
  </section></main>`);
  expect((await assertListBounds(page)).some((item) => item.rule === "R6")).toBe(true);
});

test("grid audit anchors a shifted card row to the content edge", async ({ page }) => {
  await page.setContent(`<main id="app-main-content" style="display:grid;width:640px;grid-template-columns:312px 312px;gap:16px">
    <div data-card style="height:120px;transform:translateX(8px)">A</div>
    <div data-card style="height:120px;transform:translateX(8px)">B</div>
  </main>`);
  expect(assertGridSnap(await collectCards(page), { x: 0, y: 0, width: 640, height: 120 })
    .some((item) => item.rule === "R5")).toBe(true);
});

test("grid audit measures a centered twelve-column section from its own edges", async ({ page }) => {
  await page.setContent(`<main id="app-main-content" style="width:1489px">
    <div class="t3-manage-goals" style="display:grid;width:1440px;margin:auto;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px">
      <div data-card style="grid-column:span 8;height:120px">Rules</div>
      <div data-card style="grid-column:span 4;height:120px">History</div>
    </div>
  </main>`);
  const cards = await collectCards(page);
  expect(assertGridSnap(cards, { x: 0, y: 0, width: 1489, height: 120 })).toEqual([]);
});

test("seven digit What moved values keep every bar on a shared zero axis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(`<main><ol class="t3-moved-list t3-moved-diverging" style="width:400px">
    <li><span>BTC</span><span class="t3-moved-track" style="--zero:40%"><span style="left:40%;width:30%"></span></span><strong>+¥1,234,567</strong></li>
    <li><span>ETH</span><span class="t3-moved-track" style="--zero:40%"><span style="right:60%;width:20%"></span></span><strong>−¥7</strong></li>
  </ol></main>`);
  await page.addStyleTag({ path: "src/style.css" });
  const axes = await page.locator(".t3-moved-track").evaluateAll((tracks) => tracks.map((track) => {
    const box = track.getBoundingClientRect();
    return box.x + box.width * 0.4;
  }));
  expect(axes).toHaveLength(2);
  expect(Math.abs(axes[0] - axes[1])).toBeLessThanOrEqual(1);
  const values = await page.locator(".t3-moved-list li > strong").evaluateAll((nodes) =>
    nodes.map((node) => ({ text: node.getBoundingClientRect(), cell: node.parentElement!.getBoundingClientRect() })));
  expect(values.every(({ text, cell }) => text.right <= cell.right + 1)).toBe(true);
});
});

test("desktop wallet source cards page independently", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    await page.goto("/#/wallets", { waitUntil: "commit" });
    const list = page.locator(".wallet-source-change-card");
    const matrix = page.locator(".wallet-asset-change-card");
    await expect(list.locator("[data-layout-pager]")).toBeVisible({ timeout: 30_000 });
    await expect(matrix.locator("[data-layout-pager]")).toBeVisible({ timeout: 30_000 });
    const allocation = (await page.locator(".analyze-wallet-allocation").boundingBox())!;
    const allocationPager = (await page.locator(".analyze-wallet-allocation > [data-layout-pager]").boundingBox())!;
    expect(Math.abs(allocationPager.x - allocation.x - 20)).toBeLessThan(2);
    expect(Math.abs(allocation.x + allocation.width - allocationPager.x - allocationPager.width - 20)).toBeLessThan(2);
    const firstSource = await list.locator(".wallet-source-change-list strong").first().textContent();
    const firstColumn = await matrix.locator("thead th").nth(1).textContent();
    await list.locator("[data-layout-pager]").getByRole("button", { name: "Next" }).click();
    expect(await list.locator(".wallet-source-change-list strong").first().textContent()).not.toBe(firstSource);
    expect(await matrix.locator("thead th").nth(1).textContent()).toBe(firstColumn);
  } finally {
    await context.close();
  }
});

test("narrow desktop History keeps every snapshot and asset value readable", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    await page.goto("/#/history", { waitUntil: "commit" });
    await expect(page.getByTestId("history-desktop-detail")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".fidelity-history-compact-meta").first()).toBeVisible();
    await expect(page.locator(".fidelity-history-compact-share").first()).toBeVisible();
    expect((await assertNoOverflow(page)).filter((item) => item.rule === "R7")).toEqual([]);
    const widths = await page.locator(".fidelity-history-list-scroll, .fidelity-history-detail-scroll").evaluateAll((panes) =>
      panes.map((pane) => ({ table: pane.querySelector("table")!.getBoundingClientRect().width, viewport: pane.clientWidth })));
    expect(widths.every(({ table, viewport }) => table <= viewport + 1)).toBe(true);
  } finally {
    await context.close();
  }
});

test("stock detail uses a broker source in the dense fixture", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    const broker = await page.evaluate(() =>
      (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown) => Promise<{ symbol: string; amount: number }[]> })
        .__e2eInvoke("plugin:sql|select", {
          query: "SELECT symbol, amount FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND asset_type = 'stock' AND symbol IN ('AAPL', 'NVDA') ORDER BY symbol",
          values: [],
        }));
    expect(broker).toHaveLength(2);
    expect(broker[0].amount).toBeGreaterThan(150);
    expect(broker[1].amount).toBeGreaterThan(220);
    await page.goto("/#/coins/NVDA?assetType=stock", { waitUntil: "commit" });
    await expect(page.locator(".coin-fidelity-sources")).toContainText("Interactive Brokers", { timeout: 30_000 });
    await expect(page.locator(".coin-fidelity-sources")).not.toContainText("Cold");
  } finally {
    await context.close();
  }
});

test("dense BTC detail ends after its Transactions card", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await seedLayoutFixture(page, "real");
    await page.goto("/#/coins/BTC", { waitUntil: "commit" });
    await expect(page.locator(".coin-fidelity-transactions tbody tr").first()).toBeVisible({ timeout: 30_000 });
    const tail = await page.locator("#app-main-content").evaluate((main) => {
      const card = main.querySelector(".coin-fidelity-transactions")!;
      return main.scrollHeight - (card.getBoundingClientRect().bottom - main.getBoundingClientRect().top + main.scrollTop);
    });
    expect(tail).toBeLessThan(80);
  } finally {
    await context.close();
  }
});

registerLayoutAudit("desktop");

test("layout audit detects a slab below a short card", async ({ page }) => {
  await page.setContent(`<main id="audit" style="position:relative;width:800px;height:500px">
    <div data-card style="position:absolute;left:0;top:0;width:450px;height:500px"></div>
    <div data-card style="position:absolute;left:466px;top:0;width:334px;height:260px"></div>
  </main>`);
  await expect(assertNoCoinBlankSlabs(page, "#audit")).rejects.toThrow(/blank/);
});

test("layout audit detects almost aligned card edges", async ({ page }) => {
  await page.setContent(`<main id="audit" style="position:relative;width:800px;height:300px">
    <div data-card style="position:absolute;left:0;top:0;width:392px;height:300px"></div>
    <div data-card style="position:absolute;left:408px;top:3px;width:392px;height:297px"></div>
  </main>`);
  await expect(assertNoCoinBlankSlabs(page, "#audit")).rejects.toThrow(/top edges differ/);
});
