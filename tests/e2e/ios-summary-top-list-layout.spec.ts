import { expect, test } from "@playwright/test";
import { expectSummaryTopGeometry, seedElevenAssetSummary } from "./summary-top-list-layout-scenes";
import { forceSubgridFallback } from "./comparison-movers-scenes";

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

for (const width of [390, 820]) for (const theme of ["dark", "light"] as const) {
  test(`Summary top lists fit ${width}px ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, userAgent: phone, isMobile: true, hasTouch: true, colorScheme: theme });
    try {
      const page = await context.newPage();
      await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
      await seedElevenAssetSummary(page);
      await page.goto("/#/summary");
      if (width === 390) {
        await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
        await expectSummaryTopGeometry(page, 44);
        await expect(page.locator(".fd-top-coins .summary-top-collection").getByRole("columnheader")).toHaveCount(3);
        expect(await page.locator(".summary-top-row small").first().evaluate((node) => getComputedStyle(node).fontSize))
          .toBe("12px");
        await page.waitForTimeout(1200);
        if (theme === "dark") {
          await page.locator(".fd-top-coins").scrollIntoViewIfNeeded();
          await page.waitForTimeout(800);
          await page.screenshot({ path: `/tmp/summary-top-${width}-${theme}.png`, animations: "disabled" });
        }
        else await page.locator(".fd-top-coins").screenshot({ path: `/tmp/summary-top-${width}-${theme}.png` });
      } else {
        await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
        const ranked = page.locator(".profit-mobile-list .mobile-list-row");
        await expect(ranked.filter({ hasText: "1211.HK" }).locator(".mobile-list-value .text-xs")).toHaveText("-94.54%");
        const boxes = await ranked.evaluateAll((rows) => rows.map((row) => {
          const label = row.querySelector(".mobile-list-label")!.getBoundingClientRect();
          const value = row.querySelector(".mobile-list-value")!.getBoundingClientRect();
          const percent = row.querySelector(".mobile-list-value .text-xs")!.getBoundingClientRect();
          const box = row.getBoundingClientRect();
          return { labelRight: label.right, valueX: value.x, percentRight: percent.right, rowRight: box.right, height: box.height };
        }));
        expect(boxes.length).toBe(8);
        for (const box of boxes) {
          expect(box.labelRight).toBeLessThanOrEqual(box.valueX + 1);
          expect(box.percentRight).toBeLessThanOrEqual(box.rowRight + 1);
          // Chromium reports fractional CSS pixels with smaller-than-renderable rounding noise.
          expect(Math.round(Math.abs(box.height - boxes[0].height) * 1024) / 1024).toBeLessThanOrEqual(1);
        }
        await page.waitForTimeout(1200);
        await page.locator(".d2-summary").screenshot({ path: `/tmp/summary-top-${width}-${theme}.png` });
      }
    } finally { await context.close(); }
  });
}

test("phone Summary includes unrecorded quantity additions in the loss percentage", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, userAgent: phone, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await seedElevenAssetSummary(page, false);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    await expect(page.locator(".summary-top-row").filter({ has: page.locator('b:text-is("1211.HK")') }).locator("small"))
      .toHaveText("−94.5%");
  } finally { await context.close(); }
});

test("phone minimum gain bar paints two coloured pixels", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, userAgent: phone, isMobile: true, hasTouch: true, colorScheme: "dark" });
  try {
    const page = await context.newPage();
    await seedElevenAssetSummary(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    const track = page.locator(".summary-top-row").filter({ has: page.locator('b:text-is("ADA")') }).locator(".summary-top-track");
    await track.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const png = await track.screenshot();
    const painted = await page.evaluate(async (base64) => {
      const track = [...document.querySelectorAll(".summary-top-row")]
        .find((row) => row.querySelector("b")?.textContent === "ADA")!.querySelector(".summary-top-track")!;
      const bar = track.querySelector("i")!;
      const box = bar.getBoundingClientRect();
      if (box.width !== 2) return -1;
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const y = Math.floor((box.top + box.bottom) / 2);
      const trackBox = track.getBoundingClientRect();
      return Array.from({ length: 2 }, (_, i) => {
        const [red, green, blue] = context.getImageData(Math.floor(box.left - trackBox.left) + i,
          Math.floor(y - trackBox.top), 1, 1).data;
        return green > red + 25 && blue > red + 15;
      }).filter(Boolean).length;
    }, png.toString("base64"));
    expect(painted).toBe(2);
  } finally { await context.close(); }
});

test("Summary top lists align without subgrid at 390px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, userAgent: phone, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await seedElevenAssetSummary(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 40_000 });
    await forceSubgridFallback(page);
    const boxes = await page.locator(".summary-top-row").evaluateAll((rows) => rows.map((row) => {
      const [ticker, track, amount, percent] = [...row.children] as HTMLElement[];
      const bar = track.querySelector("i");
      return {
        ticker: ticker.getBoundingClientRect().right,
        track: track.getBoundingClientRect().toJSON(),
        bar: bar?.getBoundingClientRect().toJSON(),
        amount: amount.getBoundingClientRect().toJSON(),
        percent: percent.getBoundingClientRect().toJSON(),
        zero: getComputedStyle(track.firstElementChild!, "::before").left,
      };
    }));
    expect(boxes).toHaveLength(11);
    for (const box of boxes) {
      expect(box.track.width).toBeGreaterThanOrEqual(80);
      expect(box.ticker).toBeLessThanOrEqual(box.track.x - 6);
      expect(box.amount.x).toBeGreaterThanOrEqual(box.track.right + 6);
      expect(box.percent.x).toBeGreaterThanOrEqual(box.amount.right + 6);
      if (box.bar) {
        expect(box.bar.x).toBeGreaterThanOrEqual(box.track.x + 12 - 1);
        expect(box.bar.right).toBeLessThanOrEqual(box.track.right - 12 + 1);
      }
    }
    expect(new Set(boxes.map((box) => box.track.x + 12 + parseFloat(box.zero))).size).toBe(1);
  } finally { await context.close(); }
});
