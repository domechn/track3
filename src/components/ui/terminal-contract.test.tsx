import { describe, expect, it } from "vitest";
import { positiveNegativeColor, positiveNegativeTextClass } from "@/utils/color";

describe("quote colour presentation", () => {
  it("uses semantic gain and loss classes for either saved colour preference", () => {
    for (const preference of ["green-up-red-down", "red-up-green-down"] as const) {
      expect(positiveNegativeTextClass(1, preference)).toBe("text-gain");
      expect(positiveNegativeTextClass(-1, preference)).toBe("text-loss");
      expect(positiveNegativeTextClass(0, preference)).toBe("text-muted-foreground");
    }
  });
  it("returns CSS token colours for inline gain and loss styles", () => {
    expect(positiveNegativeColor(1)).toBe("hsl(var(--gain))");
    expect(positiveNegativeColor(-1, "red-up-green-down")).toBe("hsl(var(--loss))");
    expect(positiveNegativeColor(0)).toBe("hsl(var(--muted-foreground))");
  });
});
