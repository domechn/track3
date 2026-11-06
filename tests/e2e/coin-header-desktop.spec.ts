import { expect, test } from "@playwright/test";
import { installManySourceCoinFixture } from "./ui-bugs-scenes";
import { installTauriBridge } from "./fidelity-desktop-scenes";

test("long source aliases keep their full name for text and tooltip while fitting the header", async ({ page }) => {
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await page.evaluate(async () => {
    await (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = REPLACE(data, 'Ledger cold wallet', 'A very long wallet alias') WHERE id = 11",
      values: [],
    });
  });
  await page.goto("/#/coins/BTC");
  const name = page.locator('.coin-fidelity-heading .coin-source-name[title="A very long wallet alias"]');
  await expect(name).toBeVisible();
  await expect(name).toHaveText("A very long wallet alias");
  expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
});

for (const width of [900, 1100, 1280, 1920, 2560]) for (const locale of ["en", "zh"] as const) {
  test(`16-source coin header stays clear at ${width}px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((language) => localStorage.setItem("track3-ui-locale", language), locale);
    await installManySourceCoinFixture(page);
    await page.goto("/#/coins/BTC");
    const header = page.locator(".coin-fidelity-heading");
    await expect(header).toBeVisible();
    const sourceTable = page.locator(".coin-fidelity-sources table");
    await expect(sourceTable.locator("tbody tr")).toHaveCount(11);
    await expect(sourceTable.locator("tbody td").first()).toHaveAttribute("title", "Ledger cold wallet");
    await expect(sourceTable.locator("tbody tr").nth(9)).toContainText(locale === "en" ? "Others" : "其他");
    await expect(sourceTable.locator("tbody tr").last()).toContainText("100.0%");
    await expect(header.getByRole("button", { name: /\+13/ })).toBeVisible();
    for (const label of await page.locator(".coin-source-summary, .coin-fidelity-sources table tbody td:first-child").allTextContents())
      expect(label).not.toMatch(/[0-9a-f]{10,}/i);
    const description = header.locator("p").first();
    const controls = page.locator(".t3-fidelity-topbar-coin :is(button, fieldset, .t3-fidelity-stamp, .t3-fidelity-live-control, .t3-fidelity-date-control, .t3-fidelity-refresh-control), .coin-fidelity-heading > button").filter({ visible: true });
    if (width === 1100) {
      const heading = (await header.locator(":scope > div").boundingBox())!;
      const action = (await header.locator(":scope > button").boundingBox())!;
      expect(action.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    }
    for (const zoom of [1.25, 1.5, 2]) {
      await page.evaluate((value) => { document.documentElement.style.setProperty("zoom", String(value)); }, zoom);
      const text = (await description.boundingBox())!;
      for (const control of await controls.all()) {
        const box = await control.boundingBox();
        if (!box) continue;
        expect(text.x + text.width <= box.x || box.x + box.width <= text.x ||
          text.y + text.height <= box.y || box.y + box.height <= text.y).toBe(true);
      }
    }
    if (locale === "en" && (width === 900 || width === 1280)) {
      await page.evaluate(() => { document.documentElement.style.setProperty("zoom", "1"); });
      await page.screenshot({ path: `/tmp/coin-header-after-${width}.png` });
    }
    const more = header.getByRole("button", { name: /\+13/ });
    if (width === 900 && locale === "en") {
      await more.focus();
      await page.keyboard.press("Enter");
    } else await more.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("li")).toHaveCount(16);
    expect(await dialog.textContent()).not.toMatch(/[0-9a-f]{10,}/i);
    if (width === 900 && locale === "en") {
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(more).toBeFocused();
    }
  });
}
