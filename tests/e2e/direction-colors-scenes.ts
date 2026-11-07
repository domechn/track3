import { expect, type Page } from "@playwright/test";

export async function expectDailyColours(page: Page, chartType: "phone" | "ipad" | "desktop") {
  const phone = chartType === "phone";
  const chart = page.locator(phone ? ".fd-overview-daily-chart" : ".t3-daily-chart");
  await expect(chart).toBeVisible({ timeout: 20_000 });
  const up = chart.locator('[data-direction="gain"]');
  const down = chart.locator('[data-direction="loss"]');
  expect(await up.count()).toBeGreaterThan(0);
  expect(await down.count()).toBeGreaterThan(0);
  const actual = await chart.evaluate((node, isPhone) => {
    const temp = document.createElement("span");
    node.append(temp);
    const expected = (token: string) => {
      temp.style.color = `hsl(var(--${token}))`;
      return getComputedStyle(temp).color;
    };
    const gain = expected("gain");
    const loss = expected("loss");
    temp.remove();
    const value = (element: Element) => isPhone ? getComputedStyle(element).fill : getComputedStyle(element).backgroundColor;
    return {
      gain, loss,
      up: [...node.querySelectorAll('[data-direction="gain"]')].map(value),
      down: [...node.querySelectorAll('[data-direction="loss"]')].map(value),
    };
  }, phone);
  expect(actual.gain).not.toBe(actual.loss);
  expect(actual.up.every((color) => color === actual.gain)).toBe(true);
  expect(actual.down.every((color) => color === actual.loss)).toBe(true);
  const labels = phone
    ? [chart.locator("text").filter({ hasText: "↑" }), chart.locator("text").filter({ hasText: "↓" })]
    : chartType === "desktop"
      ? [chart.locator(".t3-daily-direction span").first(), chart.locator(".t3-daily-direction span").last()]
      : [];
  if (labels.length) {
    const labelColors = await Promise.all(labels.map((label) => label.evaluate((node) =>
      getComputedStyle(node)[node instanceof SVGElement ? "fill" : "color"])));
    expect(labelColors).toEqual([actual.gain, actual.loss]);
  }
  const zeroLine = phone ? chart.locator('[data-direction-zero-axis]') : chart.locator(".t3-daily-zero");
  const zeroColor = await zeroLine.evaluate((node) => getComputedStyle(node)[node instanceof SVGElement ? "stroke" : "backgroundColor"]);
  expect(zeroColor).not.toBe(actual.gain);
  expect(zeroColor).not.toBe(actual.loss);
  return actual;
}
