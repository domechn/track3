import { render, screen } from "@testing-library/react";
import { I18nProvider, useTranslation } from "@/i18n";
import { it, expect } from "vitest";
import { I18nProvider as MobileI18nProvider } from "./i18n";
import en from "./en.json";
import zh from "./zh.json";

function Label() {
  const { t } = useTranslation();
  return <span>{t("nav.summary")}</span>;
}

it("uses mobile copy inside the mobile provider", () => {
  render(<I18nProvider dictionaries={{ en: { "nav.summary": "Phone analytics" }, zh: { "nav.summary": "手机分析" } }}><Label /></I18nProvider>);
  expect(screen.getByText("Phone analytics")).toBeInTheDocument();
});

it("keeps the iPhone wording for existing navigation keys", () => {
  render(<MobileI18nProvider><Label /></MobileI18nProvider>);
  expect(screen.getByText("Analytics")).toBeInTheDocument();
});

it("keeps both mobile catalogs in step", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
});
