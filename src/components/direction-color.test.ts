import { describe, expect, it } from "vitest";
import { directionChartColor, directionClass, directionColorVar, directionPhysicalTone, directionTone } from "@/utils/color";

describe("direction colours", () => {
  it("keeps signs, zero, and unknown values consistent for CSS and text", () => {
    expect(directionColorVar(1, "green-up-red-down")).toBe("hsl(var(--gain))");
    expect(directionColorVar(-1, "red-up-green-down")).toBe("hsl(var(--loss))");
    expect(directionColorVar(0, "green-up-red-down")).toBe("hsl(var(--muted-foreground))");
    expect(directionClass(1, "red-up-green-down")).toBe("text-gain");
    expect(directionClass(-1, "green-up-red-down")).toBe("text-loss");
    expect(directionClass(null, "green-up-red-down")).toBe("text-muted-foreground");
    expect(directionClass(Number.NaN, "green-up-red-down")).toBe("text-muted-foreground");
    expect(directionColorVar(Number.NaN, "green-up-red-down")).toBe("hsl(var(--muted-foreground))");
  });

  it("maps canvas colours through the theme tokens and quote preference", () => {
    expect(directionChartColor(1, "green-up-red-down", "light")).toBe("hsl(158 60% 25%)");
    expect(directionChartColor(1, "red-up-green-down", "light")).toBe("hsl(349 70% 40%)");
    expect(directionChartColor(-1, "red-up-green-down", "dark")).toBe("hsl(156 46% 57%)");
  });

  it("maps physical data tones by preference and mutes zero", () => {
    expect(directionPhysicalTone(1, "green-up-red-down")).toBe("gain");
    expect(directionPhysicalTone(1, "red-up-green-down")).toBe("loss");
    expect(directionPhysicalTone(-1, "red-up-green-down")).toBe("gain");
    expect(directionPhysicalTone(0, "green-up-red-down")).toBe("neutral");
    expect(directionPhysicalTone(null, "red-up-green-down")).toBe("neutral");
  });

  it("maps logical data tones for quote-aware CSS", () => {
    expect(directionTone(1)).toBe("gain");
    expect(directionTone(-1)).toBe("loss");
    expect(directionTone(0)).toBe("neutral");
    expect(directionTone(null)).toBe("neutral");
  });
});
