import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { FakeS3 } from "../../src/middlelayers/sync/object-store";

const routes = [
  "/overview", "/summary", "/wallets", "/comparison", "/rebalance",
  "/goals", "/history", "/cost-basis", "/assistant", "/coins/BTC?assetType=crypto",
  "/settings/configuration", "/settings/appearance", "/settings/data",
  "/settings/systemInfo", "/settings/assistant", "/settings/sync",
];

async function contrastOnWhite(text: Locator): Promise<number> {
  return text.evaluate((node) => {
    const [red, green, blue, opacity = 1] = getComputedStyle(node).color.match(/[\d.]+/g)!.map(Number);
    const linear = (value: number) => {
      const channel = (value * opacity + 255 * (1 - opacity)) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    return 1.05 / (luminance + 0.05);
  });
}

for (const width of [360, 768]) for (const route of routes) {
  test(`${route} at ${width}px has no automated accessibility violations or page overflow`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 740 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installTauriBridge(page);
    await page.goto(`/#${route}`);
    await expect(page.locator("main")).toBeVisible();
    try {
      await expect(page.locator("main > div")).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
    } catch {
      throw new Error(`Initialization stalled on ${route}: ${page.url()}; ${pageErrors.join("; ")}`);
    }
    try {
      await expect(page.locator("main h1, main h2").first()).toBeVisible();
    } catch {
      throw new Error(`Missing page heading on ${route}: ${page.url()}; ${pageErrors.join("; ")}`);
    }
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.html} ${node.failureSummary}`).join(", ")}`)).toEqual([]);
    const overflow = await page.evaluate((viewportWidth) => ({
      width: document.documentElement.scrollWidth,
      offenders: Array.from(document.querySelectorAll("*"))
        .filter((element) => element.getBoundingClientRect().right > viewportWidth + 1)
        .slice(0, 12).map((element) => `${element.tagName} ${element.textContent?.trim().slice(0, 80)} ${element.getBoundingClientRect().x}`),
    }), width);
    expect(overflow.width, overflow.offenders.join("\n")).toBeLessThanOrEqual(width);
    if (width === 360) {
      const small = await page.locator("main button, main a, main input, main select, aside button, aside a, header button, header a").evaluateAll((controls) =>
        controls.filter((control) => {
          const style = getComputedStyle(control);
          const box = control.getBoundingClientRect();
          if (box.width === 0 || box.height === 0 || style.opacity === "0" || control.classList.contains("sr-only")) return false;
          const labelledBy = control.id ? document.querySelector(`label[for="${control.id}"]`) : control.closest("label");
          const labelBox = labelledBy?.getBoundingClientRect();
          return (box.width < 44 || box.height < 44) && !(labelBox && labelBox.width >= 44 && labelBox.height >= 44);
        }).slice(0, 12).map((control) => `${control.tagName} ${control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 35)} ${Math.round(control.getBoundingClientRect().width)}x${Math.round(control.getBoundingClientRect().height)}`));
      expect(small, route).toEqual([]);
    }
  });
}

test("shared delete dialog stays in the viewport and restores focus after Escape", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.goto("/#/history");
  await expect(page.getByText("Total 2 records")).toBeVisible();
  const trigger = page.getByTestId("history-delete-latest");
  await trigger.locator("xpath=ancestor::tr").hover();
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id }) => id)).toEqual([]);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(await dialog.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("navigation follows visual order and shows a keyboard focus ring", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeAttached();
  const skip = page.getByRole("link", { name: "Skip to main content" });
  const overview = page.getByRole("link", { name: "Overview" });
  const summary = page.getByRole("link", { name: "Summary" });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  expect(await skip.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(overview).toBeFocused();
  expect(await overview.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.locator("main").evaluate((node) => node.contains(document.activeElement))).toBe(true);
});

test("date picker popover fits a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Choose date range" }).click();
  const popover = page.locator("[data-radix-popper-content-wrapper]");
  await expect(popover).toBeVisible();
  const box = await popover.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const small = await popover.locator("button").evaluateAll((buttons) =>
    buttons.filter((button) => {
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
    }).slice(0, 5).map((button) => `${button.textContent?.trim()} ${Math.round(button.getBoundingClientRect().width)}x${Math.round(button.getBoundingClientRect().height)}`));
  expect(small).toEqual([]);
});

test("comparison controls announce localized actions", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page);
  await page.goto("/#/comparison");
  await expect(page.getByRole("button", { name: "隐藏金额" })).toBeVisible();
  await page.getByRole("button", { name: /基准日期/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("overview charts expose text summaries", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const charts = page.locator("main canvas");
  await expect(charts.first()).toBeVisible();
  for (const chart of await charts.all()) {
    await expect(chart).toHaveAttribute("role", "img");
    await expect(chart).toHaveAttribute("aria-label", /.+/);
  }
});

for (const width of [360, 768]) {
  test(`expanded P&L attribution at ${width}px passes axe without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installTauriBridge(page);
    await page.goto("/#/summary");
    await expect(page.getByRole("heading", { name: "Summary", exact: true })).toBeAttached();
    await page.getByRole("radio", { name: "Attribution" }).click();
    await expect(page.getByRole("radio", { name: "Attribution" })).toHaveAttribute("data-state", "checked");
    await expect(page.getByText("Attribution details")).toBeAttached();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("expanded overview and asset charts expose text summaries", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Show More" }).click();
  await expect(page.getByText("Coins Percentage Overview")).toBeVisible();
  for (const route of ["/overview", "/wallets", "/coins/BTC?assetType=crypto"]) {
    if (route !== "/overview") await page.goto(`/#${route}`);
    await expect(page.locator("main canvas").first()).toBeVisible();
    const unnamed = await page.locator("main canvas").evaluateAll((canvases) =>
      canvases.filter((canvas) => canvas.getAttribute("role") !== "img" || !canvas.getAttribute("aria-label")?.trim()).length);
    expect(unnamed, route).toBe(0);
  }
});

test("expanded Overview content passes axe with its percentage rows visible", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, undefined, true);
  await page.goto("/#/overview");
  await expect(page.getByRole("region", { name: "Insights" }).getByRole("link", { name: "Ask the assistant" })).toBeVisible();
  await page.getByRole("button", { name: "Show More" }).click();
  await expect(page.locator("[data-testid='tcpc-row']").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary}`).join(", ")}`)).toEqual([]);
});

test("assistant with pinned and recent sessions passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await installTauriBridge(page, undefined, true);
  await page.goto("/#/assistant");
  await expect(page.getByText("Pinned portfolio review")).toBeVisible();
  await expect(page.getByText("Recent portfolio review")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("small muted text in assistant sessions and expanded Overview meets AA contrast", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, undefined, true);
  await page.goto("/#/assistant");
  await expect(page.getByText("Pinned portfolio review")).toBeVisible();
  for (const label of ["Pinned", "Recent"]) {
    expect(await contrastOnWhite(page.getByText(label, { exact: true })), label).toBeGreaterThanOrEqual(4.5);
  }
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Show More" }).click();
  await expect(page.locator("[data-testid='tcpc-row']").first()).toBeVisible();
  for (const locator of [
    page.getByText("Value % · Price %"),
    page.locator("[data-testid='tcpc-header-price']"),
    page.locator("[data-testid='tcpc-price'][data-active='false']").first(),
  ]) expect(await contrastOnWhite(locator)).toBeGreaterThanOrEqual(4.5);
});

test("mobile switch track and thumb share a center line", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  const track = page.getByRole("switch", { name: "Path style addressing" });
  await expect(track).toBeVisible();
  const centers = await track.evaluate((node) => {
    const trackStyle = getComputedStyle(node, "::before");
    const thumb = node.firstElementChild!.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { track: box.top + parseFloat(trackStyle.top) + parseFloat(trackStyle.height) / 2,
      thumb: thumb.top + thumb.height / 2 };
  });
  expect(Math.abs(centers.track - centers.thumb), JSON.stringify(centers)).toBeLessThanOrEqual(0.5);
});

test("history first cell retains row hover feedback", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/history");
  const row = page.getByTestId("history-snapshot-row").first();
  const firstCell = row.locator("td").first();
  const before = await firstCell.evaluate((node) => getComputedStyle(node).backgroundColor);
  await row.hover();
  const after = await firstCell.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(after).not.toBe(before);
});

test("P&L rank column moves with its table instead of pinning", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page, undefined, true);
  await page.goto("/#/summary");
  const table = page.getByText("Top Profit", { exact: true }).locator("xpath=..").getByRole("table");
  await expect(table).toBeVisible();
  const wrapper = table.locator("xpath=..");
  const rank = table.locator("td").first();
  await wrapper.evaluate((node) => { node.style.width = "80px"; });
  expect(await rank.evaluate((node) => getComputedStyle(node).position)).not.toBe("sticky");
});

test("configuration dialog fits mobile width and passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.goto("/#/settings/configuration");
  const trigger = page.getByRole("button", { name: "Add Exchange Configuration" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add Exchange Configuration" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const closeBox = await dialog.getByRole("button", { name: "Close" }).boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary}`).join(", ")}`)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("remaining configuration editors have named controls", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.goto("/#/settings/configuration");
  for (const name of ["Add Stock Broker", "Add Wallet Configuration", "Add Symbol"]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map(({ id, nodes }) => `${name}: ${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
});

test("visible mobile controls provide 44px touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  const undersized: string[] = [];
  for (const route of ["/overview", "/rebalance", "/goals", "/history", "/assistant", "/settings/sync"]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("main > div")).toHaveAttribute("aria-busy", "false");
    await expect(({
      "/overview": page.locator('main h1:text-is("Overview")'),
      "/rebalance": page.locator('main h1:text-is("Rebalance")'),
      "/goals": page.locator('main h1:text-is("Goals & Alerts")'),
      "/history": page.locator('main h1:text-is("Historical Data")'),
      "/assistant": page.getByTestId("chat-input"),
      "/settings/sync": page.getByText("S3 endpoint", { exact: true }),
    } as Record<string, ReturnType<typeof page.locator>>)[route]).toBeAttached();
    const small = await page.locator("main button, main a, main input, main select, aside button, aside a, header button, header a").evaluateAll((controls) =>
      controls.filter((control) => {
        const style = getComputedStyle(control);
        const box = control.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && style.opacity !== "0" &&
          (box.width < 44 || box.height < 44) && !control.classList.contains("sr-only");
      }).slice(0, 12).map((control) => `${control.tagName} ${control.getAttribute("aria-label") ?? control.textContent?.trim().slice(0, 35)} ${Math.round(control.getBoundingClientRect().width)}x${Math.round(control.getBoundingClientRect().height)}`));
    undersized.push(...small.map((item) => `${route}: ${item}`));
  }
  expect(undersized).toEqual([]);
});

test("assistant composer controls meet the mobile touch target size", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/assistant");
  const send = page.getByTestId("chat-send");
  await expect(send).toBeVisible();
  const box = await send.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("reduced motion stops repeated animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/overview");
  const styles = await page.evaluate(() => {
    const sample = document.createElement("span");
    sample.className = "animate-spin";
    document.body.append(sample);
    const computed = getComputedStyle(sample);
    const result = {
      duration: computed.animationDuration,
      iterations: computed.animationIterationCount,
    };
    sample.remove();
    return result;
  });
  expect(styles.iterations).toBe("1");
  expect(parseFloat(styles.duration)).toBeLessThanOrEqual(0.001);
});

test("sync status popover stays visible and announces state", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page, new FakeS3());
  await page.goto("/#/settings/sync");
  for (const [label, value] of [
    ["S3 endpoint", "https://s3.example.test"], ["Region", "us-east-1"],
    ["Bucket", "track3"], ["Access key ID", "key"], ["Secret access key", "secret"],
    ["Sync passphrase", "correct horse battery staple"], ["Confirm sync passphrase", "correct horse battery staple"],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Enable sync" }).click();
  const trigger = page.getByRole("button", { name: "Sync idle" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const popover = page.locator("[data-radix-popper-content-wrapper]").last();
  await expect(popover).toBeVisible();
  const box = await popover.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary}`).join(", ")}`)).toEqual([]);
});

test("wide cost basis tables keep their first column visible while scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/cost-basis");
  const table = page.locator("main table").first();
  await expect(table).toBeVisible();
  const wrapper = table.locator("xpath=..");
  const widths = await wrapper.evaluate((node) => ({ scroll: node.scrollWidth, visible: node.clientWidth }));
  expect(widths.scroll).toBeGreaterThan(widths.visible);
  const first = table.locator("th").first();
  const before = await first.boundingBox();
  await wrapper.evaluate((node) => { node.scrollLeft = 150; });
  const after = await first.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
});

test("summary detail dialog fits and passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/summary");
  await page.getByRole("button", { name: "2", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

test("history detail dialog exposes virtual table rows and passes axe", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/history");
  await page.getByRole("button", { name: /View snapshot from/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Historical Data Detail" });
  await expect(dialog).toBeVisible();
  const table = dialog.getByRole("table");
  await expect(table).toHaveAttribute("aria-rowcount", /[2-9]/);
  await expect(dialog.getByTestId("history-detail-row").first()).toHaveAttribute("aria-rowindex", "2");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

test("rebalance target editor fits the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await installTauriBridge(page);
  await page.goto("/#/rebalance");
  await page.getByRole("button", { name: "Equal weight" }).click();
  await expect(page.getByRole("button", { name: /Remove target/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("refresh status dialog fits and has no axe violations", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Refresh" }).click();
  const trigger = page.getByRole("button", { name: "Source status" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Source status" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
});
