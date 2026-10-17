import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("mouse layout stays compact at narrow and wide desktop widths", async ({ page }) => {
  await installTauriBridge(page);
  for (const width of [600, 800, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/#/settings/sync");
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(false);
    const settingsTab = page.getByRole("link", { name: "Sync", exact: true }).last();
    await expect(settingsTab).toBeVisible();
    expect((await settingsTab.boundingBox())!.height).toBeLessThanOrEqual(36);
    const track = page.getByRole("switch", { name: "Path style addressing" });
    expect((await track.boundingBox())!.height).toBe(20);
    expect((await page.getByRole("button", { name: "Enable sync" }).boundingBox())!.height).toBe(36);
    const sidebar = page.locator("aside").getByRole("link", { name: "Overview" });
    expect((await sidebar.boundingBox())!.height).toBeLessThanOrEqual(38);
    expect((await page.locator("aside").boundingBox())!.width).toBe(200);
    await page.goto("/#/settings/configuration");
    const labels = page.locator('label[for="groupUSD"], label[for="hideInactive"]');
    await expect(labels).toHaveCount(2);
    const switchRowPitch = await labels.evaluateAll(
      (labels) => labels[1].getBoundingClientRect().top - labels[0].getBoundingClientRect().top,
    );
    expect(switchRowPitch).toBeLessThanOrEqual(width === 600 ? 60 : 40);
    await page.goto("/#/assistant");
    const send = page.getByTestId("chat-send");
    await expect(send).toBeVisible();
    expect((await send.boundingBox())!.height).toBe(36);
  }
});

test("composer has one visible focus style that clears on blur", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/assistant");
  const input = page.getByTestId("chat-input");
  const box = input.locator("xpath=../..");
  await input.focus();
  expect(await input.evaluate((node) => getComputedStyle(node).boxShadow)).toBe("none");
  await expect.poll(() => box.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("0px 0px 0px 2px");
  await input.blur();
  await expect.poll(() => box.evaluate((node) => getComputedStyle(node).boxShadow)).not.toContain("0px 0px 0px 2px");
});

test("mouse session actions keep their compact size and hover reveal", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await installTauriBridge(page, undefined, true);
  await page.goto("/#/assistant");
  const pin = page.getByTestId("session-pin-pinned-e2e");
  await expect(pin).toBeAttached();
  expect((await pin.boundingBox())!.height).toBe(24);
  expect(await pin.locator("xpath=..").evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
});

test("mouse date popover opens with the original start alignment", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Choose date range" }).click();
  await expect(page.locator("[data-radix-popper-content-wrapper] [data-align]")).toHaveAttribute("data-align", "start");
  const options = page.getByRole("button", { name: /^(Last (10|30|50|100) Times|All)$/ });
  await expect(options).toHaveCount(5);
  const positions = await options.evaluateAll((buttons) => buttons.map((button) => ({
    x: button.getBoundingClientRect().x,
    y: button.getBoundingClientRect().y,
  })));
  expect(new Set(positions.map(({ x }) => x)).size).toBe(1);
  expect(new Set(positions.map(({ y }) => y)).size).toBe(5);
  expect((await page.locator("[data-radix-popper-content-wrapper]").boundingBox())!.width).toBeLessThan(450);
});

test("mouse cost basis column stays in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/cost-basis");
  await expect(page.getByRole("heading", { name: "Cost basis and realized P&L", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.innerHTML = '<table class="sticky-first-column"><thead><tr><th>Asset</th></tr></thead></table>';
    document.body.append(wrapper);
  });
  const firstCell = page.locator("body > .table-scroll th");
  await expect(firstCell).toBeVisible();
  expect(await firstCell.evaluate((node) => getComputedStyle(node).position)).toBe("static");
});

test("mouse refresh icon retains its margin below 640px", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/overview");
  const icon = page.getByRole("button", { name: "Refresh" }).locator("svg");
  await expect(icon).toBeVisible();
  expect(await icon.evaluate((node) => getComputedStyle(node).marginRight)).toBe("8px");
});

test("history snapshot rows keep their compact desktop height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriBridge(page);
  await page.goto("/#/history");
  const row = page.getByTestId("history-snapshot-row").first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(50);
});

test("mouse history dialog keeps its original width and unclipped layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await installTauriBridge(page);
  await page.goto("/#/history");
  const row = page.getByTestId("history-snapshot-row").first();
  await expect(row).toBeVisible();
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await dialog.boundingBox())!.width).toBe(1024);
  expect(await dialog.evaluate((node) => getComputedStyle(node).maxHeight)).toBe("none");
  expect(await dialog.evaluate((node) => getComputedStyle(node).overflow)).toBe("visible");
  const close = dialog.getByRole("button", { name: "Close" });
  expect(await close.evaluate((node) => getComputedStyle(node).display)).not.toBe("flex");
  await close.click();
  const tableFrame = row.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
  expect(await tableFrame.evaluate((node) => getComputedStyle(node).overflow)).toBe("hidden");
});

test("mouse alert dialogs retain their original overflow", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  await installTauriBridge(page);
  await page.goto("/#/history");
  const row = page.getByTestId("history-snapshot-row").first();
  await expect(row).toBeVisible();
  await row.hover();
  await page.getByTestId("history-delete-latest").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => getComputedStyle(node).maxHeight)).toBe("none");
  expect(await dialog.evaluate((node) => getComputedStyle(node).overflow)).toBe("visible");
});

test("collapsed mouse sidebar keeps its original padding", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  expect(await page.locator("aside nav").evaluate((node) => getComputedStyle(node).paddingLeft)).toBe("8px");
});

test("mouse settings labels keep their original native layout", async ({ page }) => {
  await installTauriBridge(page);
  for (const [route, id] of [
    ["/settings/appearance", "green-up-red-down"],
    ["/settings/configuration", "groupUSD"],
    ["/settings/data", "exportConfigurationCheckbox"],
  ]) {
    await page.goto(`/#${route}`);
    const label = page.locator(`label[for="${id}"]`);
    await expect(label).toBeVisible();
    expect(await label.evaluate((node) => getComputedStyle(node).display)).toBe("block");
  }
});

test.describe("coarse pointer", () => {
  test.use({ isMobile: true, hasTouch: true });

  test("controls have touch targets at wide and narrow widths", async ({ page }) => {
    await installTauriBridge(page);
    for (const width of [600, 800, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#/settings/sync");
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      await expect(page.getByRole("link", { name: "Sync", exact: true }).last()).toBeVisible();
      for (const control of [
        page.getByRole("link", { name: "Sync", exact: true }).last(),
        page.getByRole("switch", { name: "Path style addressing" }),
        page.locator("aside").getByRole("link", { name: "Overview" }),
      ]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(43.99);
      }
      await page.goto("/#/assistant");
      await expect(page.getByTestId("chat-send")).toBeVisible();
      expect((await page.getByTestId("chat-send").boundingBox())!.height).toBeGreaterThanOrEqual(43.99);
    }
  });
});
