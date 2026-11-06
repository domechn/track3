import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test("iPad opens Chats and Context from the Assistant header", async ({ browser }) => {
  test.setTimeout(480_000);
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 }, userAgent: "Track3 iPad",
    hasTouch: true, isMobile: true, reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/assistant");
    await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 240_000 });
    const chatsToggle = page.getByTestId("sidebar-toggle");
    const shellBack = page.locator("#app-top-bar .mobile-header-back");
    const chatsBounds = (await chatsToggle.boundingBox())!;
    const backBounds = (await shellBack.boundingBox())!;
    mkdirSync("/tmp/wui19-assistant-panes", { recursive: true });
    await page.screenshot({ path: "/tmp/wui19-assistant-panes/ipad-header.png" });
    expect.soft(Math.abs(chatsBounds.y + chatsBounds.height / 2 - backBounds.y - backBounds.height / 2)).toBeLessThanOrEqual(2);
    await expect.soft(chatsToggle.locator("svg")).toHaveAttribute("viewBox", "0 0 15 15");
    const attentionDot = page.getByTestId("mobile-context-toggle").locator(".t3-assistant-attention");
    await expect(page.getByTestId("mobile-context-toggle")).toHaveAccessibleName("Context");
    await expect(page.getByTestId("mobile-context-toggle")).toHaveAttribute("aria-description", "needs attention");
    await expect.soft(attentionDot).toBeVisible();
    expect.soft(await attentionDot.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }))).toEqual({ width: 6, height: 6 });
    const tabletTitle = page.getByRole("heading", { name: "Assistant", exact: true }).first();
    await expect(tabletTitle).toBeVisible();
    expect(await tabletTitle.evaluate((node) => document.getElementById("app-top-bar")?.contains(node))).toBe(true);
    const titleBounds = (await tabletTitle.boundingBox())!;
    const headerBounds = (await page.locator("#app-top-bar .ios-d3-chat-header").boundingBox())!;
    expect(titleBounds.y).toBeGreaterThanOrEqual(headerBounds.y);
    expect(titleBounds.y + titleBounds.height).toBeLessThanOrEqual(headerBounds.y + headerBounds.height);
    const modelBounds = (await page.locator("#app-top-bar .fidelity-chat-header-title span").boundingBox())!;
    expect(modelBounds.y).toBeGreaterThanOrEqual(titleBounds.y + titleBounds.height);
    expect(modelBounds.y + modelBounds.height).toBeLessThanOrEqual(headerBounds.y + headerBounds.height);
    const contextBounds = (await page.getByTestId("mobile-context-toggle").boundingBox())!;
    expect(titleBounds.x + titleBounds.width + 8).toBeLessThanOrEqual(contextBounds.x);
    await page.getByTestId("sidebar-toggle").click({ timeout: 10_000 });
    await expect(page.getByTestId("session-sidebar")).toBeVisible();
    await page.getByTestId("session-sidebar").getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("chat-card")).toBeVisible();
    await page.getByTestId("mobile-context-toggle").click();
    const sheet = page.getByRole("dialog", { name: "Context" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Holdings");
    await expect(sheet.getByRole("heading", { name: "Context" })).toHaveCount(1);
    expect((await sheet.locator(".t3-assistant-context").boundingBox())!.width)
      .toBeGreaterThan((await sheet.boundingBox())!.width - 40);
    mkdirSync("/tmp/wui19-assistant-panes", { recursive: true });
    await page.screenshot({ path: "/tmp/wui19-assistant-panes/ipad-context.png" });
    await sheet.getByRole("button", { name: "Collapse context" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(page.getByTestId("mobile-context-toggle")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId("sidebar-toggle").locator("svg")).toHaveAttribute("viewBox", "0 0 15 15");
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("session-sidebar")).toBeVisible();
    await expect(page.getByTestId("chat-card")).not.toBeVisible();
    await page.getByTestId("session-sidebar").getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("session-sidebar")).not.toBeVisible();
    await expect(page.getByTestId("chat-card")).toBeVisible();
    expect((await page.getByTestId("mobile-context-toggle").boundingBox())!.width).toBe(44);
    await page.getByTestId("mobile-context-toggle").click();
    await expect(page.getByRole("dialog", { name: "Context" })).toBeVisible();
    await page.screenshot({ path: "/tmp/wui19-assistant-panes/ipad-wide-context.png" });
    await page.getByRole("dialog", { name: "Context" }).getByRole("button", { name: "Collapse context" }).click();
    await expect(page.getByTestId("mobile-context-toggle")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => innerWidth)).toBe(390);
    await expect(attentionDot).toBeVisible();
    expect(await attentionDot.evaluate((node) => node.getBoundingClientRect().width)).toBe(6);
    await page.getByTestId("mobile-context-toggle").click();
    await expect(page.getByRole("dialog", { name: "Context" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Context" }).getByRole("heading", { name: "Context" })).toHaveCount(1);
    await page.screenshot({ path: "/tmp/wui19-assistant-panes/phone-context.png" });
    const phonePanel = (await page.getByRole("dialog", { name: "Context" }).locator(".t3-assistant-context").boundingBox())!;
    expect(phonePanel.x + phonePanel.width).toBeLessThanOrEqual(390);
    expect(await page.getByRole("dialog", { name: "Context" }).locator(".t3-assistant-context")
      .evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await page.getByRole("dialog", { name: "Context" }).locator(".t3-assistant-context")
      .evaluate((node) => Math.max(...Array.from(node.querySelectorAll("h2, span, b, small, p"))
        .map((item) => item.getBoundingClientRect().right)))).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});
