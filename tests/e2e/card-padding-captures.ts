import { expect, type Page } from "@playwright/test";

export const cardRoutes = [
  ["Overview", "/overview"],
  ["Summary", "/summary"],
  ["Wallets", "/wallets"],
  ["Comparison", "/comparison"],
  ["Cost basis", "/cost-basis"],
  ["History", "/history"],
  ["Rebalance", "/rebalance"],
  ["Goals", "/goals"],
  ["Assistant", "/assistant"],
  ["Settings appearance", "/settings/appearance"],
  ["Settings currency", "/settings/configuration?section=currency"],
  ["Settings data", "/settings/data?section=backup"],
  ["Settings system", "/settings/systemInfo?section=about"],
  ["Settings AI", "/settings/assistant"],
  ["Settings sync", "/settings/sync"],
  ["Coin detail", "/coins/BTC"],
] as const;

export async function cardPaddingMeasurements(page: Page) {
  return page.evaluate(() => {
    // Edge-to-edge media may opt out with data-flush="image" or data-flush="chart".
    const isFlushMedia = (card: Element) => ["image", "chart"].includes(card.getAttribute("data-flush") ?? "");
    const namedCards = [
      "[data-ui-card]", ".t3-fidelity-card", ".fidelity-card", ".coin-fidelity-card",
      ".t3-b-card", ".t3-wallet-card", ".t3-cmp-card", ".t3-flow-card",
      ".t3-progress-card", ".pf-card", ".mobile-card", ".mobile-record-list",
      ".t3-goals-drawer", ".t3-cmp-picker-popover", ".mobile-sheet",
    ].join(",");
    const inset = (child: Element) => {
      const box = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      return {
        top: box.top + parseFloat(style.paddingTop),
        right: box.right - parseFloat(style.paddingRight),
        bottom: box.bottom - parseFloat(style.paddingBottom),
        left: box.left + parseFloat(style.paddingLeft),
      };
    };
    return Array.from(document.querySelectorAll<HTMLElement>("div,section,article,aside,dialog")).flatMap((card) => {
      const popover = card.getAttribute("role") === "dialog" && !!card.querySelector(".rdp,.t3-cmp-calendar");
      const named = card.matches(namedCards) || popover;
      const first = card.firstElementChild;
      const last = card.lastElementChild;
      if (card.matches(".t3-goals-drawer")) {
        const head = card.querySelector<HTMLElement>(".t3-fidelity-drawer-head");
        const foot = card.querySelector<HTMLElement>(".t3-fidelity-drawer-foot");
        if (!head || !foot) return [];
        const box = card.getBoundingClientRect();
        const top = inset(head);
        const bottom = inset(foot);
        return [{
          card: "Goals drawer",
          heading: head.querySelector("h2")?.textContent?.trim(),
          edges: {
            top: Math.round((top.top - box.top) * 10) / 10,
            right: Math.round((box.right - top.right) * 10) / 10,
            bottom: Math.round((box.bottom - bottom.bottom) * 10) / 10,
            left: Math.round((top.left - box.left) * 10) / 10,
          },
          flush: isFlushMedia(card),
          depth: 2,
        }];
      }
      const sheet = card.matches(".mobile-sheet");
      const headings = "h2,h3,h4,legend";
      const heading = popover ? first : sheet ? card.querySelector(headings)
        : first?.matches(`${headings},[class*="-card-head"],[class*="-section-head"],.fidelity-segments`)
          ? first : first?.querySelector(headings);
      if (!first || !last || !heading) return [];
      let depth = 0;
      for (let node: Element | null = heading; node && node !== card; node = node.parentElement) depth++;
      const style = getComputedStyle(card);
      const box = card.getBoundingClientRect();
      const bordered = ["Top", "Right", "Bottom", "Left"].every(
        (side) => parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 0.5,
      ) && parseFloat(style.borderTopLeftRadius) >= 4;
      if (style.display === "none" || box.width < 120 || box.height < 40 || !named && !bordered ||
        style.backgroundColor === "rgba(0, 0, 0, 0)" && !bordered) return [];
      let header = heading.parentElement;
      while (header && header !== card) {
        const headerStyle = getComputedStyle(header);
        if (parseFloat(headerStyle.paddingLeft) >= 12 || parseFloat(headerStyle.paddingRight) >= 12) break;
        header = header.parentElement;
      }
      const start = inset(header && header !== card ? header : first);
      let tail = last;
      while (tail.lastElementChild && parseFloat(getComputedStyle(tail).paddingBottom) < 12 &&
        tail.getBoundingClientRect().bottom >= box.bottom - 2) tail = tail.lastElementChild;
      const end = inset(tail);
      const edges = {
        top: Math.round(((sheet ? start.top : start.top - box.top < 12
          ? Math.max(start.top, heading.getBoundingClientRect().top) : start.top) - box.top) * 10) / 10,
        right: Math.round((box.right - start.right) * 10) / 10,
        bottom: Math.round((parseFloat(style.paddingBottom) >= 12
          ? parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth)
          : box.bottom - end.bottom) * 10) / 10,
        left: Math.round((start.left - box.left) * 10) / 10,
      };
      return [{
        card: popover ? "date picker popover" : card.getAttribute("data-ai-setup-card") !== null ? "AI setup" :
          `${card.tagName.toLowerCase()}.${String(card.className).trim().replace(/\s+/g, ".").slice(0, 100)}`,
        heading: heading.textContent?.trim().slice(0, 60),
        edges,
        flush: isFlushMedia(card),
        depth,
      }];
    });
  });
}

export async function expectAiSetupGeometry(page: Page) {
  const card = page.locator("[data-ai-setup-card]");
  await expect(card).toBeVisible({ timeout: 30_000 });
  const geometry = await card.evaluate((element) => {
    const rect = (target: Element) => target.getBoundingClientRect();
    const outer = rect(element);
    const content = element.firstElementChild!;
    const contentStyle = getComputedStyle(content);
    const header = rect(content.firstElementChild!);
    const icon = rect(content.querySelector("svg")!);
    const title = rect(content.querySelector("h2")!);
    const form = rect(content.querySelector("form")!);
    const input = rect(content.querySelector("input")!);
    const inputStyle = getComputedStyle(content.querySelector("input")!);
    const sendButton = content.querySelector("form button")!;
    const send = rect(sendButton);
    const suggestions = content.querySelector("[data-ai-setup-suggestion]")!.parentElement!;
    const chips = rect(suggestions);
    const chipButton = content.querySelector("[data-ai-setup-suggestion]")!;
    const chip = rect(chipButton.querySelector(".ai-setup-chip-label") ?? chipButton);
    return {
      padding: [contentStyle.paddingTop, contentStyle.paddingRight, contentStyle.paddingBottom, contentStyle.paddingLeft],
      headerHeight: header.height, iconHeight: icon.height, iconGap: title.left - icon.right,
      iconCenterError: Math.abs((icon.top + icon.bottom) / 2 - (title.top + title.bottom) / 2),
      topInset: header.top - outer.top, titleGap: form.top - header.bottom,
      inputHeight: input.height, inputPadding: inputStyle.paddingLeft,
      sendHeight: send.height, sendVisualHeight: parseFloat(getComputedStyle(sendButton, "::before").height),
      sendBorderWidth: parseFloat(getComputedStyle(sendButton).borderTopWidth),
      sendGap: send.left - input.right, chipsGap: chips.top - form.bottom,
      chipHeight: chip.height, chipHitHeight: rect(chipButton).height, chipRowGap: getComputedStyle(suggestions).rowGap,
      rightInset: outer.right - Math.max(send.right, chips.right),
      bottomInset: outer.bottom - chips.bottom,
    };
  });
  const phone = page.viewportSize()!.width === 390;
  expect(geometry.padding).toEqual(phone ? ["14px", "14px", "14px", "14px"] : ["16px", "20px", "16px", "20px"]);
  expect(geometry.headerHeight).toBeGreaterThanOrEqual(24);
  expect(geometry.iconHeight).toBe(16);
  expect(geometry.iconGap).toBe(8);
  expect(geometry.iconCenterError).toBeLessThanOrEqual(1);
  expect(geometry.titleGap).toBe(12);
  expect(geometry.inputHeight).toBe(40);
  expect(geometry.inputPadding).toBe("12px");
  expect(geometry.sendHeight).toBe(phone ? 44 : 40);
  if (phone) expect(geometry.sendVisualHeight).toBe(40);
  if (phone) expect(geometry.sendBorderWidth).toBe(0);
  expect(geometry.sendGap).toBe(8);
  expect(geometry.chipsGap).toBe(12);
  expect(geometry.chipHeight).toBe(28);
  expect(geometry.chipHitHeight).toBe(phone ? 44 : 28);
  expect(geometry.chipRowGap).toBe("8px");
  expect(geometry.topInset).toBeGreaterThanOrEqual(phone ? 14 : 16);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(phone ? 14 : 20);
  expect(geometry.bottomInset).toBeGreaterThanOrEqual(phone ? 14 : 16);
  await card.locator("input").focus();
  await page.keyboard.press("Tab");
  const chip = card.locator("[data-ai-setup-suggestion]").first();
  await expect(chip).toBeFocused();
  const focusClearance = await chip.evaluate((element) => {
    const style = getComputedStyle(element);
    let clearance = Infinity;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX) ||
        ["hidden", "clip", "auto", "scroll"].includes(style.overflowY)) {
        const box = element.getBoundingClientRect();
        const clip = parent.getBoundingClientRect();
        clearance = Math.min(clearance, box.left - clip.left, clip.right - box.right,
          box.top - clip.top, clip.bottom - box.bottom);
      }
      if (parent === document.querySelector("[data-ai-setup-card]")) break;
    }
    return { ring: style.boxShadow, outline: style.outlineStyle, focusVisible: element.matches(":focus-visible"), clearance };
  });
  expect(focusClearance.focusVisible).toBe(true);
  expect(focusClearance.ring !== "none" || focusClearance.outline === "solid").toBe(true);
  expect(focusClearance.clearance).toBeGreaterThanOrEqual(3);
}
