import type { Page } from "@playwright/test";

export type Rule = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9";
export type Box = { x: number; y: number; width: number; height: number };
export type Violation = { rule: Rule; message: string; boxes: Box[] };
export type Card = { id: string; box: Box; parent: string; gridBox?: Box; lastBottom: number; clippedBottom: number; clippedSide: number; internalGap: number; hasPager: boolean; exempt: string };

const right = (box: Box) => box.x + box.width;
const bottom = (box: Box) => box.y + box.height;
const exempt = (card: Card, rule: Rule) => card.exempt.includes(`${rule}:`);
const issue = (rule: Rule, message: string, boxes: Box[]): Violation => ({ rule, message, boxes });

export async function collectCards(page: Page): Promise<Card[]> {
  return page.locator("#app-main-content").evaluate((main) => {
    const box = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const rendered = (node: Element) => {
      const closed = node.closest("details:not([open])");
      if (closed && closed !== node && !node.closest("summary")) return false;
      for (let parent: Element | null = node; parent && parent !== main.parentElement; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden"
          || parent.matches(".mobile-swipe-actions[aria-hidden='true']")) return false;
      }
      return true;
    };
    const visible = (node: Element) => {
      const r = node.getBoundingClientRect();
      return rendered(node) && r.width >= 80 && r.height >= 48;
    };
    const selector = "[data-card], [data-ui-card], .card, [class*='panel'], .fd-card, [class*='-card']";
    const nodes = [...main.querySelectorAll(selector)].filter((node) => visible(node) &&
      (node.hasAttribute("data-card") || node.hasAttribute("data-ui-card")
        || [...node.classList].some((name) => /(?:^|[-_])(?:card|panel)$/.test(name))));
    return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)
      && box(other).width >= box(node).width - 2 && box(other).height >= box(node).height - 2))
      .map((node, index) => {
        const r = box(node);
        const leaves = [...node.querySelectorAll("*")].filter((child) =>
          child.children.length === 0 && rendered(child) && getComputedStyle(child).position !== "absolute"
          && getComputedStyle(child).position !== "fixed");
        const painted = [...node.querySelectorAll(
          "button, a[href], input, textarea, select, [data-empty-state], .t3-fr-empty, .fd-empty, table, canvas, svg, img",
        )].filter((child) => {
          const style = getComputedStyle(child);
          return rendered(child)
            && style.position !== "absolute" && style.position !== "fixed";
        });
        const insideHorizontalViewport = (element: Element) => {
          for (let parent: Element | null = element; parent && parent !== node; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (/auto|scroll/.test(style.overflowX)) return true;
            if (parent.matches(".mobile-swipe-row") && /hidden|clip/.test(style.overflowX)) return true;
            if (/hidden|clip/.test(style.overflowX) && style.textOverflow === "ellipsis"
              && style.whiteSpace === "nowrap") return true;
          }
          return false;
        };
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const textBottoms: { parent: Element; bottom: number }[] = [];
        const textSides: { left: number; right: number }[] = [];
        while (walker.nextNode()) {
          const text = walker.currentNode;
          if (!text.textContent?.trim() || !text.parentElement || !rendered(text.parentElement)
            || text.parentElement.closest(".sr-only")) continue;
          const range = document.createRange();
          range.selectNodeContents(text);
          const rect = range.getBoundingClientRect();
          if (rect.height) textBottoms.push({ parent: text.parentElement, bottom: rect.bottom });
          if (text.parentElement.closest("svg") || !rect.width || !rect.height) continue;
          if (!insideHorizontalViewport(text.parentElement)) textSides.push({ left: rect.left, right: rect.right });
        }
        const filledChildren = [...node.children].filter((child) => {
          const style = getComputedStyle(child);
          if (!rendered(child) || style.position === "absolute" || style.position === "fixed") return false;
          const renderedBottom = Math.max(r.y,
            ...leaves.filter((leaf) => child.contains(leaf)).map((leaf) => box(leaf).y + box(leaf).height),
            ...painted.filter((item) => child.contains(item)).map((item) => box(item).y + box(item).height),
            ...textBottoms.filter((text) => child.contains(text.parent)).map((text) => text.bottom));
          return box(child).y + box(child).height - renderedBottom <= 18;
        });
        const lastBottom = Math.max(r.y,
          ...leaves.map((child) => box(child).y + box(child).height),
          ...painted.map((child) => box(child).y + box(child).height),
          ...textBottoms.map((text) => text.bottom), ...filledChildren.map((child) => box(child).y + box(child).height));
        const insideScroll = (element: Element) => {
          for (let parent: Element | null = element; parent && parent !== node.parentElement; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (/auto|scroll/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) return true;
          }
          return false;
        };
        const clippedBottom = Math.max(r.y,
          ...leaves.filter((child) => !insideScroll(child)).map((child) => box(child).y + box(child).height),
          ...painted.filter((child) => !insideScroll(child)).map((child) => box(child).y + box(child).height),
          ...textBottoms.filter((text) => !insideScroll(text.parent)).map((text) => text.bottom));
        const horizontalBoxes = painted.filter((child) => child.tagName.toLowerCase() !== "svg"
          && !child.closest("svg") && !insideHorizontalViewport(child)).map(box);
        const clippedSide = Math.max(0, ...textSides.map((text) => r.x - text.left),
          ...textSides.map((text) => text.right - r.x - r.width),
          ...horizontalBoxes.map((child) => r.x - child.x),
          ...horizontalBoxes.map((child) => child.x + child.width - r.x - r.width));
        const internalGap = Math.max(0, ...[node, ...node.querySelectorAll("*")].map((parent) => {
          const style = getComputedStyle(parent);
          const verticalFlex = style.display === "flex" && style.flexDirection === "column";
          const verticalGrid = style.display.includes("grid");
          if (box(parent).width < 120 || !verticalFlex && !verticalGrid) return 0;
          const children = [...parent.children].filter((child) => {
            const childStyle = getComputedStyle(child), rect = box(child);
            return rendered(child)
              && childStyle.position !== "absolute" && childStyle.position !== "fixed"
              && rect.width > 0 && rect.height > 0;
          }).sort((a, b) => box(a).y - box(b).y);
          const spread = ["space-around", "space-between", "space-evenly"];
          const distribution = verticalFlex ? style.justifyContent : style.alignContent;
          const grows = verticalFlex && children.some((child) => parseFloat(getComputedStyle(child).flexGrow) > 0);
          if (children.length < 2 || !spread.includes(distribution) && !grows) return 0;
          const contentBottom = (child: Element) => {
            const childStyle = getComputedStyle(child);
            const childBox = box(child);
            if (childStyle.backgroundImage !== "none" || childStyle.borderTopStyle !== "none"
              || childStyle.borderBottomStyle !== "none") return childBox.y + childBox.height;
            return Math.max(childBox.y,
            ...painted.filter((item) => child.contains(item)).map((item) => box(item).y + box(item).height),
            ...textBottoms.filter((text) => child.contains(text.parent)).map((text) => text.bottom));
          };
          let previousBottom = box(children[0]).y;
          const gaps = children.map((child) => {
            const childBox = box(child);
            const gap = Math.max(0, childBox.y - previousBottom);
            previousBottom = Math.max(previousBottom, grows && parseFloat(getComputedStyle(child).flexGrow) > 0
              ? contentBottom(child) : childBox.y + childBox.height);
            return gap;
          });
          if (spread.includes(distribution) && distribution !== "space-between") {
            const parentBox = box(parent);
            const last = box(children.at(-1)!);
            gaps.push(box(children[0]).y - parentBox.y, parentBox.y + parentBox.height - last.y - last.height);
          }
          return Math.max(0, ...gaps);
        }));
        let layoutParent = node.parentElement;
        while (layoutParent && layoutParent !== main) {
          const style = getComputedStyle(layoutParent);
          if ((style.display.includes("grid") || style.display.includes("flex"))
            && nodes.filter((other) => layoutParent!.contains(other)).length > 1) break;
          layoutParent = layoutParent.parentElement;
        }
        const mainRect = box(main), mainStyle = getComputedStyle(main);
        const mainContent = { x: mainRect.x + parseFloat(mainStyle.paddingLeft),
          y: mainRect.y + parseFloat(mainStyle.paddingTop),
          width: main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight),
          height: main.scrollHeight - parseFloat(mainStyle.paddingTop) - parseFloat(mainStyle.paddingBottom) };
        const path = (element: Element | null) => {
          const parts: number[] = [];
          while (element && element !== main) {
            parts.push([...element.parentElement!.children].indexOf(element));
            element = element.parentElement;
          }
          return parts.reverse().join(".");
        };
        return {
          id: `${node.id || [...node.classList].join(".") || node.tagName.toLowerCase()}#${index}`,
          box: r, parent: path(layoutParent || main), lastBottom, clippedBottom, clippedSide, internalGap,
          gridBox: node.closest(".t3-settings-content, .ios-d3-settings-page, .t3-manage-goals")
            ? box(node.closest(".t3-settings-content, .ios-d3-settings-page, .t3-manage-goals")!) : mainContent,
          hasPager: Boolean(node.querySelector("[data-layout-pager], [aria-label*='page' i], [class*='pager'], [class*='pagination']")),
          exempt: [
            node.closest("[data-layout-exempt]:not(.fidelity-history-grid)")?.getAttribute("data-layout-exempt"),
            node.closest(".fidelity-history-grid")?.getAttribute("data-layout-exempt")
              ?.replace(/R5:[^;]+/g, (reason) => window.innerWidth >= 1100 && window.innerWidth <= 1179 ? reason : ""),
          ].filter(Boolean).filter((reason, index, reasons) => reasons.indexOf(reason) === index).join("; "),
        };
      });
  });
}

export function assertRowAligned(cards: Card[]): Violation[] {
  const results: Violation[] = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j];
    if (a.parent !== b.parent || exempt(a, "R1") || exempt(b, "R1")) continue;
    const topDifference = Math.abs(a.box.y - b.box.y);
    const bottomDifference = Math.abs(bottom(a.box) - bottom(b.box));
    if (topDifference <= Math.min(32, a.box.height / 2, b.box.height / 2)
      && (right(a.box) <= b.box.x + 1 || right(b.box) <= a.box.x + 1)
      && (topDifference > 1 || bottomDifference > 1)) {
      results.push(issue("R1", `${a.id} and ${b.id} edges differ by ${topDifference.toFixed(1)}px top, ${bottomDifference.toFixed(1)}px bottom`, [a.box, b.box]));
    }
  }
  return results;
}

export function assertColumnsBalanced(cards: Card[]): Violation[] {
  const results: Violation[] = [];
  const parents = new Map<string, Card[]>();
  for (const card of cards.filter((card) => !exempt(card, "R2"))) {
    parents.set(card.parent, [...parents.get(card.parent) ?? [], card]);
  }
  for (const siblings of parents.values()) {
    const columns: Card[][] = [];
    for (const card of siblings) {
      const column = columns.find(([first]) => Math.abs(first.box.x - card.box.x) <= 1
        && Math.abs(first.box.width - card.box.width) <= 1);
      if (column) column.push(card);
      else columns.push([card]);
    }
    for (let i = 0; i < columns.length; i++) for (let j = i + 1; j < columns.length; j++) {
      const a = columns[i], b = columns[j], aTop = Math.min(...a.map((card) => card.box.y));
      const bTop = Math.min(...b.map((card) => card.box.y));
      const aBottom = Math.max(...a.map((card) => bottom(card.box)));
      const bBottom = Math.max(...b.map((card) => bottom(card.box)));
      if (Math.abs(aTop - bTop) > 1 || Math.abs(aBottom - bBottom) <= 1
        || !(right(a[0].box) <= b[0].box.x + 1 || right(b[0].box) <= a[0].box.x + 1)) continue;
      const short = aBottom < bBottom ? a : b;
      const shortBottom = Math.min(aBottom, bBottom);
      if (siblings.some((card) => !short.includes(card) && card.box.y >= shortBottom - 1
        && card.box.y < Math.max(aBottom, bBottom)
        && card.box.x < right(short[0].box) - 1 && right(card.box) > short[0].box.x + 1)) continue;
      results.push(issue("R2", `${a[0].id} and ${b[0].id} column bottoms differ by ${Math.abs(aBottom - bBottom).toFixed(1)}px`,
        [a[0].box, b[0].box, a.at(-1)!.box, b.at(-1)!.box]));
    }
  }
  return results;
}

export function assertNoBlankSlabs(cards: Card[], content: Box): Violation[] {
  const step = 8;
  const cols = Math.ceil(content.width / step), rows = Math.ceil(content.height / step);
  const occupied = new Uint8Array(cols * rows);
  for (const card of cards) {
    const x0 = Math.max(0, Math.floor((card.box.x - content.x) / step));
    const x1 = Math.min(cols, Math.ceil((right(card.box) - content.x) / step));
    const y0 = Math.max(0, Math.floor((card.box.y - content.y) / step));
    const y1 = Math.min(rows, Math.ceil((bottom(card.box) - content.y) / step));
    for (let y = y0; y < y1; y++) occupied.fill(1, y * cols + x0, y * cols + x1);
  }
  const heights = new Int16Array(cols), candidates: Violation[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) heights[x] = occupied[y * cols + x] ? 0 : heights[x] + 1;
    const stack: number[] = [];
    for (let x = 0; x <= cols; x++) {
      const height = x === cols ? 0 : heights[x];
      while (stack.length && heights[stack.at(-1)!] > height) {
        const bar = stack.pop()!, h = heights[bar], left = stack.length ? stack.at(-1)! + 1 : 0;
        const width = x - left;
        if (width * step < 120 || h * step < 120) continue;
        const top = y - h + 1, sides = new Map<"left" | "right" | "top" | "bottom", Card>();
        const rectangle = { x: content.x + left * step, y: content.y + top * step,
          width: width * step, height: h * step };
        for (const card of cards) {
          const verticalOverlap = Math.min(bottom(card.box), bottom(rectangle)) - Math.max(card.box.y, rectangle.y);
          const horizontalOverlap = Math.min(right(card.box), right(rectangle)) - Math.max(card.box.x, rectangle.x);
          if (verticalOverlap >= 80 && Math.abs(right(card.box) - rectangle.x) <= 2 * step) sides.set("left", card);
          if (verticalOverlap >= 80 && Math.abs(card.box.x - right(rectangle)) <= 2 * step) sides.set("right", card);
          if (horizontalOverlap >= 80 && Math.abs(bottom(card.box) - rectangle.y) <= 2 * step) sides.set("top", card);
          if (horizontalOverlap >= 80 && Math.abs(card.box.y - bottom(rectangle)) <= 2 * step) sides.set("bottom", card);
        }
        if (sides.size < 2 || [...sides.values()].some((card) => exempt(card, "R3"))) continue;
        candidates.push(issue("R3", `empty ${Math.round(rectangle.width)}x${Math.round(rectangle.height)}px rectangle bounded by ${[...sides.keys()].join(", ")}`, [rectangle, ...[...new Set(sides.values())].map((card) => card.box)]));
      }
      stack.push(x);
    }
  }
  const results: Violation[] = [];
  for (const candidate of candidates.sort((a, b) => b.boxes[0].width * b.boxes[0].height - a.boxes[0].width * a.boxes[0].height)) {
    const rectangle = candidate.boxes[0];
    if (results.some((result) => {
      const other = result.boxes[0];
      const overlap = Math.max(0, Math.min(right(rectangle), right(other)) - Math.max(rectangle.x, other.x))
        * Math.max(0, Math.min(bottom(rectangle), bottom(other)) - Math.max(rectangle.y, other.y));
      return overlap >= 0.8 * rectangle.width * rectangle.height;
    })) continue;
    results.push(candidate);
  }
  return results;
}

export function assertCardFill(cards: Card[]): Violation[] {
  return cards.flatMap((card) => {
    if (exempt(card, "R4")) return [];
    const below = bottom(card.box) - card.lastBottom;
    const clipped = card.clippedBottom - bottom(card.box);
    if (clipped > 1) return [issue("R4", `${card.id} content extends ${clipped.toFixed(1)}px past its bottom`, [card.box])];
    if (card.clippedSide > 1) return [issue("R4", `${card.id} text extends ${card.clippedSide.toFixed(1)}px past its side`, [card.box])];
    if (below >= (card.hasPager ? 40 : 24)) return [issue("R4", `${card.id} has ${below.toFixed(1)}px below its last child`, [card.box])];
    if (card.internalGap >= 40) return [issue("R4", `${card.id} has a ${card.internalGap.toFixed(1)}px gap between content`, [card.box])];
    return [];
  });
}

export function assertGridSnap(cards: Card[], content: Box): Violation[] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) groups.set(card.parent, [...groups.get(card.parent) ?? [], card]);
  const results: Violation[] = [];
  for (const group of groups.values()) {
    const grid = group[0].gridBox ?? content;
    const column = (grid.width - 11 * 16) / 12;
    if (column <= 0) continue;
    const leftEdges = Array.from({ length: 12 }, (_, n) => grid.x + n * (column + 16));
    const rightEdges = Array.from({ length: 12 }, (_, n) => grid.x + (n + 1) * column + n * 16);
    for (const card of group) {
      if (exempt(card, "R5")) continue;
      if (!leftEdges.some((edge) => Math.abs(card.box.x - edge) <= 0.5)
        || !rightEdges.some((edge) => Math.abs(right(card.box) - edge) <= 0.5)) {
        results.push(issue("R5", `${card.id} edges do not snap to the 12-column grid`, [card.box, grid]));
      }
    }
  }
  return results;
}

export async function assertNoOverflow(page: Page): Promise<Violation[]> {
  return page.locator("#app-main-content").evaluate((main) => {
    const numeric = /[+\-−]?[¥$€£]\s*\d|\d{1,3}(?:,\d{3})+|^[+\-−]?\s*\d+(?:\.\d+)?(?:%|\s+[A-Z]{2,8})?$/;
    const crossesCell = (node: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect(), cell = node.getBoundingClientRect();
      return text.left < cell.left - 3 || text.right > cell.right + 3;
    };
    const partlyClipped = (node: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      for (let parent = node.parentElement; parent && parent !== main; parent = parent.parentElement) {
        const overflow = getComputedStyle(parent).overflowX;
        if (!/auto|scroll|hidden|clip/.test(overflow)) continue;
        const viewport = parent.getBoundingClientRect();
        if ((text.left < viewport.right - 1 && text.right > viewport.right + 1)
          || (text.right > viewport.left + 1 && text.left < viewport.left - 1)) return true;
      }
      return false;
    };
    const chartLabels = [...main.querySelectorAll<SVGGraphicsElement>(".fidelity-summary-pnl [data-direction-end]")]
      .filter((node) => {
        const card = node.closest(".fidelity-summary-pnl")?.getBoundingClientRect();
        return card && node.getBoundingClientRect().right > card.right - 8;
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { rule: "R7" as const, message: "summary chart end label touches its card border",
          boxes: [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }] };
      });
    return [
    ...[...main.querySelectorAll<HTMLElement>("strong, td, th, button, button span:not(:has(*)), [class*='value'], [class*='amount'], [class*='metric'], .fd-overview-kpis > div > span:not(.fd-label)")]
      .filter((node) => numeric.test((node.textContent ?? "").trim())
        && (node.tagName !== "BUTTON" || !node.childElementCount)
        && node.clientWidth > 0 && !node.closest("[data-layout-exempt*='R7:']")
        && (crossesCell(node) || partlyClipped(node) || [...node.childNodes].some((child) => {
          if (child.nodeType !== Node.TEXT_NODE || !numeric.test((child.textContent ?? "").trim())) return false;
          const text = child.textContent ?? "";
          const ranges = /^[+\-−]?\s*[¥$€£]?\s*[\d,]+(?:\.\d+)?%?$/.test(text.trim())
            ? [{ index: 0, length: text.length }]
            : [...text.matchAll(/[+\-−]?[¥$€£]\s*\d[\d,]*(?:\.\d+)?/g)]
              .map((match) => ({ index: match.index ?? 0, length: match[0].length }));
          return ranges.some(({ index, length }) => {
            const range = document.createRange();
            range.setStart(child, index);
            range.setEnd(child, index + length);
            const lines = [...range.getClientRects()];
            return lines.some((line) => Math.abs(line.y - lines[0].y) > 1);
          });
        }) || (node.childElementCount > 0 && /^[+\-−]?\s*[¥$€£]\s*\d[\d,]*(?:\.\d+)?$/.test((node.textContent ?? "").trim())
          && (() => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            const lines: DOMRect[] = [];
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(walker.currentNode);
              lines.push(...[...range.getClientRects()].filter((line) => line.width > 0 && line.height > 0));
            }
            return lines.some((line) => Math.abs(line.y - lines[0].y) > 8);
          })())))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { rule: "R7" as const, message: `${node.tagName.toLowerCase()}.${node.classList[0] ?? ""} amount clips or wraps: ${(node.textContent ?? "").trim().slice(0, 60)}`,
          boxes: [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }] };
      }), ...chartLabels];
  });
}

export async function contentBox(page: Page): Promise<Box> {
  return page.locator("#app-main-content").evaluate((main) => {
    const rect = main.getBoundingClientRect(), style = getComputedStyle(main);
    const left = parseFloat(style.paddingLeft), right = parseFloat(style.paddingRight);
    const top = parseFloat(style.paddingTop), bottom = parseFloat(style.paddingBottom);
    return { x: rect.x + left, y: rect.y + top,
      width: main.clientWidth - left - right, height: main.scrollHeight - top - bottom };
  });
}

export async function assertListBounds(page: Page): Promise<Violation[]> {
  return page.locator("#app-main-content").evaluate((main) =>
    [...main.querySelectorAll<HTMLElement>(
      "table tbody, [role='list'], [role='grid'], .t3-sources-list, .t3-top-body, .wallet-source-change-list, .analyze-source-picker, .fd-wallet-chips, .fd-wallet-balances, .fd-wallet-status, .wallet-asset-change-mobile, .fd-wallet-movers, .fd-wallet-legend, .wallet-asset-change-scroll thead tr, .fidelity-source-group, .ios-d3-source-group, .t3-fidelity-source-card",
    )]
      .filter((list) => {
        if (list.closest("[data-layout-exempt*='R6:']")) return false;
        const pager = list.closest("section, [data-ui-card]")?.querySelector(
          "[data-layout-pager], [class*='pager'], [class*='pagination'], [aria-label*='page' i]");
        const pageSize = Number(list.dataset.layoutPageSize);
        if (pageSize > 0) {
          const rendered = Number(list.dataset.layoutRendered ?? list.children.length);
          const total = Number(list.dataset.layoutTotal ?? rendered);
          return rendered > pageSize || total > pageSize && !pager;
        }
        return list.children.length > 50 || list.children.length > 10 && !pager;
      })
      .map((list) => {
        const r = list.getBoundingClientRect();
        return { rule: "R6" as const, message: `${list.tagName.toLowerCase()}.${list.classList[0] ?? ""} renders ${list.children.length} rows without a visible cap`,
          boxes: [{ x: r.x, y: r.y, width: r.width, height: r.height }] };
      }));
}
