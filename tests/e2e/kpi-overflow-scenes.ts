import type { Page } from "@playwright/test";

export const routes = [
  "overview", "summary", "comparison", "cost-basis", "wallets",
  "rebalance", "coins/BTC?assetType=crypto", "goals", "history",
];
export const mobileRouteRoot: Record<string, string> = {
  overview: ".fd-overview, .overview-sections",
  summary: ".d2-summary",
  comparison: ".fd-comparison, .d2-comparison",
  "cost-basis": ".d2-cost",
  wallets: ".fd-wallets, .d2-wallets",
  rebalance: ".pf-rebalance, .ios-d3-rebalance",
  "coins/BTC?assetType=crypto": ".d2-coin",
  goals: ".pf-goals, .ios-d3-goals",
  history: ".fidelity-history, .t3-manage-history",
};

export async function findKpiOverflows(page: Page) {
  return page.evaluate(() => {
    const selector = "[class*=kpi], [class*=summary-strip], [class*=metric], [class*=comparison-total], .t3-goals-summary, .t3-rebalance-summary, .t3-hero-value, .t3-pnl-compact-card, .analyze-comparison, .analyze-wallets";
    const root = document.querySelector("#app-main-content")!;
    const visible = (node: Element) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && style.visibility === "visible" && style.display !== "none";
    };
    const label = (node: Element) =>
      `${node.className || node.tagName}: ${(node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 45)}`;
    const failures: string[] = [];
    const marked = [...root.querySelectorAll(selector)].filter(visible);
    for (const node of marked) {
      const style = getComputedStyle(node);
      if (style.display !== "inline" && node.scrollWidth > node.clientWidth + 1)
        failures.push(`${label(node)} scrolls ${node.scrollWidth - node.clientWidth}px`);
    }
    const largeAmounts = [...root.querySelectorAll("*")].filter((node) => {
      if (node.children.length > 0 || !node.textContent?.trim()) return false;
      const style = getComputedStyle(node);
      return Number.parseFloat(style.fontSize) >= 24 && style.whiteSpace === "nowrap" && visible(node);
    });
    const metricAmounts = marked.filter((node) =>
      [...node.classList].some((name) => name.endsWith("-metric")))
      .map((node) => node.querySelector(":scope > strong"))
      .filter((node): node is Element => node !== null && visible(node));
    const amounts = [...new Set([...largeAmounts, ...metricAmounts])];
    for (const amount of amounts) {
      const column = amount.parentElement!;
      const box = column.getBoundingClientRect();
      const style = getComputedStyle(column);
      const range = document.createRange();
      range.selectNodeContents(amount);
      const text = range.getBoundingClientRect();
      const right = box.right - Number.parseFloat(style.paddingRight);
      const left = box.left + Number.parseFloat(style.paddingLeft);
      const kpiColumn = column.matches("[class*=kpi], [class*=metric]") ||
        column.parentElement?.matches("[class*=kpi], [class*=summary-strip]");
      if (amount.scrollWidth > amount.clientWidth + 1 ||
        (kpiColumn && column.scrollWidth > column.clientWidth + 1) ||
        text.left < left - 1 || text.right > right + 1)
        failures.push(`${label(amount)} exceeds ${label(column)} (scroll ${column.scrollWidth - column.clientWidth}px, text ${Math.round(Math.max(text.right - right, left - text.left))}px)`);
      const next = column.nextElementSibling;
      if (!next || !visible(next)) continue;
      const nextBox = next.getBoundingClientRect();
      if (Math.abs(nextBox.y - box.y) > 1) continue;
      const divider = Number.parseFloat(getComputedStyle(next).borderLeftWidth);
      if (divider && text.right > nextBox.left + 1)
        failures.push(`${label(amount)} crosses divider by ${Math.round(text.right - nextBox.left)}px`);
      const nextAmount = next.querySelector("strong, b, [class*=value]");
      if (nextAmount) {
        const nextText = document.createRange();
        nextText.selectNodeContents(nextAmount);
        const sibling = nextText.getBoundingClientRect();
        if (text.right > sibling.left) failures.push(`${label(amount)} intersects ${label(nextAmount)}`);
      }
    }
    return { inspected: marked.length + amounts.length, failures };
  });
}

