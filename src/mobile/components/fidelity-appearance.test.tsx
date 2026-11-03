import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FidelityAppearance } from "@/mobile/components/fidelity-appearance";
import zh from "@/mobile/zh.json";

vi.mock("@/mobile/i18n", async () => {
  const actual = await vi.importActual<typeof import("@/mobile/i18n")>("@/mobile/i18n");
  return { ...actual, useTranslation: () => ({ locale: "zh", t: (key: string) =>
    (zh as Record<string, string>)[key] ?? key }) };
});

it("translates the theme preview label into the selected language", () => {
  render(<FidelityAppearance section="theme" selectedTheme="light"
    quoteColor="green-up-red-down" selectedLocale="zh"
    onThemeChange={() => {}} onQuoteColorChange={() => {}} onLanguageChange={() => {}} />);
  expect(screen.getAllByText("总价值").length).toBeGreaterThan(0);
  expect(screen.getAllByText("US$763,809.27").length).toBeGreaterThan(0);
});
