import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("desktop starts dark without storing a theme and preserves a stored light theme", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem("track3-ui-theme"))).toBe("light");
});

test("desktop rail keeps routes and exposes grouped labelled navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  const rail = page.locator("aside");
  await expect(rail).toHaveCSS("width", "56px");
  await rail.getByRole("link", { name: "Overview" }).hover();
  await expect(page.getByRole("tooltip", { name: "Overview" })).toBeVisible();
  await rail.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(rail.getByText("Analyze", { exact: true })).toBeVisible();
  await expect(rail.getByText("Manage", { exact: true })).toBeVisible();
  await expect(rail).toHaveCSS("width", "216px");
  await rail.getByRole("link", { name: "Cost basis" }).click();
  await expect(page).toHaveURL(/#\/cost-basis$/);
  await rail.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(rail).toHaveCSS("width", "56px");
});

test("shared controls use Terminal geometry in both themes", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(page.locator("[data-ui-card]").first()).toHaveCSS("border-radius", "6px");
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCSS("border-radius", "999px");
    expect(await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Public Sans");
  }
});

test("desktop source status keeps long rows separate inside its scroll area after refresh", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(
    ["Main exchange", "Solana wallet", "Cold storage", "Brokerage", "Others"].map((label, index) => ({
      sourceId: `source:${index}`, label, status: "failed", kind: "others",
      lastSuccessAt: "2026-10-22T00:00:00Z",
    })),
  )));
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Refresh" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Source status" });
  await expect(dialog).toBeVisible();
  const rows = dialog.locator("[data-source-status-row]");
  await expect(rows).toHaveCount(5);
  const content = await rows.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.firstElementChild!.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  for (let index = 1; index < content.length; index++) {
    expect(content[index].top, `row ${index + 1} overlaps row ${index}`).toBeGreaterThanOrEqual(content[index - 1].bottom);
  }
});

test("daily changes follow the selected overview range", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.locator(".t3-daily-column")).toHaveCount(59);
  const changeHeader = page.locator(".t3-top-head").getByText("Change");
  await expect(changeHeader).toBeVisible();
  expect((await changeHeader.boundingBox())!.height).toBeLessThanOrEqual(18);
  await page.getByRole("button", { name: "Last 10 Times" }).click();
  await expect(page.locator(".t3-daily-column")).toHaveCount(9);
  await expect(page.locator(".t3-daily-panel")).toContainText("Last 9 changes");
});

test("What moved labels the number of available snapshots", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.locator(".t3-moved-panel")).toContainText("Last 2 snapshots");
});

test("overview hero value styling survives an extra content element", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  const value = page.locator(".t3-total-overview [data-ui-card] .font-mono").first();
  await expect(value).toBeVisible();
  await value.evaluate((node) => {
    const notice = document.createElement("div");
    notice.setAttribute("aria-hidden", "true");
    node.parentElement!.prepend(notice);
  });
  expect(await value.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(32);
});
