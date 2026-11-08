import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { installTauriBridge, seedFidelityCompletedSync } from "./fidelity-bridge-captures";

test.use({ viewport: { width: 1600, height: 1024 }, colorScheme: "dark", timezoneId: "UTC" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00.000Z"));
  await page.addInitScript(() => localStorage.setItem("track3-cost-basis-settings",
    JSON.stringify({ from: "2026-01-01", to: "2026-12-31", holdingPeriodDays: 365 })));
});

const directory = "/tmp/fidelity-desktop/cost-basis";
const backupDirectory = "/tmp/fidelity-wdb-locked/cost-basis";
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
  await seedFidelityCompletedSync(page);
  const stamp = page.locator(".fidelity-page-head .desktop-sync-status-indicator button");
  await expect(stamp).toHaveText("Synced 09:41");
  const box = (await stamp.boundingBox())!;
  expect(box.x).toBeCloseTo(1341, 0);
  expect(box.y).toBeCloseTo(46, 0);
  expect(box.width).toBeCloseTo(92, 0);
  const iconBox = (await stamp.locator(".fd-sync-cloud-icon").boundingBox())!;
  expect(iconBox.x).toBeGreaterThanOrEqual(box.x);
  await expect(stamp).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.getByRole("status", { name: /Loading/i })).toHaveCount(0);
  await expect(page.getByTestId("cost-desktop-table")).toBeVisible();
  await expect.poll(() => page.locator(".fidelity-cost").evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement)
      opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  })).toBe(1);
  await mkdir(directory, { recursive: true });
  await mkdir(backupDirectory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(`${directory}/${name}.json`, JSON.stringify(await page.evaluate(() => {
    const selectors = [".fidelity-holding-rule", ".fidelity-holding-rule > span", ".fidelity-holding-rule input",
      ".fidelity-cost-empty", ".fidelity-cost-empty > div", ".fidelity-cost-empty button",
      ".fidelity-cost-table", ".fidelity-export-popover p"];
    return Object.fromEntries(selectors.map((selector) => [selector,
      [...document.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          marginTop: style.marginTop, gap: style.gap, fontSize: style.fontSize, lineHeight: style.lineHeight };
      })]));
  }), null, 2));
  const screenshot = await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true, animations: "disabled" });
  await writeFile(`${backupDirectory}/${name}.png`, screenshot);
}

async function openCostBasis(page: Page) {
  await installTauriBridge(page, { fidelityRecords: "cost" });
  await page.goto("/#/cost-basis");
  await expect(page.getByRole("heading", { name: "Cost basis", exact: true })).toBeVisible();
  await expect(page.getByTestId("cost-desktop-table")).toBeVisible();
  await expect(page.getByRole("status", { name: /Loading/i })).toHaveCount(0);
}

test("FIFO report and data gaps table", async ({ page }) => {
  await openCostBasis(page);
  await expect(page.locator('a[href="#/goals"] > span[aria-hidden="true"]')).toBeVisible();
  await expect(page.locator(".fidelity-cost-warning")).toHaveCSS("background-color", "rgb(42, 36, 22)");
  await expect(page.getByText("Stablecoin swaps appear when their cost basis is known.")).toBeVisible();
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Dispositions");
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Withdrawn 18 Sep 2026");
  await expect(page.getByRole("table", { name: "Data gaps to review" })).toBeVisible();
  await expect(page.locator(".fidelity-cost-filters")).toHaveCSS("margin-top", "16px");
  await expect.poll(async () => (await page.locator(".fidelity-cost-filters").boundingBox())!.y).toBeCloseTo(88, 0);
  await expect.poll(async () => (await page.getByTestId("cost-desktop-table").boundingBox())!.y).toBeCloseTo(864.5, 0);
  await expect(page.locator("[data-ai-setup-card]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Tax year" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".t3-topbar-ranges")).toHaveCount(0);
  await expect(page.locator(".t3-date-trigger")).toHaveCount(0);
  await expect(page.getByLabel("Tax year")).toHaveValue("2026");
  await expect(page.locator(".fidelity-cost-chart .fidelity-card-head")).toContainText("USD, 2026");
  await expect(page.locator(".fidelity-cost-warning")).toContainText("left Binance on");
  await expect(page.getByRole("link", { name: "Review withdrawal" }))
    .toHaveAttribute("href", "#/coins/SOL?assetType=crypto");
  await expect(page.locator(".fidelity-metric strong").first())
    .toHaveCSS("font-variant-numeric", "normal");
  await expect(page.locator(".fidelity-cost-kpi-secondary strong").first())
    .toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.locator(".fidelity-holding-track").first())
    .toHaveCSS("background-color", "rgb(42, 42, 46)");
  const rowLabels = await page.getByTestId("cost-desktop-table").locator("tbody tr td:first-child").allTextContents();
  expect(rowLabels.slice(0, 3)).toEqual(["BTC", "BTC subtotal", "ETH"]);
  expect(await page.locator(".fidelity-cost-averages tbody td:first-child").allTextContents())
    .toEqual(["BTC", "ETH", "SOL", "BNB", "AAPL", "NVDA"]);
  const subtotal = page.locator(".fidelity-subtotal").first();
  await expect(subtotal.locator("td").first()).toHaveAttribute("colspan", "3");
  await expect(page.locator(".fidelity-total td").first()).toHaveAttribute("colspan", "3");
  await expect(subtotal.locator("td").nth(4)).toHaveClass(/pos|neg|zero/);
  const subtotalTag = subtotal.locator(".t3-tag");
  await expect(subtotalTag).toHaveCSS("font-weight", "500");
  const tagContrast = await subtotalTag.evaluate((node) => {
    const rgb = (value: string) => [...value.matchAll(/[\d.]+/g)].slice(0, 3).map(([number]) => Number(number));
    const linear = (value: number) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: string) => rgb(color).reduce((sum, value, index) =>
      sum + [0.2126, 0.7152, 0.0722][index] * linear(value), 0);
    const style = getComputedStyle(node);
    const [low, high] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
    return (high + 0.05) / (low + 0.05);
  });
  expect(tagContrast).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator(".fidelity-subtotal").filter({ hasText: "SOL subtotal" }).locator("td").last())
    .toBeEmpty();
  const acquired = (await page.locator(".fidelity-cost-table th").nth(1).boundingBox())!;
  await expect(page.locator(".fidelity-cost-table th").first()).toHaveCSS("font-size", "12px");
  expect(acquired.x).toBeCloseTo(185, 0);
  expect((await page.locator(".fidelity-cost-table th").first().boundingBox())!.width).toBeCloseTo(80, 0);
  expect((await page.locator(".fidelity-cost-table th").last().boundingBox())!.width).toBeCloseTo(90, 0);
  const chartTrack = page.locator(".fidelity-cost-chart-track").first();
  await expect(chartTrack).toHaveCSS("--zero-at", "4%");
  expect(await chartTrack.locator("i").evaluate((bar) => (bar as HTMLElement).style.width)).toBe("92%");
  await capture(page, "cost-basis");
});

test("average cost shows unavailable holding periods", async ({ page }) => {
  await openCostBasis(page);
  await page.getByRole("button", { name: "Average cost" }).click();
  await expect.poll(async () => (await page.locator(".fidelity-cost-kpis").boundingBox())!.height).toBe(256);
  await expect(page.getByTestId("cost-desktop-holding")).toContainText("Not available");
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Dispositions 7");
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Open lots 6");
  await expect(page.getByRole("table").nth(0)).toContainText("$58,311.50");
  for (const term of await page.locator(".fidelity-subtotal td:last-child").all())
    await expect(term).toBeEmpty();
  await capture(page, "cost-basis-avg");
});

test("custom range keeps dates and HIFO", async ({ page }) => {
  await openCostBasis(page);
  await page.getByRole("button", { name: "HIFO" }).click();
  await page.getByRole("button", { name: "Custom range" }).click();
  await page.getByLabel("From").fill("2026-07-01");
  await page.getByLabel("To", { exact: true }).fill("2026-10-31");
  await expect(page.locator(".fidelity-cost-filters .fidelity-filter-group").last().locator(":scope > span:last-of-type"))
    .toBeVisible();
  const dateInput = (await page.locator(".fidelity-cost-filters .fidelity-date-input").first().boundingBox())!;
  expect(dateInput.width).toBeCloseTo(132, 0);
  await expect(page.locator(".fidelity-cost-filters .fidelity-date-input > span").first()).toHaveCSS("font-size", "13px");
  expect(dateInput.x).toBeGreaterThan((await page.locator(".fidelity-cost-filters").boundingBox())!.x);
  await expect(page.locator(".fidelity-cost-filters .fidelity-segment").first()).toHaveCSS("gap", "0px");
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Dispositions 5");
  await page.getByRole("heading", { name: "Cost basis" }).click();
  const eth = (await page.locator(".fidelity-cost-chart li").filter({ hasText: /^ETH/ }).locator("i").boundingBox())!;
  const nvda = (await page.locator(".fidelity-cost-chart li").filter({ hasText: /^NVDA/ }).locator("i").boundingBox())!;
  expect(eth.x + eth.width).toBeLessThanOrEqual(nvda.x + 1);
  const unknownTrack = page.locator(".fidelity-cost-chart li").filter({ hasText: /^SOL/ }).locator(".fidelity-cost-chart-track");
  expect(await unknownTrack.evaluate((node) => getComputedStyle(node, "::before").left)).toBe("0px");
  await capture(page, "cost-basis-custom");
});

test("empty tax year retains open lots and chart empty state", async ({ page }) => {
  await openCostBasis(page);
  await page.getByRole("button", { name: "Tax year" }).click();
  await page.getByLabel("Tax year").fill("2025");
  await expect(page.getByText("No sales in 2025")).toBeVisible();
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Open lots");
  expect(await page.locator(".fidelity-cost-averages tbody td:first-child").allTextContents())
    .toEqual(["BTC", "ETH", "SOL", "BNB", "AAPL", "NVDA"]);
  await page.getByRole("button", { name: /Open lots/ }).click();
  await expect(page.getByTestId("cost-desktop-table")).not.toContainText("2026");
  await page.getByRole("button", { name: /Dispositions/ }).click();
  await page.getByRole("heading", { name: "Cost basis" }).click();
  const chartEmpty = (await page.locator(".fidelity-cost-chart .fidelity-empty").boundingBox())!;
  expect(chartEmpty.height).toBeCloseTo(276.5, 0);
  const tableEmpty = (await page.locator(".fidelity-cost-empty").boundingBox())!;
  expect(tableEmpty.height).toBeCloseTo(218.5, 0);
  expect(tableEmpty.y).toBeGreaterThan(chartEmpty.y);
  expect((await page.getByRole("button", { name: "Show open lots" }).boundingBox())!.y).toBeCloseTo(1015, 0);
  expect(await page.evaluate(() => document.getElementById("app-main-content")!.scrollHeight)).toBe(1172);
  expect((await page.getByTestId("cost-desktop-table").boundingBox())!.height).toBeCloseTo(308.5, 0);
  await capture(page, "cost-basis-empty");
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("track3-cost-basis-settings") ?? "{}").from)).toBe("2025-01-01");
  await page.getByRole("button", { name: "Records controls" }).click();
  await page.locator(".t3-records-settings-link").click();
  await expect(page).toHaveURL(/#\/settings/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("link", { name: "Cost basis" }).click();
  await expect(page).toHaveURL(/#\/cost-basis/, { timeout: 15_000 });
  await expect(page.getByLabel("Tax year")).toHaveValue("2025", { timeout: 15_000 });
});

test("export popover explains both file formats", async ({ page }) => {
  await openCostBasis(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText("Export CSV")).toBeVisible();
  await expect(page.getByText("Export JSON")).toBeVisible();
  await expect(page.locator(".fidelity-export-popover")).toContainText("8 realized disposition rows");
  await expect(page.locator(".fidelity-export-popover > button").first().locator("svg")).toHaveCSS("width", "18px");
  await expect(page.locator(".fidelity-export-popover")).toHaveCSS("background-color", "rgb(19, 18, 23)");
  await expect(page.locator(".fidelity-export-popover > button").first()).toHaveCSS("background-color", "rgb(24, 24, 27)");
  await capture(page, "cost-basis-export");
});

test("open lots uses the held and unrealized columns", async ({ page }) => {
  await openCostBasis(page);
  await page.getByRole("button", { name: /Open lots/ }).click();
  await expect(page.getByTestId("cost-desktop-table")).toContainText("Unrealized");
  await expect(page.locator(".fidelity-subtotal").first().locator("td").first()).toHaveAttribute("colspan", "3");
  await expect(page.locator(".fidelity-subtotal").filter({ hasText: "SOL subtotal" }).locator("td").last())
    .toHaveText("Mixed");
  await expect(page.locator(".fidelity-subtotal").filter({ hasText: "SOL subtotal" }).getByText("withdrawal unmatched"))
    .toHaveCSS("color", "rgb(155, 157, 163)");
  expect((await page.locator(".fidelity-cost-table th").nth(1).boundingBox())!.x).toBeCloseTo(185, 0);
  await capture(page, "cost-basis-open");
});

test("cost table headings align with their data and holding days can be edited", async ({ page }) => {
  await openCostBasis(page);
  const averages = page.locator(".fidelity-cost-averages");
  await expect(averages.locator("th").first()).toHaveCSS("padding-left", "0px");
  await expect(averages.locator("th").nth(1)).toHaveCSS("text-align", "right");
  await expect(page.getByLabel("Tax year")).toHaveCSS("font-size", "13px");
  await expect(averages.locator("td .zero").first()).toHaveCSS("color", "rgb(155, 157, 163)");
  await expect(page.locator(".fidelity-cost-gaps th").nth(2)).toHaveCSS("text-align", "right");
  await expect(page.locator(".fidelity-cost-gaps tbody tr:not(.fidelity-gap-group) td").nth(2))
    .toHaveCSS("text-align", "right");
  await expect(page.locator(".fidelity-cost-table th").first()).toHaveCSS("padding-left", "0px");
  const rule = (await page.locator(".fidelity-holding-rule").boundingBox())!;
  expect(rule.x).toBeCloseTo(1218, 0);
  expect(rule.y).toBeCloseTo(111, 0);
  expect(rule.height).toBeCloseTo(18, 0);
  const field = page.getByRole("spinbutton", { name: "Long-term after (days)" });
  expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(20);
  await expect(field).toHaveCSS("opacity", "1");
  await expect(field).toHaveCSS("text-align", "left");
  expect(await page.locator(".fidelity-holding-rule > span").evaluate((span) => {
    const field = span.querySelector("input")!;
    const after = field.nextSibling!;
    const range = document.createRange();
    range.setStart(after, 1);
    range.setEnd(after, 2);
    return range.getBoundingClientRect().left - field.getBoundingClientRect().right;
  })).toBeGreaterThan(2);
  await field.fill("400");
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("track3-cost-basis-settings") ?? "{}").holdingPeriodDays)).toBe(400);
  await expect(field).toHaveValue("400");
  await expect(page.locator(".fidelity-holding-rule")).toContainText("Long-term means held more than");
});

test("Chinese locale formats selected range dates in Chinese", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page, { fidelityRecords: "cost" });
  await page.goto("/#/cost-basis");
  await expect(page.locator(".fidelity-page-head p")).toContainText("1月");
});

test("records controls keep live total, refresh, and assistant setup available", async ({ page }) => {
  await openCostBasis(page);
  const controls = page.getByRole("button", { name: "Records controls" });
  await expect(controls).toHaveAttribute("aria-expanded", "false");
  await controls.click();
  await expect(controls).toHaveAttribute("aria-expanded", "true");
  const tools = page.locator(".t3-records-toolbar-panel");
  await expect(tools.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(tools.getByRole("button", { name: "Show real-time portfolio value" })).toBeVisible();
  await expect(page.locator("[data-ai-setup-card]")).toBeVisible();
});

test("a saved full current tax year still shows the tax-year control", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "track3-cost-basis-settings";
    const settings = { from: "2026-01-01", to: "2026-12-31", holdingPeriodDays: 365 };
    window.localStorage.setItem(key, JSON.stringify(settings));
  });
  await openCostBasis(page);
  await expect(page.getByRole("button", { name: "Tax year" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Tax year")).toHaveValue("2026");
});

test("Cost basis has one sync status control when sync is enabled", async ({ page }) => {
  await installTauriBridge(page, { fidelityRecords: "cost", seedLockedSync: true });
  await page.goto("/#/cost-basis");
  await expect(page.getByTestId("cost-desktop-table")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".fidelity-page-head .desktop-sync-status-indicator")).toHaveCount(1);
  await expect(page.locator(".desktop-sync-status-indicator")).toHaveCount(1);
});

test("light cost basis cards use the light theme surface", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await openCostBasis(page);
  await expect(page.locator(".fidelity-card").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".fidelity-page-head h1")).toHaveCSS("color", "rgb(23, 23, 28)");
});
