import type { ReactNode } from "react";
import {
  I18nProvider as SharedI18nProvider,
  useProvidedTranslation,
} from "@/i18n";
import en from "./en.json";
import zh from "./zh.json";

export { LOCALE_LABELS, SUPPORTED_LOCALES, localeLocalStorageKey } from "@/i18n";
export type { Locale } from "@/i18n";

const dictionaries = { en, zh };
const fallback = {
  locale: "en" as const,
  setLocale: () => {},
  t: (key: string, defaultText?: string) => (en as Record<string, string>)[key] ?? defaultText ?? key,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  return <SharedI18nProvider dictionaries={dictionaries}>{children}</SharedI18nProvider>;
}

export function useTranslation() {
  return useProvidedTranslation() ?? fallback;
}
