import { expect, type Locator } from "@playwright/test";

export async function expectReadablePublicIpButton(button: Locator) {
  await expect(button).toHaveCSS("opacity", "1");
  const { fontSize, contrast } = await button.evaluate((node) => {
    const style = getComputedStyle(node);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      return channels.map((value) => {
        const scaled = value / 255;
        return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    };
  });
  expect(fontSize).toBeGreaterThanOrEqual(14);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}
