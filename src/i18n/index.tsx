import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./en";
import zh from "./zh";
import type {
  Locale,
  TranslationDictionary,
  TranslationKey,
  TranslationParams,
} from "./types";

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

export const LOCALE_STORAGE_KEY = "track3-ui-locale";

const DICTS: Record<Locale, TranslationDictionary> = {
  en,
  zh,
};

function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) {
      return stored;
    }
  } catch {
    // ignore storage read failures (e.g. private mode)
  }

  const browser = window.navigator?.language?.toLowerCase() ?? "";
  if (browser.startsWith("zh")) {
    return "zh";
  }
  if (browser.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return `{${key}}`;
    }
    return String(value);
  });
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /**
   * Translate using a raw string. Useful for non-keyed text (e.g. user-typed
   * content). Falls back to the original value.
   */
  tString: (value: string) => string;
  availableLocales: { value: Locale; label: string }[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore storage write failures
    }
    // Sync <html lang> for screen readers and CSS pseudo-selectors.
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      const primary = DICTS[locale]?.[key];
      const template =
        primary ?? (locale !== DEFAULT_LOCALE ? DICTS[DEFAULT_LOCALE][key] : undefined);
      if (template === undefined) {
        // Fall back to the key itself so missing translations are obvious in dev.
        return key;
      }
      return interpolate(template, params);
    },
    [locale],
  );

  const tString = useCallback((value: string) => value, []);

  const availableLocales = useMemo(
    () =>
      SUPPORTED_LOCALES.map((value) => ({
        value,
        label: LOCALE_LABELS[value],
      })),
    [],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, tString, availableLocales }),
    [locale, setLocale, t, tString, availableLocales],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const NOOP_CONTEXT: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key: TranslationKey) => key,
  tString: (value: string) => value,
  availableLocales: SUPPORTED_LOCALES.map((value) => ({
    value,
    label: LOCALE_LABELS[value],
  })),
};

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // In test/SSR contexts, fall back to a no-op context that
    // simply returns the key as the translation. This keeps
    // existing test suites working without needing to wrap every
    // component in <I18nProvider />.
    return NOOP_CONTEXT;
  }
  return ctx;
}

/**
 * Returns the user's preferred locale tag (e.g. "en" or "zh-CN") for use with
 * Intl APIs that require a BCP-47 tag.
 */
export function useLocaleTag(): string {
  const { locale } = useTranslation();
  return locale === "zh" ? "zh-CN" : "en";
}

export type { Locale, TranslationKey, TranslationParams } from "./types";
