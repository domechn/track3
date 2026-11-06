import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

async function seedLongChat(page: Page, paragraphs = 35, userText = "Explain my portfolio in detail") {
  await page.evaluate(async ({ paragraphs, userText }) => {
    const invoke = (command: string, args: unknown, options?: unknown) =>
      (window as any).__e2eInvoke(command, args, options);
    const at = new Date().toISOString();
    const messages = [
      { role: "user", content: userText, at },
      { role: "assistant", blocks: [{ kind: "text", text: Array.from({ length: paragraphs }, (_, i) =>
        `Paragraph ${i + 1}. BTC and ETH changed value over the past month. This longer answer keeps the thread scrollable as panes resize.`).join("\n\n") }], at },
    ];
    await invoke("plugin:sql|execute", {
      query: "INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, 2, ?)",
      values: ["panes-e2e", "Portfolio detail", at, at, "A long answer"],
    });
    const text = `!ent:e2e:${JSON.stringify({ version: 1, messages })}`;
    await invoke("plugin:fs|write_text_file", [...new TextEncoder().encode(text)],
      { headers: { path: encodeURIComponent("/e2e/app/ai/sessions/panes-e2e.json.ent") } });
  }, { paragraphs, userText });
}

async function expectComposerUncovered(page: Page, width: number, choice: string) {
  const hit = await page.evaluate(() => {
    const send = document.querySelector<HTMLElement>('[data-testid="chat-send"]')!;
    const input = document.querySelector<HTMLElement>('[data-testid="chat-card"] textarea')!;
    const samples = [
      { name: "Send", target: send, x: send.getBoundingClientRect().left + send.getBoundingClientRect().width / 2 },
      { name: "input right edge", target: input, x: input.getBoundingClientRect().right - 3 },
    ];
    return samples.map(({ name, target, x }) => {
      const y = target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      const top = document.elementFromPoint(x, y);
      return { name, uncovered: top === target || target.contains(top) };
    });
  });
  expect(hit, `${width}px, ${choice}`).toEqual([
    { name: "Send", uncovered: true },
    { name: "input right edge", uncovered: true },
  ]);
}

test("restored panes keep the composer visible at narrow desktop widths", async ({ page }) => {
  test.setTimeout(180_000);
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/assistant");
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  for (const choice of ["default", "saved open"]) {
    for (const width of [1119, 1100, 1000, 900, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((saved) => {
        if (saved) localStorage.setItem("track3.ui.assistant.panes", JSON.stringify({ chats: true, context: true }));
        else localStorage.removeItem("track3.ui.assistant.panes");
      }, choice === "saved open");
      await page.reload();
      await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("chat-input").fill("Hello");
      await expectComposerUncovered(page, width, choice);
    }
  }
});

test("narrow pane drawers have a scrim and close on outside click", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 800, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/assistant");
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Expand chats" }).click();
  await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("assistant-pane-scrim")).toBeVisible();
  await page.keyboard.press("Control+Shift+]");
  await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "false");
  await page.getByTestId("assistant-pane-scrim").click({ position: { x: 350, y: 400 } });
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("assistant-pane-scrim")).toHaveCount(0);
  await page.getByTestId("chat-input").fill("Hello");
  await expectComposerUncovered(page, 800, "after drawer closes");
});

test("desktop pane rails, shortcuts, persistence, and thread anchoring at four widths", async ({ page }) => {
  test.setTimeout(480_000);
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedLongChat(page, 100);
  mkdirSync("/tmp/wui19-assistant-panes", { recursive: true });

  for (const width of [1440, 1280, 1100, 900]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) await page.goto("/#/assistant/panes-e2e");
    else await page.reload();
    await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chat-thread")).toContainText("Paragraph 35", { timeout: 30_000 });
    await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", width < 1120 ? "true" : "false");
    if (width < 1440) await page.screenshot({ path: `/tmp/wui19-assistant-panes/dark-${width}-default.png` });
    const card = page.getByTestId("chat-card");
    const viewport = card.locator("[data-radix-scroll-area-viewport]").first();
    await expect.poll(() => viewport.evaluate((node) =>
      node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
    if (width < 1120) {
      await page.getByRole("button", { name: "Expand context" }).click();
      await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.getByRole("button", { name: "Collapse context" }).click();
      await expect.poll(() => viewport.evaluate((node) =>
        node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
    }
    if (width === 1440) await page.screenshot({ path: "/tmp/wui19-assistant-panes/dark-1440-expanded.png" });
    const wide = (await card.boundingBox())!.width;
    const cardRight = (await card.boundingBox())!.x + wide;
    for (const prompt of await card.locator(".t3-assistant-design-prompts button").all()) {
      expect((await prompt.boundingBox())!.x + (await prompt.boundingBox())!.width).toBeLessThanOrEqual(cardRight - 12);
    }
    await page.waitForTimeout(500);
    await viewport.evaluate((node) => { node.scrollTo({ top: 1500, behavior: "instant" as ScrollBehavior }); });
    const startScroll = await viewport.evaluate((node) => node.scrollTop);
    expect(startScroll).toBe(1500);
    expect(await viewport.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeGreaterThan(100);
    const visibleParagraph = () => viewport.evaluate((node) => {
      const top = node.getBoundingClientRect().top;
      const paragraph = [...node.querySelectorAll<HTMLElement>(".markdown-content p")]
        .find((item) => item.getBoundingClientRect().bottom > top + 1);
      return paragraph ? { text: paragraph.textContent, offset: paragraph.getBoundingClientRect().top - top } : null;
    });
    const anchor = await visibleParagraph();
    expect(anchor?.text).toMatch(/^Paragraph \d+\./);
    await page.waitForTimeout(350);
    expect(await visibleParagraph()).toEqual(anchor);

    await page.getByRole("button", { name: "Collapse chats" }).click();
    await expect(page.getByRole("button", { name: "Expand chats" })).toBeFocused();
    await expect(page.getByTestId("chats-pane")).toHaveCSS("width", "44px");
    if (width < 1120) await page.getByRole("button", { name: "Expand context" }).click();
    await page.getByRole("button", { name: "Collapse context" }).click();
    await expect(page.getByRole("button", { name: "Expand context" })).toBeFocused();
    await expect(page.getByTestId("context-pane")).toHaveCSS("width", "44px");
    if (width === 1440) {
      await expect(page.getByTestId("context-pane").locator(".t3-assistant-attention")).toBeVisible();
      await expect(page.getByTestId("context-rail-toggle")).toHaveAccessibleName("Expand context");
      await expect(page.getByTestId("context-rail-toggle")).toHaveAttribute("aria-description", "needs attention");
    }
    expect((await card.boundingBox())!.width).toBeGreaterThan(wide + (width < 1120 ? 150 : 300));
    await expect.poll(async () => {
      const current = await visibleParagraph();
      return current?.text === anchor?.text && Math.abs((current?.offset ?? 1000) - (anchor?.offset ?? 0)) < 3;
    }).toBe(true);
    const geometry = await card.evaluate((node) => {
      const composer = node.lastElementChild!.getBoundingClientRect();
      const card = node.getBoundingClientRect();
      return { bottomGap: card.bottom - composer.bottom, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    expect(geometry.bottomGap).toBeLessThanOrEqual(2);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `/tmp/wui19-assistant-panes/dark-${width}-collapsed.png` });

    await page.keyboard.press("Control+Shift+[");
    await expect(page.getByRole("button", { name: "Collapse chats" })).toBeFocused();
    await page.keyboard.press("Control+Shift+]");
    await expect(page.getByRole("button", { name: "Collapse context" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await expect.poll(async () => {
      const current = await visibleParagraph();
      return current?.text === anchor?.text && Math.abs((current?.offset ?? 1000) - (anchor?.offset ?? 0)) < 3;
    }).toBe(true);
    await page.waitForTimeout(250);
    await viewport.evaluate((node) => {
      node.scrollTo({ top: node.scrollHeight, behavior: "instant" as ScrollBehavior });
    });
    await expect.poll(() => viewport.evaluate((node) =>
      node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
    if (width < 1120) await page.getByRole("button", { name: "Collapse context" }).click();
    await page.getByRole("button", { name: "Collapse chats" }).click();
    await expect.poll(() => viewport.evaluate((node) =>
      node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
    await page.getByRole("button", { name: "Expand chats" }).click();
    await expect(page.getByRole("button", { name: "Collapse chats" })).toBeFocused();
    await page.evaluate(() => localStorage.removeItem("track3.ui.assistant.panes"));
  }

  await page.evaluate(() => localStorage.setItem("track3-ui-theme", "light"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("chat-card")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Collapse context" }).click();
  await page.screenshot({ path: "/tmp/wui19-assistant-panes/light-1440-context-collapsed.png" });
  await page.reload();
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "true");
});

test("narrow desktop keeps the thread readable when either pane opens", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 600, height: 800 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/assistant");
  const card = page.getByTestId("chat-card");
  await expect(card).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Expand chats" }).click();
  expect((await card.boundingBox())!.width).toBeGreaterThan(320);
  await page.getByRole("button", { name: "Collapse chats" }).click();
  await page.getByRole("button", { name: "Expand context" }).click();
  expect((await card.boundingBox())!.width).toBeGreaterThan(320);
});

test("saved open pane choices become rails until they fit inline", async ({ page }) => {
  test.setTimeout(180_000);
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.goto("/#/assistant");
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => localStorage.setItem("track3.ui.assistant.panes", JSON.stringify({ chats: true, context: true })));
  for (const width of [1000, 900, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    const card = page.getByTestId("chat-card");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", width < 880 ? "true" : "false");
    await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "true");
    expect((await card.boundingBox())!.width, `${width}px window`).toBeGreaterThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "false");
});

test("pane transition preserves the visible paragraph and bottom without CSS scroll anchoring", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1100, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedLongChat(page, 100);
  await page.goto("/#/assistant/panes-e2e");
  const viewport = page.getByTestId("chat-card").locator("[data-radix-scroll-area-viewport]").first();
  await expect(page.getByTestId("chat-thread")).toContainText("Paragraph 100", { timeout: 30_000 });
  await viewport.evaluate((node) => { (node as HTMLElement).style.overflowAnchor = "none"; });
  await viewport.evaluate((node) => node.scrollTo({ top: 1500, behavior: "instant" as ScrollBehavior }));
  const visibleParagraph = () => viewport.evaluate((node) => {
    const top = node.getBoundingClientRect().top;
    const paragraph = [...node.querySelectorAll<HTMLElement>(".markdown-content p")]
      .find((item) => item.getBoundingClientRect().bottom > top + 1);
    return paragraph ? { text: paragraph.textContent, offset: paragraph.getBoundingClientRect().top - top } : null;
  });
  const anchor = await visibleParagraph();
  expect(anchor?.text).toMatch(/^Paragraph \d+\./);
  await page.getByRole("button", { name: "Collapse chats" }).click();
  await expect(page.getByTestId("chats-pane")).toHaveCSS("width", "44px");
  expect(await visibleParagraph()).toEqual(anchor);
  await viewport.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: "instant" as ScrollBehavior }));
  await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
  await page.getByRole("button", { name: "Expand chats" }).click();
  await expect(page.getByTestId("chats-pane")).toHaveCSS("width", "300px");
  await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(5);
});

test("pane transition preserves a visible user message without CSS scroll anchoring", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedLongChat(page, 35, "Explain my portfolio in detail. ".repeat(60));
  await page.goto("/#/assistant/panes-e2e");
  const viewport = page.getByTestId("chat-card").locator("[data-radix-scroll-area-viewport]").first();
  const bubble = page.getByTestId("user-bubble");
  await expect(bubble).toBeVisible({ timeout: 30_000 });
  await viewport.evaluate((node) => {
    (node as HTMLElement).style.overflowAnchor = "none";
    node.scrollTo({ top: 80, behavior: "instant" as ScrollBehavior });
  });
  const offset = () => bubble.evaluate((node) => {
    const viewport = node.closest("[data-radix-scroll-area-viewport]")!;
    return node.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  });
  const before = await offset();
  await page.getByRole("button", { name: "Collapse chats" }).click();
  await expect(page.getByTestId("chats-pane")).toHaveCSS("width", "44px");
  await expect.poll(async () => Math.abs(await offset() - before)).toBeLessThan(3);
});

test("pane shortcuts do not change panes behind a delete confirmation", async ({ page }) => {
  test.setTimeout(180_000);
  await installTauriBridge(page, { fidelitySample: "full" });
  await seedLongChat(page);
  await page.goto("/#/assistant/panes-e2e");
  await expect(page.getByTestId("chat-card")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "false");
  await page.getByTestId("session-item-panes-e2e").hover();
  await page.getByTestId("session-delete-panes-e2e").click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="alertdialog"]') !== null)).toBe(true);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", ctrlKey: true, shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "]", ctrlKey: true, shiftKey: true }));
  });
  await expect(page.getByTestId("chats-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("context-pane")).toHaveAttribute("data-collapsed", "false");
});
