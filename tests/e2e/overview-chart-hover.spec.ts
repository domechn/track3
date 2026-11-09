import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { seedOverviewChart } from "./overview-chart-scenes";
import { mkdirSync } from "node:fs";

test("overview line hover gives a complete point tooltip and keeps annotations outside the plot", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  const card = page.locator(".t3-total-overview .t3-hero-card");
  await expect(card.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
  const chart = card.locator(".t3-hero-chart canvas");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  const bounds = await chart.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * .5, bounds!.y + bounds!.height * .5);
  const tooltip = page.locator("[data-chart-tooltip]");
  await expect(tooltip).toContainText(/\$[\d,]+\.\d\d/);
  await expect(tooltip).toContainText(/2026|Oct|Sep/);
  const note = card.locator(".t3-chart-best-day");
  const plot = card.locator(".t3-chart-plot");
  const noteBox = await note.boundingBox();
  const plotBox = await plot.boundingBox();
  expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(plotBox!.y);
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tooltip).toBeVisible();
  const point = (await card.locator("[data-chart-active-point]").boundingBox())!;
  const crosshair = Number(await chart.getAttribute("data-crosshair-x"));
  expect(crosshair).toBeGreaterThan(0);
  expect(Math.abs(bounds!.x + crosshair - (point.x + point.width / 2))).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  const endTag = card.locator(".t3-chart-end-value");
  const endBox = await endTag.boundingBox();
  expect(endBox!.x).toBeGreaterThan(bounds!.x + bounds!.width * .5);
});

test("dense seven digit history keeps tooltips and captions clear at desktop widths", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const card = page.locator(".t3-total-overview .t3-hero-card");
  const chart = card.locator(".t3-hero-chart canvas");
  await expect(card.locator(".t3-hero-value")).toContainText("$1,641,793.33", { timeout: 30_000 });
  mkdirSync("/tmp/overview-chart-hover", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      localStorage.setItem("track3-ui-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }, theme);
    for (const width of [1100, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(chart).toBeVisible();
      const canvas = (await chart.boundingBox())!;
      const cardBox = (await card.boundingBox())!;
      await card.locator(".t3-chart-best-day").focus();
      await expect(page.locator("[data-chart-tooltip]")).toBeVisible();
      const bestPoint = (await card.locator("[data-chart-active-point]").boundingBox())!;
      await expect.poll(async () => {
        const markerX = await chart.evaluate((element: HTMLCanvasElement) => {
          const { width, height } = element;
          const pixels = element.getContext("2d")!.getImageData(0, 0, width, height).data;
          let left = width;
          let right = -1;
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
            if (g > r + 15 && g > b + 10) { left = Math.min(left, x); right = Math.max(right, x); }
          }
          return right < 0 ? null : (left + right) / 2 * element.getBoundingClientRect().width / width;
        });
        return markerX === null ? Infinity : Math.abs(markerX - (bestPoint.x + bestPoint.width / 2 - canvas.x));
      }, { message: JSON.stringify({ width, theme }) }).toBeLessThanOrEqual(2);
      await chart.focus();
      await page.keyboard.press("ArrowRight");
      const first = (await card.locator("[data-chart-active-point]").boundingBox())!;
      await page.keyboard.press("Escape");
      await page.keyboard.press("ArrowLeft");
      const last = (await card.locator("[data-chart-active-point]").boundingBox())!;
      for (const fraction of [0, .1, .2, .3, .4, .5, .6, .7, .8, 1]) {
        const hoverX = first.x + first.width / 2 + (last.x - first.x) * fraction +
          (fraction === 0 ? 1 : fraction === 1 ? -1 : 0);
        await page.mouse.move(hoverX, canvas.y + canvas.height * .5);
        const tooltip = page.locator("[data-chart-tooltip]");
        await expect(tooltip, JSON.stringify({ width, theme, fraction, first, last, canvas })).toContainText(/\$[\d,]+\.\d\d/);
        await expect(tooltip).toContainText(/Oct|Nov/);
        await expect.poll(async () => {
          const selected = await card.locator("[data-chart-active-point]").boundingBox();
          return selected ? Math.abs(selected.x + selected.width / 2 - hoverX) : Infinity;
        }, { message: JSON.stringify({ width, theme, fraction, hoverX }) }).toBeLessThanOrEqual(6);
        await expect.poll(async () => {
          const tip = await tooltip.boundingBox();
          const point = await card.locator("[data-chart-active-point]").boundingBox();
          return !!tip && !!point && (tip.x + tip.width <= point.x - 4 || tip.x >= point.x + point.width + 4 ||
            tip.y + tip.height <= point.y - 4 || tip.y >= point.y + point.height + 4);
        }, { message: JSON.stringify({ width, theme, fraction, hoverX }) }).toBe(true);
        const tip = (await tooltip.boundingBox())!;
        const point = (await card.locator("[data-chart-active-point]").boundingBox())!;
        const note = (await card.locator(".t3-chart-best-day").boundingBox())!;
        const crosshair = Number(await chart.getAttribute("data-crosshair-x"));
        expect(Math.abs(canvas.x + crosshair - (point.x + point.width / 2))).toBeLessThanOrEqual(1);
        expect(tip.x).toBeGreaterThanOrEqual(cardBox.x + 7);
        expect(tip.x + tip.width).toBeLessThanOrEqual(cardBox.x + cardBox.width - 7);
        expect(tip.y).toBeGreaterThanOrEqual(cardBox.y + 7);
        expect(tip.y + tip.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 7);
        expect(tip.x + tip.width <= note.x || note.x + note.width <= tip.x ||
          tip.y + tip.height <= note.y || note.y + note.height <= tip.y,
          JSON.stringify({ tip, note, point, width, theme, fraction })).toBe(true);
      }
      await page.mouse.move(canvas.x - 4, canvas.y - 4);
      const tag = (await card.locator(".t3-chart-end-value").boundingBox())!;
      const note = (await card.locator(".t3-chart-best-day").boundingBox())!;
      const plot = (await card.locator(".t3-chart-plot").boundingBox())!;
      expect(tag.x).toBeGreaterThan(canvas.x + canvas.width * .75);
      expect(tag.x - last.x).toBeGreaterThanOrEqual(4);
      expect(tag.x - last.x).toBeLessThanOrEqual(20);
      expect(tag.x + tag.width).toBeLessThanOrEqual(cardBox.x + cardBox.width - 8);
      expect(note.y + note.height).toBeLessThanOrEqual(plot.y);
      await card.screenshot({ path: `/tmp/overview-chart-hover/desktop-${width}-${theme}.png` });
    }
  }
});

test("CNY axis and end tag fit at the narrow desktop width", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page, "CNY");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/#/overview");
  const card = page.locator(".t3-total-overview .t3-hero-card");
  const chart = card.locator("canvas");
  await expect(card.locator(".t3-hero-value")).toContainText("¥11,656,732.64", { timeout: 30_000 });
  const canvas = (await chart.boundingBox())!;
  await page.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .5);
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/¥[\d,]+\.\d\d/);
  await page.mouse.move(canvas.x - 5, canvas.y - 5);
  const tag = (await card.locator(".t3-chart-end-value").boundingBox())!;
  expect(tag.x).toBeGreaterThan(canvas.x + canvas.width * .75);
  expect(tag.x + tag.width).toBeLessThanOrEqual(canvas.x + canvas.width);
  const tickRegionTop = Number(await chart.getAttribute("data-chart-area-bottom"));
  expect(tickRegionTop).toBeGreaterThan(0);
  expect(tag.y + tag.height).toBeLessThanOrEqual(canvas.y + tickRegionTop);
  const clippedInk = await chart.evaluate((element: HTMLCanvasElement) => {
    const { data } = element.getContext("2d")!.getImageData(0, 0, 4, element.height);
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index]) count++;
    return count;
  });
  expect(clippedInk).toBe(0);
  await card.screenshot({ path: "/tmp/overview-chart-hover/desktop-1100-cny.png" });
});

test("negative daily change, last snapshot, and ATH labels remain readable", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const card = page.locator(".t3-total-overview .t3-hero-card");
  await expect(card.locator(".t3-hero-value")).toContainText("$1,641,793.33", { timeout: 30_000 });
  const lastSnapshot = card.locator(".t3-hero-change");
  const ath = card.locator(".t3-ath-note");
  await expect(lastSnapshot).toContainText("Last snapshot");
  await expect(ath).toContainText("All-time high");
  await expect(ath).toContainText("reached");
  await expect(card.locator("canvas")).toHaveAttribute("aria-label", /since 2026-10-24/);
  const cardBox = (await card.boundingBox())!;
  for (const label of [lastSnapshot, ath]) {
    const box = (await label.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  }
  const negativeBar = page.locator(".t3-daily-panel .t3-daily-column:has([data-direction='loss'])").first();
  await expect(negativeBar).toBeVisible();
  await negativeBar.hover();
  await expect(page.locator("[data-chart-tooltip]")).toContainText("Change");
  await expect(page.locator("[data-chart-tooltip]")).toContainText("vs previous snapshot");
  await expect(page.locator("[data-chart-tooltip]")).toContainText("−$");
});

test("hovering a non-best day shows that day's top mover", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
  await seedOverviewChart(page);
  await page.goto("/#/overview");
  const chart = page.locator(".t3-total-overview .t3-hero-chart canvas");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  await chart.focus();
  await page.keyboard.press("ArrowRight");
  const first = (await page.locator("[data-chart-active-point]").boundingBox())!;
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowLeft");
  const last = (await page.locator("[data-chart-active-point]").boundingBox())!;
  const canvas = (await chart.boundingBox())!;
  await page.mouse.move(first.x + (last.x - first.x) * .25, canvas.y + canvas.height * .5);
  await expect(page.locator("[data-chart-tooltip]")).toContainText(/Day's top mover: USDT/);
});

test("desktop best-day caption stays clear across ranges and early, middle, late days", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const [day, expected] of [[1, "25 Oct"], [8, "1 Nov"], [15, "8 Nov"]] as const) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.clock.setFixedTime(new Date("2026-11-08T12:00:00Z"));
    await seedOverviewChart(page, "USD", day);
    await page.goto("/#/overview");
    const card = page.locator(".t3-total-overview .t3-hero-card");
    for (const range of ["7D", "30D", "90D", "1Y", "All"]) {
      const control = page.getByRole("button", { name: range, exact: true });
      await control.click();
      const caption = card.locator(".t3-chart-best-day");
      await expect(caption).toBeVisible({ timeout: 30_000 });
      const canvas = card.locator(".t3-chart-plot canvas");
      await expect(canvas).toHaveAttribute("data-chart-area-top", /[0-9]/);
      const note = (await caption.boundingBox())!;
      const plot = (await canvas.boundingBox())!;
      const cardBox = (await card.boundingBox())!;
      expect(note.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(note.x + note.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      expect(note.y + note.height + 6).toBeLessThanOrEqual(
        plot.y + Number(await canvas.getAttribute("data-chart-area-top")));
    }
    const canvas = card.locator("canvas");
    const markerBeforeFocus = await canvas.evaluate((element: HTMLCanvasElement) => {
      const { width, height } = element;
      const pixels = element.getContext("2d")!.getImageData(0, 0, width, height).data;
      let left = width;
      let right = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
        if (g > r + 15 && g > b + 10) { left = Math.min(left, x); right = Math.max(right, x); }
      }
      return right < 0 ? null : (left + right) / 2 * element.getBoundingClientRect().width / width;
    });
    await card.locator(".t3-chart-best-day").focus();
    await expect(page.locator("[data-chart-tooltip]")).toContainText(expected);
    await expect(page.locator("[data-chart-tooltip]")).toContainText(/Day's top mover: USDT/);
    if (day === 8) {
      const text = (await page.locator("[data-chart-tooltip]").textContent()) ?? "";
      const value = Number(text.match(/Value: \$([\d,]+\.\d\d)/)?.[1].replaceAll(",", ""));
      expect(value).toBeGreaterThan(1_625_000);
    }
    const point = (await card.locator("[data-chart-active-point]").boundingBox())!;
    const canvasBox = (await canvas.boundingBox())!;
    expect(markerBeforeFocus).not.toBeNull();
    expect(Math.abs(markerBeforeFocus! - (point.x + point.width / 2 - canvasBox.x))).toBeLessThanOrEqual(2);
    const gainPixels = await canvas.evaluate((canvas: HTMLCanvasElement, point) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((point.x + point.width / 2 - rect.x) * canvas.width / rect.width);
      const y = Math.round((point.y + point.height / 2 - rect.y) * canvas.height / rect.height);
      let count = 0;
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
        const [r, g, b] = canvas.getContext("2d")!.getImageData(x + dx, y + dy, 1, 1).data;
        if (g > r + 15 && g > b + 10) count++;
      }
      return count;
    }, point);
    expect(gainPixels).toBeGreaterThan(4);
    await expect(card.locator(".t3-hero-value")).toContainText("$1,641,793.33");
    await expect(canvas).toBeVisible();
    await card.screenshot({ path: `/tmp/overview-chart-hover/desktop-best-${day}.png` });
    await page.close();
  }
});
