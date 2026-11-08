import { expect, type Page } from "@playwright/test";

export async function coinCardContentGaps(page: Page) {
  return page.locator(".coin-fidelity-grid > .coin-fidelity-card").evaluateAll((cards) =>
    cards.map((card) => {
      const content = card.matches(".coin-fidelity-manual-history")
        ? card.querySelector(".coin-fidelity-set-price")
        : card.matches(".coin-fidelity-chart")
          ? card.querySelector(".coin-fidelity-chart-stats")
        : card.querySelector(".coin-fidelity-show-lots, .coin-fidelity-lots .t3-empty-state")
          ?? card.querySelector(".coin-fidelity-lots tbody tr:last-child");
      const style = getComputedStyle(card);
      return card.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth) -
        parseFloat(style.paddingBottom) - content!.getBoundingClientRect().bottom;
    }));
}

export async function assertNoBlankSlabs(page: Page, contentSelector = ".analyze-coin") {
  const problems = await page.locator(contentSelector).evaluate((content) => {
    const contentBounds = content.getBoundingClientRect();
    const cards = [...content.querySelectorAll<HTMLElement>("[data-card], [data-ui-card], .card, .fd-card, .coin-fidelity-card")]
      .filter((node) => getComputedStyle(node).display !== "none")
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const issues: string[] = [];
    if (!cards.length) return ["no cards found in content area"];
    const bounds = {
      left: contentBounds.left,
      top: Math.max(contentBounds.top, Math.min(...cards.map((rect) => rect.top))),
      width: contentBounds.width,
      height: Math.min(contentBounds.bottom, Math.max(...cards.map((rect) => rect.bottom))) -
        Math.max(contentBounds.top, Math.min(...cards.map((rect) => rect.top))),
    };
    for (const axis of ["left", "top", "right", "bottom"] as const) {
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        const difference = Math.abs(cards[i][axis] - cards[j][axis]);
        if (difference > 1 && difference <= 6) issues.push(`${axis} edges differ by ${difference.toFixed(1)}px`);
      }
    }
    const step = 6;
    const columns = Math.ceil(bounds.width / step), rows = Math.ceil(bounds.height / step);
    const filled = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => {
      const px = bounds.left + (x + 0.5) * step, py = bounds.top + (y + 0.5) * step;
      return cards.some((rect) => px >= rect.left && px < rect.right && py >= rect.top && py < rect.bottom);
    }));
    const heights = Array(columns).fill(0) as number[];
    for (let y = 0; y < rows; y++) {
      const stack: number[] = [];
      for (let x = 0; x <= columns; x++) {
        if (x < columns) heights[x] = filled[y][x] ? 0 : heights[x] + 1;
        const current = x < columns ? heights[x] : 0;
        while (stack.length && heights[stack.at(-1)!] > current) {
          const index = stack.pop()!, height = heights[index];
          const left = stack.length ? stack.at(-1)! + 1 : 0;
          const width = x - left;
          if (width * step < 120 || height * step < 120) continue;
          const top = y - height + 1;
          const sides = [
            left === 0 || Array.from({ length: height }, (_, n) => filled[top + n]?.[left - 1]).some(Boolean),
            x === columns || Array.from({ length: height }, (_, n) => filled[top + n]?.[x]).some(Boolean),
            top === 0 || filled[top - 1]?.slice(left, x).some(Boolean),
            y === rows - 1 || filled[y + 1]?.slice(left, x).some(Boolean),
          ].filter(Boolean).length;
          if (sides >= 2) {
            issues.push(`blank ${width * step}x${height * step}px at ${left * step},${top * step}`);
            return issues;
          }
        }
        stack.push(x);
      }
    }
    return issues;
  });
  expect(problems).toEqual([]);
}
