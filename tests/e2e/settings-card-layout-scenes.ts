import { expect, type Page } from "@playwright/test";

export async function expectSettingsCardsFitContent(page: Page, selector: string) {
  const gaps = await page.locator(selector).evaluateAll((cards) => cards
    .filter((card) => {
      const rect = card.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((card) => {
      const bottom = card.getBoundingClientRect().bottom;
      const regions: Array<{ top: number; bottom: number }> = [];
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim() || getComputedStyle(node.parentElement!).visibility === "hidden") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) regions.push({ top: rect.top, bottom: rect.bottom });
      }
      for (const control of card.querySelectorAll("input,button,textarea,select,svg")) {
        const rect = control.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && getComputedStyle(control).visibility !== "hidden") {
          regions.push({ top: rect.top, bottom: rect.bottom });
        }
      }
      regions.sort((a, b) => a.top - b.top);
      let occupiedBottom = regions[0].bottom;
      let internalGap = 0;
      for (const region of regions.slice(1)) {
        internalGap = Math.max(internalGap, region.top - occupiedBottom);
        occupiedBottom = Math.max(occupiedBottom, region.bottom);
      }
      return { card: card.className, gap: Math.round(bottom - occupiedBottom),
        internalGap: Math.round(internalGap), height: Math.round(card.getBoundingClientRect().height) };
    }));
  for (const item of gaps) {
    expect(item.gap, JSON.stringify(item)).toBeLessThanOrEqual(60);
    expect(item.internalGap, JSON.stringify(item)).toBeLessThanOrEqual(60);
  }
}

export async function expectSettingsSameRowBottoms(page: Page, selector: string) {
  const cards = await page.locator(selector).evaluateAll((elements) => elements
    .map((element) => ({ name: element.className, top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom, width: element.getBoundingClientRect().width }))
    .filter((card) => card.width > 0)
    .sort((a, b) => a.top - b.top));
  for (const card of cards) {
    const row = cards.filter((other) => Math.abs(other.top - card.top) <= 1);
    if (row.length < 2) continue;
    const bottoms = row.map((item) => item.bottom);
    expect(Math.max(...bottoms) - Math.min(...bottoms), JSON.stringify(row)).toBeLessThanOrEqual(1);
  }
}
