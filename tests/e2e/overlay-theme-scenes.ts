import { expect, type Locator } from "@playwright/test";

function luminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  expect(channels).toHaveLength(3);
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export async function expectOverlayTheme(surface: Locator, primary?: Locator, radius = "--radius-overlay", surfaceToken = "--popover") {
  const colors = await surface.evaluate((element, [radiusToken, backgroundToken]) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `hsl(var(${backgroundToken}))`;
    document.body.append(probe);
    const popover = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      foreground: style.color,
      popover,
      radius: style.borderTopLeftRadius,
      expectedRadius: radiusToken.startsWith("--")
        ? getComputedStyle(document.documentElement).getPropertyValue(radiusToken).trim()
        : radiusToken,
    };
  }, [radius, surfaceToken]);
  expect(colors.background).toBe(colors.popover);
  expect(colors.radius).toBe(colors.expectedRadius);
  const textContrast = contrast(colors.foreground, colors.background);
  expect(textContrast).toBeGreaterThanOrEqual(4.5);

  let actionContrast: number | undefined;
  if (primary) {
    const action = await primary.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        foreground: style.color,
        radius: style.borderTopLeftRadius,
        expectedRadius: getComputedStyle(document.documentElement).getPropertyValue("--radius-pill").trim(),
      };
    });
    actionContrast = contrast(action.foreground, action.background);
    expect(actionContrast).toBeGreaterThanOrEqual(4.5);
    expect(action.radius).toBe(action.expectedRadius);
  }
  return { textContrast, actionContrast };
}

export async function expectFocusRing(control: Locator, nextButton = "Show passphrase") {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press("Tab");
  const focused = control.page().locator(":focus");
  await expect(focused).toHaveRole("button");
  await expect(focused).toHaveAccessibleName(nextButton);
  const ring = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, offset: style.outlineOffset };
  });
  expect(ring.width).toBe("2px");
  expect(ring.offset).toBe("1px");
}
