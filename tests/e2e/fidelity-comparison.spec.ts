import { expect, test, type Browser } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { analyzePage, captureLong } from "./fidelity-analyze-scenes";

test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

async function openComparison(browser: Browser) {
  const { context, page } = await analyzePage(browser, "comparison");
  await expect(page.getByRole("heading", { name: "Comparison", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "30 days" }).click();
  await expect(page.getByRole("button", { name: "30 days" })).toHaveClass(/selected/);
  await expect(page.getByRole("button", { name: "Snapshot A: 1 Oct 2026" })).toBeVisible();
  return { context, page };
}

test("Comparison renders the October sample pair and ordered asset sections", async ({ browser }) => {
  const { context, page } = await openComparison(browser);
  try {
    const heading = (await page.getByRole("heading", { name: "Comparison", exact: true }).boundingBox())!;
    expect(heading.y).toBe(14);
    await expect(page.getByRole("heading", { name: "Snapshots" })).toBeVisible();
    await expect(page.getByText("$729,167.79").first()).toBeVisible();
    await expect(page.locator(".fd-comparison-asset").filter({ hasText: "NVDA" })
      .locator(".t3-asset-icon")).toHaveAttribute("data-kind", "stock");
    await expect(page.locator(".fd-comparison-field button b").first()).toHaveCSS("font-size", "13px");
    await expect(page.locator(".fd-comparison-kpis strong").first()).toHaveCSS("line-height", "22px");
    expect((await page.locator(".fd-comparison-snapshots").boundingBox())?.height).toBe(531);
    expect((await page.locator(".fd-comparison-assets").boundingBox())?.y).toBe(667);
    expect((await page.locator(".fd-comparison-assets").boundingBox())?.height).toBe(936);
    expect((await page.locator(".fd-comparison-asset").first().boundingBox())?.y).toBe(748);
    expect((await page.locator(".fd-comparison-asset").first().boundingBox())?.height).toBe(84);
    expect((await page.locator(".fd-comparison-asset").first().boundingBox())?.x).toBe(33);
    expect((await page.locator(".fd-comparison-asset").nth(1).boundingBox())?.height).toBe(85);
    expect((await page.locator(".fd-comparison-info").boundingBox())?.height).toBe(80);
    expect((await page.locator(".fd-comparison-info > div").boundingBox())?.height).toBe(54);
    await expect(page.locator(".fd-comparison-info")).toHaveCSS("border-color", "rgb(31, 58, 92)");
    expect((await page.locator(".fd-comparison-mover.percent").first().boundingBox())?.height).toBe(44);
    const columns = await page.locator(".fd-comparison-movers.percent .fd-comparison-mover-list").first().evaluate((list) => getComputedStyle(list).gridTemplateColumns);
    expect(columns).toBe("88px 160px 64px");
    await expect(page.locator(".fd-comparison-mover.percent").first()).toHaveCSS("grid-template-columns", /^subgrid/);
    const zero = Number((await page.locator(".fd-comparison-mover.percent").first().locator(":scope > span").first().getAttribute("style"))?.match(/--fd-zero: ([\d.]+)%/)?.[1]);
    expect(zero).toBe(15);
    await page.screenshot({ path: "/tmp/fidelity/comparison/comparison-phone.png" });
    writeFileSync("/tmp/fidelity/comparison/info-styles.json", JSON.stringify(await page.locator(".fd-comparison-info").evaluate((element) =>
      [element, ...element.querySelectorAll("*")].map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { tag: node.tagName, text: node.textContent?.slice(0, 30), x: rect.x, y: rect.y + document.getElementById("app-main-content")!.scrollTop,
          width: rect.width, height: rect.height, font: style.font, color: style.color, border: style.borderColor };
      })), null, 2));
    writeFileSync("/tmp/fidelity/comparison/geometry.json", JSON.stringify(await page.evaluate(() =>
      [...document.querySelectorAll(".fd-comparison-head,.fd-comparison-snapshots,.fd-comparison-field,.fd-comparison-quick,.fd-comparison-kpis,.fd-comparison-assets,.fd-comparison-asset,.fd-comparison-info,.fd-comparison-movers")]
        .map((element) => ({ selector: element.className, y: element.getBoundingClientRect().y + document.getElementById("app-main-content")!.scrollTop,
          h: element.getBoundingClientRect().height }))), null, 2));
    await captureLong(page, "/tmp/fidelity/comparison/comparison-phone-long.png");
  } finally { await context.close(); }
});

test("Comparison opens a calendar to choose snapshot A", async ({ browser }) => {
  const { context, page } = await openComparison(browser);
  try {
    await page.getByRole("button", { name: "Snapshot A: 1 Oct 2026" }).click();
    await expect(page.getByRole("dialog", { name: "Choose snapshot A" })).toBeVisible();
    await expect(page.locator(".fd-comparison-picker")).toHaveCSS("font-variant-numeric", "tabular-nums");
    expect((await page.locator(".fd-comparison-picker .mobile-sheet-handle").boundingBox())?.y).toBe(377);
    await expect(page.locator(".fd-comparison-field button").first()).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({ path: "/tmp/fidelity/comparison/comparison-picker-phone.png" });
    expect((await page.locator(".fd-comparison-selected").boundingBox())?.y).toBe(729);
  } finally { await context.close(); }
});

test("Comparison value-mask icon has a phone-size touch target", async ({ browser }) => {
  const { context, page } = await openComparison(browser);
  try {
    const box = await page.getByRole("button", { name: "Hide values" }).boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBe(true);
    const price = page.locator(".fd-comparison-asset").first().locator(":scope > span").first();
    const visiblePrice = await price.textContent();
    expect(visiblePrice).toContain("$");
    await page.getByRole("button", { name: "Hide values" }).click();
    await expect(page.locator(".fd-comparison-asset").first().locator("strong")).toHaveText("***");
    await expect(price).toHaveText(visiblePrice!);
  } finally { await context.close(); }
});

test("Comparison calendar weekdays use the phone locale", async ({ browser }) => {
  const { context, page } = await openComparison(browser);
  try {
    await page.evaluate(() => localStorage.setItem("track3-ui-locale", "zh"));
    await page.reload();
    await page.locator(".fd-comparison-field button").first().click();
    await expect(page.locator(".fd-comparison-weekdays")).toContainText("周一");
  } finally { await context.close(); }
});

test("Comparison can select a later snapshot from the same day", async ({ browser }) => {
  const { context, page } = await openComparison(browser);
  try {
    await page.evaluate(async () => {
      const invoke = (window as any).__e2eInvoke;
      const rows = await invoke("plugin:sql|select", {
        query: "SELECT DISTINCT uuid, createdAt FROM assets_v2 ORDER BY createdAt DESC LIMIT 2", values: [],
      });
      await invoke("plugin:sql|execute", {
        query: "UPDATE assets_v2 SET createdAt = ? WHERE uuid = ?",
        values: ["2026-10-31T08:30:00.000Z", rows[1].uuid],
      });
    });
    await page.reload();
    await page.locator(".fd-comparison-field button").first().click();
    const picker = page.getByRole("dialog", { name: "Choose snapshot A" });
    await picker.locator(".fd-comparison-days button").filter({ hasText: /^31$/ }).last().click();
    await expect(picker.getByRole("button", { name: "08:30" })).toBeVisible();
    await picker.getByRole("button", { name: "08:30" }).click();
    await picker.getByRole("button", { name: "Use this snapshot" }).click();
    await expect(page.locator(".fd-comparison-field button").first()).toContainText("08:30");
  } finally { await context.close(); }
});
