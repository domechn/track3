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
    const layers: Element[] = [];
    for (let element: Element | null = node; element; element = element.parentElement) layers.push(element);
    const background = layers.reverse().reduce<[number, number, number]>((under, element) => {
      const [red, green, blue, alpha = 1] = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)!.map(Number);
      return [red * alpha + under[0] * (1 - alpha), green * alpha + under[1] * (1 - alpha), blue * alpha + under[2] * (1 - alpha)];
    }, [255, 255, 255]);
    const foreground = luminance(style.color);
    const backgroundLuminance = luminance(`rgb(${background.join(",")})`);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      contrast: (Math.max(foreground, backgroundLuminance) + 0.05) / (Math.min(foreground, backgroundLuminance) + 0.05),
    };
  });
  expect(fontSize).toBeGreaterThanOrEqual(14);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}
