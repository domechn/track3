import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { FakeS3 } from "../../src/middlelayers/sync/object-store";

test("connection test uses a fake S3 bucket", async ({ page }) => {
  await installTauriBridge(page, new FakeS3());
  await page.goto("/#/settings/sync");
  await page.getByLabel("S3 endpoint").fill("https://s3.example.test");
  await page.getByLabel("Region").fill("us-east-1");
  await page.getByLabel("Bucket").fill("track3");
  await page.getByLabel("Access key ID").fill("key");
  await page.getByLabel("Secret access key").fill("secret");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByRole("alert")).toHaveText("Connection successful.");
  await page.getByLabel("Sync passphrase", { exact: true }).fill("correct horse battery staple");
  await page.getByLabel("Confirm sync passphrase").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Enable sync" }).click();
  await expect(page.getByRole("button", { name: "Sync idle" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel(/Name for device/)).toBeVisible({ timeout: 15000 });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "Sync idle" }).click();
  const dialog = page.getByRole("dialog");
  await expect.poll(async () => (await dialog.boundingBox())?.x).toBeGreaterThanOrEqual(8);
  const popover = await dialog.boundingBox();
  expect(popover).not.toBeNull();
  expect(popover!.x).toBeGreaterThanOrEqual(8);
  expect(popover!.x + popover!.width).toBeLessThanOrEqual(312);
});

test("a second device pulls history from the first device", async ({ browser }) => {
  const s3 = new FakeS3();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    const second = await secondContext.newPage();
    await installTauriBridge(first, s3);
    await installTauriBridge(second, s3);

    await second.goto("/#/history");
    await expect(second.getByText("Total 2 records")).toBeVisible();
    await second.getByTestId("history-delete-latest").locator("xpath=ancestor::tr").hover();
    await second.getByTestId("history-delete-latest").click();
    await second.getByRole("button", { name: "Confirm" }).click();
    await expect(second.getByText("Total 1 records")).toBeVisible();

    const enable = async (page: typeof first) => {
      await page.goto("/#/settings/sync");
      await page.getByLabel("S3 endpoint").fill("https://s3.example.test");
      await page.getByLabel("Region").fill("us-east-1");
      await page.getByLabel("Bucket").fill("track3");
      await page.getByLabel("Access key ID").fill("key");
      await page.getByLabel("Secret access key").fill("secret");
      await page.getByLabel("Sync passphrase", { exact: true }).fill("correct horse battery staple");
      await page.getByLabel("Confirm sync passphrase").fill("correct horse battery staple");
      await page.getByRole("button", { name: "Enable sync" }).click();
      await expect(page.getByRole("button", { name: "Sync idle" })).toBeVisible({ timeout: 15000 });
    };
    await enable(first);
    await expect(first.getByLabel(/Name for device/)).toBeVisible({ timeout: 15000 });
    await enable(second);
    await second.goto("/#/history");
    await expect(second.getByText("Total 2 records")).toBeVisible({ timeout: 15000 });
  } finally {
    await firstContext.close();
    await secondContext.close();
  }
});

test("sync settings are reachable and explain passphrase recovery", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/sync");
  await expect(page.getByRole("heading", { name: "Sync", exact: true })).toBeVisible();
  await expect(page.getByText(/never be recovered/i)).toBeVisible();
  await expect(page.getByLabel("Secret access key")).toHaveAttribute("type", "password");
});

test("portfolio, refresh, history undo, and assistant SSE work in a browser", async ({ page }) => {
  const bridge = await installTauriBridge(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("$42,000.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Refresh successfully!", { exact: true })).toBeVisible();
  expect(bridge.persistedRefreshes()).toBe(1);
  await expect(page.getByText("$84,000.00").first()).toBeVisible();

  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "Historical Data" })).toBeVisible();
  await expect(page.getByText("Total 3 records")).toBeVisible();
  await page.evaluate(() => {
    if (!document.querySelector("[data-testid=history-content]")) {
      throw new Error("history content missing");
    }
    (window as any).__historyLoadingFlash = false;
    new MutationObserver(() => {
      const history = document.querySelector("[data-testid=history-content]");
      if (history?.getAttribute("aria-busy") === "true"
        || document.body.textContent?.includes("Loading historical data")) {
        (window as any).__historyLoadingFlash = true;
      }
    }).observe(document.body, { attributes: true, childList: true, subtree: true });
  });
  await page.getByTestId("history-delete-latest").locator("xpath=ancestor::tr").hover();
  await page.getByTestId("history-delete-latest").click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Total 2 records")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Total 3 records")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__historyLoadingFlash)).toBe(false);

  await page.goto("/#/assistant");
  await expect(page.getByTestId("chat-input")).toBeVisible();
  await page.getByTestId("chat-input").fill("Say hello");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-thread").getByText("Hello from SSE")).toBeVisible();
  await page.getByTestId("chat-thread").getByRole("button", { name: "Thinking" }).click();
  await expect(page.getByTestId("chat-thread").getByText("Let me think")).toBeVisible();
  expect(bridge.sseRequests()).toBeGreaterThan(0);
});
