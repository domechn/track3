import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

type RGB = [number, number, number];
const css = readFileSync("src/style.css", "utf8");
const iosCss = readFileSync("src/mobile/ios-style.css", "utf8");
const phoneCss = readFileSync("src/mobile/components/mobile/fidelity.css", "utf8");

function token(block: string, name: string): RGB {
  const match = block.match(new RegExp(`--${name}: (\\d+) (\\d+)% (\\d+)%`));
  if (!match) throw new Error(`Missing ${name}`);
  const [, hue, saturation, lightness] = match.map(Number);
  const s = saturation / 100, l = lightness / 100;
  return [0, 8, 4].map((n) => {
    const k = (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  }) as RGB;
}

function mix(foreground: RGB, background: RGB, alpha: number): RGB {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha)) as RGB;
}

function hexToken(block: string, name: string): RGB {
  const match = block.match(new RegExp(`--fd-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing phone ${name}`);
  return [1, 3, 5].map((index) => parseInt(match[1].slice(index, index + 2), 16) / 255) as RGB;
}

function contrast(a: RGB, b: RGB): number {
  const luminance = (rgb: RGB) => rgb.map((channel) => channel <= 0.04045
    ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

it("keeps direction text and bars readable on light and dark surfaces", () => {
  const themes = [css, iosCss].flatMap((sheet) =>
    [sheet.match(/:root \{([^}]*)\}/)?.[1], sheet.match(/\.dark \{([^}]*)\}/)?.[1]]);
  const phoneDark = phoneCss.match(/\.dark \.fd-page \{([^}]*)\}/)?.[1];
  if (themes.some((theme) => !theme) || !phoneDark) throw new Error("Missing theme");
  const palettes = [
    ...themes.map((theme) => ({
      surfaces: ["card", "background", "raised"].map((name) => token(theme!, name)),
      directions: ["positive", "negative"].map((name) => token(theme!, name)),
    })),
    {
      surfaces: ["ground", "surface", "raised"].map((name) => hexToken(phoneDark, name)),
      directions: ["positive", "negative"].map((name) => hexToken(phoneDark, name)),
    },
  ];
  for (const { surfaces, directions } of palettes) {
    for (const direction of directions) {
      for (const surface of surfaces) {
        expect(contrast(direction, surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(mix(direction, surface, 0.8), surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(direction, mix(direction, surface, 0.15))).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
