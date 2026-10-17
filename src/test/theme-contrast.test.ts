import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/style.css", "utf8");

function channel(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hsl: string) {
  const [hue, saturation, lightness] = hsl.trim().split(/\s+/).map(parseFloat);
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const component = (n: number) => {
    const k = (n + hue / 30) % 12;
    return channel(l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return 0.2126 * component(0) + 0.7152 * component(8) + 0.0722 * component(4);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

describe("theme text contrast", () => {
  for (const selector of [":root", ".dark"]) {
    it(`${selector} muted text meets 4.5:1 on page and muted surfaces`, () => {
      const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`))?.[1];
      expect(block).toBeDefined();
      const token = (name: string) => block!.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1] ?? "";
      for (const surface of ["background", "card", "muted"]) {
        expect(contrast(token("muted-foreground"), token(surface)), `${selector} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(token("destructive-foreground"), token("destructive")), `${selector} destructive button`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
