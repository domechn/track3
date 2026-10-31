import { expect, it } from "vitest";
import { THEME_VALUES, QUOTE_COLOR_VALUES } from "./appearance";

it("keeps the stored appearance protocol values", () => {
  expect(THEME_VALUES).toEqual(["dark", "light", "system"]);
  expect(QUOTE_COLOR_VALUES).toEqual(["green-up-red-down", "red-up-green-down"]);
});

it("keeps theme storage on the configured key", async () => {
  const { readStoredTheme, writeStoredTheme } = await import("./appearance");
  localStorage.clear();
  expect(readStoredTheme("custom", "light")).toBe("light");
  writeStoredTheme("custom", "system");
  expect(localStorage.getItem("custom")).toBe("system");
  expect(readStoredTheme("custom", "light")).toBe("system");
});
