import { expect, type Page } from "@playwright/test";

export async function expectSignedValuesOnOneLine(page: Page, label: string) {
  const result = await page.locator("#app-main-content").evaluate((root) => {
    const numeric = /^[+\-−]?[^\s]*\d/;
    const candidates = [...root.querySelectorAll<HTMLElement>("*")].filter((element) => {
      const text = element.textContent?.trim() ?? "";
      return numeric.test(text) && /^\S+$/.test(text) && ![...element.children].some(
        (child) => numeric.test(child.textContent?.trim() ?? ""),
      ) && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden";
    });
    const violations: string[] = [];
    for (const element of candidates) {
      const text = element.textContent!.trim();
      const range = document.createRange();
      range.selectNodeContents(element);
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2;
      if (range.getBoundingClientRect().height > lineHeight * 1.6) {
        violations.push(`${text}: wrapped into multiple lines`);
      }
      const nodes = [...function* () {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) yield walker.currentNode as Text;
      }()];
      const hasSign = /^[+−-]/.test(text);
      if (hasSign && style.whiteSpace !== "nowrap") {
        const path = [element, element.parentElement, element.parentElement?.parentElement, element.parentElement?.parentElement?.parentElement]
          .map((node) => `${node?.tagName.toLowerCase()}.${node?.className}`).join(" < ");
        violations.push(`${text}: missing one-line style (${path})`);
      }
      const secondIndex = hasSign ? text.search(/\d/) : 1;
      if (secondIndex < 0 || secondIndex >= text.length) continue;
      const point = (index: number) => {
        let offset = 0;
        for (const node of nodes) {
          const length = node.data.length;
          if (index < offset + length) return { node, offset: index - offset };
          offset += length;
        }
        return null;
      };
      const leading = element.textContent!.indexOf(text);
      const sign = point(leading);
      const digit = point(leading + secondIndex);
      if (!sign || !digit || (hasSign && sign.node !== digit.node)) {
        violations.push(`${text}: sign and digits split across text nodes`);
        continue;
      }
      range.setStart(sign.node, sign.offset);
      range.setEnd(sign.node, sign.offset + 1);
      const top = range.getClientRects()[0]?.top;
      range.setStart(digit.node, digit.offset);
      range.setEnd(digit.node, digit.offset + 1);
      if (top === undefined || Math.abs(top - (range.getClientRects()[0]?.top ?? Infinity)) > 1) {
        violations.push(`${text}: sign and digits have different baselines`);
      }
    }
    return { count: candidates.length, violations };
  });
  expect.soft(result.count, `${label}: numeric values inspected`).toBeGreaterThan(0);
  expect.soft(result.violations, label).toEqual([]);
}
