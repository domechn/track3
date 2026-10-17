import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

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
