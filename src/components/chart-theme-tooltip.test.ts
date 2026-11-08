import { expect, it } from "vitest";
import { glassTooltip } from "@/utils/chart-theme";

it("draws readable title and value text on the card-colour canvas tooltip", () => {
  document.documentElement.classList.remove("dark");
  expect(glassTooltip.backgroundColor).toBe("hsl(0 0% 100%)");
  expect((glassTooltip as { titleColor?: string }).titleColor).toBe("hsl(240 4% 34%)");
  expect((glassTooltip as { bodyColor?: string }).bodyColor).toBe("hsl(240 9% 10%)");
});
