import { expect, type Locator } from "@playwright/test";

export const amounts = ["$1,653,296.05", "$99,999,999.99", "$999,999,999.99", "−$999,999,999.99", "$12.34", "••••••••"];
export const output = "/tmp/track3-overview-value-fit";

export async function assertValueFits(value: Locator, card: Locator, divider?: Locator) {
  const geometry = await value.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    return { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, textRight: text.right };
  });
  const cardBox = await card.boundingBox();
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.textRight).toBeLessThanOrEqual(cardBox!.x + cardBox!.width - 16);
  if (divider) {
    const dividerBox = await divider.boundingBox();
    const valueBox = await value.boundingBox();
    if (dividerBox!.y < valueBox!.y + valueBox!.height) {
      expect(dividerBox!.x - geometry.textRight).toBeGreaterThanOrEqual(16);
    }
  }
}

export async function assertEqualStatGutters(stats: Locator) {
  const gutters = await stats.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
  }));
  expect(gutters).toHaveLength(3);
  const stacked = await stats.first().evaluate((element) => {
    const card = element.closest(".t3-hero-card")!;
    return card.classList.contains("mobile-hero-card") || getComputedStyle(card.querySelector(".t3-hero-content")!).display === "flex";
  });
  for (const [index, gutter] of gutters.entries()) {
    expect(gutter.left).toBeGreaterThanOrEqual(stacked && index === 0 ? 0 : 16);
    expect(gutter.right).toBeGreaterThanOrEqual(16);
  }
  expect(new Set(gutters.flatMap(({ left, right }, index) => stacked && index === 0 ? [right] : [left, right])).size, JSON.stringify({ stacked, gutters })).toBe(1);
  if (stacked) {
    expect(gutters[0].left).toBe(0);
    const alignment = await stats.first().evaluate((element) => {
      const card = element.closest(".t3-hero-card")!;
      const header = card.querySelector(".t3-hero-header")!;
      return {
        stat: element.firstElementChild!.getBoundingClientRect().left,
        header: header.firstElementChild!.getBoundingClientRect().left,
        width: window.innerWidth,
      };
    });
    expect(Math.abs(alignment.stat - alignment.header), JSON.stringify(alignment)).toBeLessThanOrEqual(1);
    const valueAlignment = await stats.first().evaluate((element) => {
      const card = element.closest(".t3-hero-card")!;
      return card.querySelector(".t3-hero-value")!.getBoundingClientRect().left
        - card.querySelector(".t3-hero-header")!.firstElementChild!.getBoundingClientRect().left;
    });
    expect(Math.abs(valueAlignment)).toBeLessThanOrEqual(1);
  }
}
