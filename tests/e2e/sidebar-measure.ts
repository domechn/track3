import type { Locator } from "@playwright/test";

export const sidebarRoutes = [
  "overview", "summary", "comparison", "wallets", "coins/BTC", "cost-basis",
  "history", "rebalance", "goals", "goals/kinds", "assistant", "settings",
  "settings/configuration", "settings/appearance", "settings/data",
  "settings/systemInfo", "settings/assistant", "settings/sync",
];

export type NavMeasure = Awaited<ReturnType<typeof measureNav>>;

export async function measureNav(nav: Locator, kind: "desktop" | "ipad" | "phone") {
  return nav.evaluate((node, kind) => {
    const active = node.querySelector<HTMLElement>(".t3-nav-item[aria-current='page']")!;
    const activeRect = active.getBoundingClientRect();
    const activeStyle = getComputedStyle(active);
    const bar = getComputedStyle(active, "::before");
    const navStyle = getComputedStyle(node);
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--sidebar-active-bg)";
    active.append(probe);
    const token = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const channel = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const mix = (foreground: string, background: string) => {
      const fg = channel(foreground), bg = channel(background), alpha = fg[3] ?? 1;
      return fg.slice(0, 3).map((v, i) => v * alpha + bg[i] * (1 - alpha));
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const x = v / 255;
        return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
      });
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const contrast = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + .05) / (lo + .05);
    };
    const base = channel(navStyle.backgroundColor);
    const activeContrast = contrast(channel(activeStyle.color), mix(activeStyle.backgroundColor, navStyle.backgroundColor));
    const inactiveContrasts = [...node.querySelectorAll<HTMLElement>(".t3-nav-item:not([aria-current='page'])")]
      .map((item) => contrast(channel(getComputedStyle(item).color), base));
    const selector = kind === "desktop"
      ? ":scope > div:first-child, nav .t3-nav-item svg, nav .t3-nav-divider, .t3-rail-footer svg, .t3-rail-footer, :scope > button:last-child svg"
      : kind === "ipad"
        ? ".mobile-rail-brand, .mobile-rail-item svg, .mobile-rail-group, .mobile-rail-footer, .mobile-sidebar-collapse svg"
        : ".mobile-tab-icon > svg:first-child";
    const boxes = [...node.querySelectorAll<HTMLElement>(selector)].map((item) => {
      const { x, y, width, height } = item.getBoundingClientRect();
      return [x, y, width, height];
    });
    const borderColor = kind === "phone" ? navStyle.borderTopColor : navStyle.borderRightColor;
    return {
      boxes,
      railBackground: navStyle.backgroundColor,
      borderColor,
      tile: [activeRect.width, activeRect.height],
      radius: activeStyle.borderTopLeftRadius,
      activeBackground: activeStyle.backgroundColor,
      token,
      bar: [parseFloat(bar.width), parseFloat(bar.height), activeRect.x + parseFloat(bar.left)],
      activeX: activeRect.x,
      activeContrast,
      inactiveContrast: Math.min(...inactiveContrasts),
    };
  }, kind);
}

export function expectSameGeometry(actual: NavMeasure, expected: NavMeasure, label: string) {
  if (actual.boxes.length !== expected.boxes.length) throw new Error(`${label}: navigation item count changed`);
  for (const [index, box] of actual.boxes.entries()) {
    for (const [axis, value] of box.entries()) {
      if (Math.abs(value - expected.boxes[index][axis]) > .5) {
        throw new Error(`${label}: item ${index}, axis ${axis} moved from ${expected.boxes[index][axis]} to ${value}`);
      }
    }
  }
  for (const [axis, value] of actual.tile.entries()) {
    if (Math.abs(value - expected.tile[axis]) > .5) throw new Error(`${label}: active tile size changed`);
  }
}
