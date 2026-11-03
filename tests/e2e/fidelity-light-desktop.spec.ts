import { expect, test } from "@playwright/test";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";

for (const [route, scene] of [["rebalance", "rebalance"], ["goals", "goals"]] as const) {
  test(`${route} keeps the light theme readable at 1600px`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
    await installPlanFidelityScene(page, scene);
    await page.goto(`/#/${route}`);
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator(`.t3-manage-${route}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    const heading = page.getByRole("heading", { level: 1, name: route === "goals" ? "Goals & alerts" : "Rebalance" });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((element) => getComputedStyle(element).color)).not.toBe("rgb(255, 255, 255)");
  });
}

test("rule kinds stays readable in the light theme", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
  await installPlanFidelityScene(page, "goals-empty");
  await page.goto("/#/goals/kinds");
  await expect(page.locator("html")).toHaveClass(/light/);
  const heading = page.getByRole("heading", { level: 1, name: "Rule kinds" });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((element) => getComputedStyle(element).color)).not.toBe("rgb(255, 255, 255)");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("system theme switches wide Rebalance and Goals layouts when OS appearance changes", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
  await installPlanFidelityScene(page, "rebalance");
  await page.goto("/#/rebalance");
  await expect(page.locator(".t3-fidelity-rebalance")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".t3-manage-rebalance")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.goto("/#/goals");
  await expect(page.locator(".t3-manage-goals")).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".t3-fidelity-goals")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/#/goals/kinds");
  await expect(page.locator(".t3-fidelity-rail")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.locator(".t3-fidelity-rail")).toBeHidden();
});
