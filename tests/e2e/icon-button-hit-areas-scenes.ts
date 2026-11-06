import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/track3-icon-hit-areas";
const capture = process.env.ICON_HIT_CAPTURE ?? "after";
export function registerIconButtonHitAreaTests() {
test.use({ reducedMotion: "reduce" });

test("Overview total card icon hit areas match their visible icons across widths, themes, and zooms", async ({ page }, info) => {
  test.setTimeout(300_000);
  test.skip(info.project.name !== "desktop");
  mkdirSync(output, { recursive: true });
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  const report = [];
  for (const theme of ["dark", "light"]) {
    for (const width of [1100, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#/overview");
      await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await page.reload();
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await expect(page.locator(".t3-total-overview .t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
      for (const zoom of [1, 1.5]) {
        await page.evaluate((value) => { document.documentElement.style.setProperty("zoom", String(value)); }, zoom);
        const controls = await page.locator(".t3-total-overview .t3-hero-header button:has(svg)").evaluateAll((buttons) =>
          buttons.map((button) => {
            const svg = button.querySelector("svg")!;
            const icon = svg.getBoundingClientRect();
            const box = button.getBoundingClientRect();
            const sample = (name: string, x: number, y: number) => {
              const hit = document.elementFromPoint(x, y);
              return { name, x, y, hit: hit?.tagName.toLowerCase() ?? null,
                className: typeof hit?.className === "string" ? hit.className : "",
                owner: hit === button || button.contains(hit), };
            };
            const cx = icon.left + icon.width / 2;
            const cy = icon.top + icon.height / 2;
            return {
              label: button.getAttribute("aria-label"), box: box.toJSON(), icon: icon.toJSON(),
              points: [
                sample("center", cx, cy),
                sample("top", cx, icon.top + 1),
                sample("bottom", cx, icon.bottom - 1),
                sample("left", icon.left + 1, cy),
                sample("right", icon.right - 1, cy),
                sample("above-6", cx, icon.top - 6),
                sample("below-6", cx, icon.bottom + 6),
                sample("left-6", icon.left - 6, cy),
                sample("right-6", icon.right + 6, cy),
              ],
            };
          }));
        report.push({ theme, width, zoom, controls });
        if (width === 1280 && zoom === 1) {
          await expect(page.locator(".t3-grid-hero")).toHaveCSS("opacity", "1");
          await page.locator(".t3-total-overview").hover();
          await page.locator(".t3-total-overview .t3-hero-header button:has(svg)").evaluateAll((buttons) =>
            buttons.forEach((button) => { (button as HTMLElement).style.outline = "2px solid magenta"; }));
          const header = page.locator(".t3-total-overview .t3-hero-header");
          await header.evaluate((element) => {
            (element as HTMLElement).style.zIndex = "auto";
            (element as HTMLElement).style.pointerEvents = "auto";
            const icon = element.querySelector("svg")!.getBoundingClientRect();
            const hit = document.elementFromPoint(icon.left + icon.width / 2, icon.top + icon.height / 2);
            if (hit instanceof HTMLElement) hit.style.outline = "2px solid cyan";
          });
          await page.screenshot({ path: `${output}/overview-before-${theme}.png` });
          await header.evaluate((element) => {
            (element as HTMLElement).style.removeProperty("z-index");
            (element as HTMLElement).style.removeProperty("pointer-events");
            document.querySelectorAll<HTMLElement>(".t3-pnl-compact *").forEach((item) => item.style.removeProperty("outline"));
          });
          const percentButton = page.getByRole("button", { name: "Show percentage change in chart" });
          await percentButton.hover();
          await expect(percentButton).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
          await page.screenshot({ path: `${output}/overview-after-${theme}.png` });
        }
      }
    }
  }
  writeFileSync(`${output}/overview-${capture}.json`, JSON.stringify(report, null, 2));
  const failures = report.flatMap(({ theme, width, zoom, controls }) =>
    controls.flatMap(({ label, box, points }) => [
      ...((box.width < 32 * zoom || box.height < 32 * zoom) ? [`${theme} ${width} ${zoom} ${label}: ${box.width}x${box.height}`] : []),
      ...points.filter((point) => !point.owner).map((point) => `${theme} ${width} ${zoom} ${label}: ${point.name} hit ${point.hit}.${point.className}`),
    ]));
  expect(failures).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.setProperty("zoom", "1"); });
  const percent = page.getByRole("button", { name: "Show percentage change in chart" });
  const base = page.getByRole("button", { name: "Switch total value base currency" });
  await expect(percent).toHaveAttribute("aria-pressed", "false");
  await expect(base).toHaveAttribute("aria-pressed", "false");
  await percent.click();
  await base.click();
  await expect(percent).toHaveAttribute("aria-pressed", "true");
  await expect(base).toHaveAttribute("aria-pressed", "true");
});

test("coarse pointers keep Overview and History icon targets separate", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    reducedMotion: "reduce", timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/overview");
    await expect(page.locator(".t3-total-overview .t3-hero-value")).toContainText("$763,809.27");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    const overviewBoxes = await page.locator(".t3-total-overview .t3-hero-header button:has(svg)")
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
    expect(overviewBoxes).toHaveLength(2);
    for (const box of overviewBoxes) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.goto("/?coarseHistory=1#/history");
    const deletes = page.locator(".fidelity-history-detail td:first-child button.t3-icon-button");
    await expect(deletes).toHaveCount(8);
    const boxes = await deletes.evaluateAll((buttons) => buttons.map((button) =>
      button.getBoundingClientRect().toJSON()));
    for (const [index, box] of boxes.entries()) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      if (index > 0) expect(box.top, `delete targets ${index - 1} and ${index} overlap`)
        .toBeGreaterThanOrEqual(boxes[index - 1].bottom);
    }
  } finally {
    await context.close();
  }
});

test("History delete icons stay inside the symbol cell and clear long quantities", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width: 1501, height: 1024 });
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/history");
  const deletes = page.locator(".fidelity-history-detail td:first-child button.t3-icon-button");
  await expect(deletes).toHaveCount(8);
  await page.locator(".fidelity-history-detail tbody tr:not(.fidelity-history-total) td:nth-child(2)")
    .first().evaluate((cell) => { cell.textContent = "123,456,789.0000"; });
  const overlaps = await deletes.evaluateAll((buttons) => buttons.slice(0, 3).flatMap((button) => {
    const symbol = button.parentElement?.firstChild;
    if (!symbol) return [];
    const range = document.createRange();
    range.selectNodeContents(symbol);
    const icon = button.getBoundingClientRect();
    const label = range.getBoundingClientRect();
    const cell = button.parentElement!.getBoundingClientRect();
    const quantity = button.parentElement!.nextElementSibling!.getBoundingClientRect();
    return [
      ...(icon.right > cell.right ? [`${symbol.textContent} delete button leaves symbol cell`] : []),
      ...(label.right + 2 > icon.left && label.left < icon.right ? [`${symbol.textContent} overlaps delete button`] : []),
      ...(icon.right > quantity.left ? [`${symbol.textContent} delete button enters quantity cell`] : []),
    ];
  }));
  expect(overlaps).toEqual([]);
});

test("Overview icon button uses one focus indicator", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/overview");
  const button = page.getByRole("button", { name: "Show percentage change in chart" });
  await button.focus();
  await expect(button).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  await expect(button).not.toHaveCSS("box-shadow", "none");
});

test("Goals renders its controls for the icon audit at 1280px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/?iconAudit=7#/goals");
  await expect(page.getByTestId("goals-summary")).toBeVisible();
  await expect(page.getByText("Loading goals...")).toHaveCount(0);
  await expect(page.locator(".t3-desktop-error")).toHaveCount(0);
});

test("icon-only controls on every main page have unobstructed hit areas", async ({ browser }, info) => {
  test.setTimeout(300_000);
  const mobile = info.project.name === "mobile";
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    isMobile: mobile, hasTouch: mobile,
    userAgent: mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
  });
  const page = await context.newPage();
  const routes = [
    "overview", "summary", "wallets", "comparison", "cost-basis", "history",
    "rebalance", "goals", "assistant", "settings/configuration", "settings/appearance",
    "settings/data", "settings/systemInfo", "settings/assistant", "settings/sync", "coins/BTC",
  ];
  const ready: Record<string, string> = {
    overview: mobile ? ".fd-overview[data-state=ready]" : ".t3-total-overview .t3-hero-value",
    summary: ".fidelity-summary[aria-busy=false], .analyze-summary[aria-busy=false], .fd-summary[data-state=ready]",
    wallets: ".analyze-wallets[aria-busy=false]",
    comparison: ".analyze-comparison[aria-busy=false]",
    "cost-basis": ".fidelity-cost, .d2-cost",
    history: "[data-testid=history-content][aria-busy=false]",
    rebalance: "[data-testid=rebalance-summary]",
    goals: "[data-testid=goals-summary]",
    assistant: "[data-testid=assistant-not-configured], [data-testid=chat-card], [data-testid=assistant-upgrade], [data-testid=assistant-error]",
    "settings/configuration": mobile ? ".ios-d3-sources" : ".t3-settings-content h3",
    "settings/appearance": mobile ? ".ios-d3-mobile-appearance" : ".t3-settings-appearance-content",
    "settings/data": mobile ? ".ios-d3-data-settings" : ".t3-settings-content h3",
    "settings/systemInfo": mobile ? ".ios-d3-system-settings, #app-main-content h3" : ".t3-settings-content h3",
    "settings/assistant": "[data-testid=assistant-endpoint]",
    "settings/sync": ".sync-settings-page",
    "coins/BTC": ".coin-fidelity, .fd-coin[data-state=ready]",
  };
  const countIconControls = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("button, [role=button], a")]
    .filter((element) => element.querySelector("svg") && !element.innerText.trim()
      && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none"
      && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0).length);
  const report = [];
  const layoutFailures: string[] = [];
  try {
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelitySample: "full" });
    for (const [routeIndex, route] of routes.entries()) {
      await page.goto(`/?iconAudit=${routeIndex}#/${route}`);
      await expect(page.locator("#app-main-content"), route).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(ready[route]).first(), `${route} content`).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.locator('#app-main-content [role="status"].absolute.inset-0')).toHaveCount(0, { timeout: 30_000 });
      if (route === "goals")
        await expect(page.getByText("Loading goals...")).toHaveCount(0, { timeout: 30_000 });
      if (route === "history" && !mobile)
        await expect(page.locator(".fidelity-history-detail td:first-child button.t3-icon-button")).toHaveCount(8);
      if (route === "settings/configuration")
        await expect.poll(countIconControls, { timeout: 30_000 }).toBeGreaterThanOrEqual(mobile ? 8 : 30);
      let previousCount = -1;
      let steadySince = Date.now();
      await expect.poll(async () => {
        const error = page.getByRole("heading", { name: "Something went wrong" });
        if (await error.count()) {
          const summary = await page.locator(".t3-desktop-error pre").textContent();
          throw new Error(`${route} rendered the error screen: ${summary?.split("\n")[0] ?? ""}`);
        }
        const count = await countIconControls();
        if (count !== previousCount) { previousCount = count; steadySince = Date.now(); }
        return Date.now() - steadySince >= 1500;
      }, { message: `${route} icon count did not stabilize`, timeout: 30_000, intervals: [250] }).toBe(true);
      await expect(page.getByRole("heading", { name: "Something went wrong" }), route).toHaveCount(0);
      const controls = await page.evaluate(() => {
        const interactive = (element: Element) => element.matches("button, [role=button], a");
        const hasLabeledHitTarget = (element: HTMLElement) => {
          if (!element.matches("[role=radio], [role=checkbox]")) return false;
          const control = element.getBoundingClientRect();
          return !!element.id && [...document.querySelectorAll<HTMLLabelElement>("label[for]")]
            .some((label) => {
              const box = label.getBoundingClientRect();
              return label.htmlFor === element.id && box.width * box.height > control.width * control.height
                && getComputedStyle(label).pointerEvents !== "none";
            });
        };
        const elements = [...document.querySelectorAll<HTMLElement>("button, [role=button], a")]
          .filter((element) => element.querySelector("svg") && !element.innerText.trim()
            // Appearance radios use linked, larger labels as their hit targets.
            && !hasLabeledHitTarget(element)
            && getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none"
            && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
        return elements.map((element, index) => {
          element.scrollIntoView({ block: "center", inline: "nearest" });
          const box = element.getBoundingClientRect();
          const svg = element.querySelector("svg")!;
          const icon = svg.getBoundingClientRect();
          const sample = (x: number, y: number) => {
            const hit = document.elementFromPoint(x, y);
            return { x, y, owner: hit === element || element.contains(hit),
              hit: hit?.tagName.toLowerCase() ?? null,
              hitClass: typeof hit?.className === "string" ? hit.className : "" };
          };
          const disabled = element.matches(":disabled");
          const points = disabled ? [] : [
            sample(icon.left + icon.width / 2, icon.top + icon.height / 2),
            sample(icon.left + icon.width / 2, icon.top + icon.height * .1),
            sample(icon.left + icon.width / 2, icon.bottom - icon.height * .1),
            sample(icon.left + icon.width * .1, icon.top + icon.height / 2),
            sample(icon.right - icon.width * .1, icon.top + icon.height / 2),
          ];
          const overlaps = disabled ? [] : [...document.querySelectorAll("button, [role=button], a")]
            .filter((other) => other !== element && interactive(other) && getComputedStyle(other).visibility !== "hidden")
            .filter((other) => {
              const r = other.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && box.left < r.right && box.right > r.left
                && box.top < r.bottom && box.bottom > r.top;
            }).map((other) => `${other.tagName.toLowerCase()}.${typeof other.className === "string" ? other.className : ""}`);
          return { index, tag: element.tagName.toLowerCase(), className: element.className, disabled,
            label: element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "",
            box: box.toJSON(), icon: icon.toJSON(), points, overlaps };
        });
      });
      report.push({ route, controls });
      if (route === "history" && !mobile) {
        const deletes = page.locator(".fidelity-history-detail td:first-child button.t3-icon-button");
        await expect(deletes).toHaveCount(8);
        layoutFailures.push(...await deletes.evaluateAll((buttons) => buttons.slice(0, 3).flatMap((button) => {
          const symbol = button.parentElement?.firstChild;
          if (!symbol) return [];
          const range = document.createRange();
          range.selectNodeContents(symbol);
          return range.getBoundingClientRect().right + 2 > button.getBoundingClientRect().left
            ? [`${symbol.textContent} overlaps its delete button`] : [];
        })));
        await deletes.first().evaluate((button) => button.scrollIntoView({ block: "center" }));
        await deletes.evaluateAll((buttons) =>
          buttons.forEach((button) => {
            (button as HTMLElement).style.opacity = "1";
            (button as HTMLElement).style.outline = "2px solid magenta";
            (button as HTMLElement).style.width = "24px";
            (button as HTMLElement).style.height = "24px";
          }));
        await page.screenshot({ path: `${output}/history-delete-before.png` });
        await deletes.evaluateAll((buttons) =>
          buttons.forEach((button) => {
            (button as HTMLElement).style.removeProperty("width");
            (button as HTMLElement).style.removeProperty("height");
          }));
        await page.screenshot({ path: `${output}/history-delete-after.png` });
      }
    }
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/audit-${capture}-${info.project.name}.json`, JSON.stringify(report, null, 2));
    if (!mobile)
      expect(report.find(({ route }) => route === "history")?.controls.filter(({ label }) => label.startsWith("Delete ")).length).toBe(8);
    expect(report.find(({ route }) => route === "settings/configuration")?.controls.length)
      .toBeGreaterThanOrEqual(mobile ? 8 : 30);
    expect(report.find(({ route }) => route === "assistant")?.controls.some(({ disabled }) => disabled)).toBe(true);
    const failures = report.flatMap(({ route, controls }) => controls.flatMap((control) => [
      ...(control.box.width < (mobile ? 44 : 28) || control.box.height < (mobile ? 44 : 28)
        ? [`${route}: ${control.label || control.className} is ${control.box.width}x${control.box.height}`] : []),
      ...control.points.filter((point) => !point.owner)
        .map((point) => `${route}: ${control.label || control.className} hit ${point.hit}.${point.hitClass}`),
      ...control.overlaps.map((other) => `${route}: ${control.label || control.className} intersects ${other}`),
    ]));
    expect([...failures, ...layoutFailures]).toEqual([]);
  } finally {
    await context.close();
  }
});
}
