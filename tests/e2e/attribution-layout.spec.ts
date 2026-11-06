import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { amountGeometry, seedAttributionLayout } from "./attribution-layout-scenes";

test("desktop month and year amounts compact only when the cell is too narrow", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seedAttributionLayout(page);
  await page.evaluate(async () => {
    const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
    await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
  });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const year = page.locator(".fidelity-year-card strong").first();
  await expect(year).toHaveText("+¥206,596,023");
  const month = page.locator(".fidelity-month-value")
    .filter({ hasText: /¥/ }).first();
  const fit = await month.evaluate((element) => {
    const text = element.getAttribute("title") ?? "";
    const probe = document.createElement("span");
    probe.textContent = text;
    probe.style.cssText = `position:absolute;white-space:nowrap;font:${getComputedStyle(element).font}`;
    document.body.appendChild(probe);
    const fits = probe.getBoundingClientRect().width <= element.getBoundingClientRect().width;
    probe.remove();
    return fits;
  });
  expect(fit).toBe(true);
  await expect(month).toHaveText(await month.getAttribute("title") ?? "");
  await page.evaluate(async () => {
    const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('KRW', 'Korean won', '₩', 1026, 1, '2099-01-01T00:00:00.000Z')");
    await run("UPDATE configuration SET data = 'KRW' WHERE id = 7");
  });
  await page.reload();
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const narrowMonth = page.locator(".fidelity-month-value").filter({ hasText: /₩/ }).first();
  await expect(narrowMonth).toContainText(/[MBT]/);
  await expect(narrowMonth).toHaveAttribute("title", /₩[\d,]{10,}/);
});

for (const width of [1001, 1040, 1100, 1280, 1440]) {
  for (const theme of ["dark", "light"] as const) {
    test(`Summary attribution keeps 12 large amounts on one line at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await seedAttributionLayout(page);
      await page.goto("/#/summary");
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      const table = page.locator(".fidelity-attribution-table");
      await expect(table.locator(".fidelity-attribution-row:not(.head):not(.total)")).toHaveCount(10);
      for (const header of await table.locator('.fidelity-attribution-row.head [role="columnheader"]').all())
        expect(await header.evaluate((element) => {
          const text = document.createRange();
          text.selectNodeContents(element);
          return text.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
        })).toBeLessThanOrEqual(1.2);
      if (theme === "light") {
        const row = table.locator(".fidelity-attribution-row:not(.head):not(.total)").first();
        await expect(row).not.toHaveCSS("border-top-color", "rgb(27, 26, 31)");
        const rowBorder = await row.evaluate((element) => getComputedStyle(element).borderTopColor);
        await expect(table.locator(".fidelity-attribution-row.total")).not.toHaveCSS("border-top-color", rowBorder);
      }
      expect(await table.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const rows = await amountGeometry(page,
        ".fidelity-attribution-table .fidelity-attribution-row:not(.head)", '[role="cell"]:nth-child(n+3)');
      expect(rows).toHaveLength(11);
      const rightEdges = rows[0].cells.map((cell) => cell.right);
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(51);
        expect(row.height).toBeLessThanOrEqual(53);
        expect(row.cells).toHaveLength(4);
        for (const [index, cell] of row.cells.entries()) {
          expect(cell.height).toBeLessThanOrEqual(cell.lineHeight * 1.2);
          expect(cell.text).not.toMatch(/\.\d{2}$/);
          expect(cell.right).toBeCloseTo(rightEdges[index], 0);
        }
        for (let index = 1; index < row.cells.length; index++)
          expect(row.cells[index].x - row.cells[index - 1].right).toBeGreaterThanOrEqual(12);
      }
      const rowTextBoxes = await table.locator(".fidelity-attribution-row:not(.head)").evaluateAll((elements) =>
        elements.map((row) => [...row.children].filter((cell) => cell.textContent?.trim()).map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const box = range.getBoundingClientRect();
          return { left: box.left, right: box.right };
        })));
      for (const boxes of rowTextBoxes)
        for (let index = 1; index < boxes.length; index++)
          expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
      await expect(table.locator(".fidelity-attribution-row").first()).toContainText("Unexplained");
      const range = table.locator(".fidelity-attribution-row.total > span:nth-child(2)");
      expect(await range.evaluate((element) => {
        const contents = document.createRange();
        contents.selectNodeContents(element);
        return contents.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight);
      })).toBeLessThanOrEqual(1.2);
      await expect(range).toHaveAttribute("title", "$12,006,602.10 → $45,007,805.88");
      await expect(page.getByText("Showing 1-10 of 12")).toBeVisible();
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Showing 11-12 of 12")).toBeVisible();
      const secondPage = await amountGeometry(page,
        ".fidelity-attribution-table .fidelity-attribution-row:not(.head)", '[role="cell"]:nth-child(n+3)');
      expect(secondPage).toHaveLength(3);
      for (const row of secondPage) {
        expect(row.height).toBeCloseTo(rows[0].height, 0);
        for (const cell of row.cells) expect(cell.height).toBeLessThanOrEqual(cell.lineHeight * 1.2);
        for (let index = 1; index < row.cells.length; index++)
          expect(row.cells[index].x - row.cells[index - 1].right).toBeGreaterThanOrEqual(12);
      }
      mkdirSync("/tmp/attribution-layout", { recursive: true });
      await page.getByRole("button", { name: "Previous" }).click();
      await expect(table.locator(".fidelity-attribution-row:not(.head):not(.total)").first()).toBeVisible();
      await page.locator(".fidelity-attribution").screenshot({ path: `/tmp/attribution-layout/desktop-${width}-${theme}.png` });
    });
  }
}

test("narrow desktop Summary scrolls amounts while Asset stays in view", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedAttributionLayout(page);
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  const table = page.locator(".fidelity-attribution-table");
  const asset = table.locator(".fidelity-attribution-row:not(.head):not(.total) > b").first();
  await expect(asset).toHaveCSS("position", "sticky");
  const before = (await asset.boundingBox())!.x;
  await table.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect((await asset.boundingBox())!.x).toBeCloseTo(before, 0);
});

test("CNY attribution stays aligned at the owner's 1280px width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedAttributionLayout(page);
  await page.evaluate(async () => {
    const run = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
    await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
  });
  await page.goto("/#/summary");
  await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await expect(page.locator(".fidelity-attribution-options")).toContainText("CNY");
  const table = page.locator(".fidelity-attribution-table");
  expect(await table.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const totalRange = table.locator(".fidelity-attribution-row.total > span:nth-child(2)");
  await expect(totalRange).toContainText(/¥[\d,]+ → ¥[\d,]+/);
  expect(await totalRange.innerText()).not.toMatch(/[MBT万亿]/);
  const rows = await amountGeometry(page,
    ".fidelity-attribution-table .fidelity-attribution-row:not(.head)", '[role="cell"]:nth-child(n+3)');
  expect(rows).toHaveLength(11);
  for (const row of rows) {
    expect(row.height).toBeCloseTo(52, 0);
    for (const cell of row.cells) {
      expect(cell.text).toContain("¥");
      expect(cell.height).toBeLessThanOrEqual(cell.lineHeight * 1.2);
    }
    for (let index = 1; index < row.cells.length; index++)
      expect(row.cells[index].x - row.cells[index - 1].right).toBeGreaterThanOrEqual(12);
  }
  const tickBoxes = await table.locator(".fidelity-attribution-axis > span:nth-child(2) > span")
    .evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).visibility !== "hidden").map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
  for (let index = 1; index < tickBoxes.length; index++)
    expect(tickBoxes[index].left - tickBoxes[index - 1].right).toBeGreaterThanOrEqual(8);
  const leaders = await amountGeometry(page, ".fidelity-leaders .fidelity-leader-row", ".number:nth-child(3)");
  expect(leaders).toHaveLength(4);
  for (const row of leaders) {
    expect(row.cells[0].text).toContain("¥");
    expect(row.cells[0].height).toBeLessThanOrEqual(row.cells[0].lineHeight * 1.2);
  }
  const leaderClipping = await page.locator(".fidelity-leaders .fidelity-leader-row .number:nth-child(3)")
    .evaluateAll((elements) => elements.map((element) => element.scrollWidth - element.clientWidth));
  for (const clipped of leaderClipping) expect(clipped).toBeLessThanOrEqual(1);
  mkdirSync("/tmp/attribution-layout", { recursive: true });
  await page.locator(".fidelity-attribution").screenshot({ path: "/tmp/attribution-layout/desktop-1280-cny.png" });
  await page.locator(".fidelity-leaders").screenshot({ path: "/tmp/attribution-layout/desktop-leaders-1280-cny.png" });
});
