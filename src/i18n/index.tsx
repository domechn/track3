import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export type Locale = "en" | "zh";

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

export const localeLocalStorageKey = "track3-ui-locale";

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  zh: zh as Dictionary,
};

function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(localeLocalStorageKey) as Locale | null;
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      return stored;
    }
  } catch {
    // ignore localStorage read errors
  }

  try {
    const lang = (navigator.language || "").toLowerCase();
    if (lang.startsWith("zh")) {
      return "zh";
    }
  } catch {
    // ignore navigator access errors
  }

  return "en";
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveKey(dict: Dictionary, key: string): string | undefined {
  if (key in dict) {
    return dict[key];
  }
  return undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) {
      return;
    }
    setLocaleState(next);
    try {
      localStorage.setItem(localeLocalStorageKey, next);
    } catch {
      // ignore localStorage write errors
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const fromActive = resolveKey(dictionaries[locale], key);
      if (fromActive !== undefined) {
        return fromActive;
      }
      // Fallback to English when active locale is missing a key
      const fromEnglish = resolveKey(dictionaries.en, key);
      if (fromEnglish !== undefined) {
        return fromEnglish;
      }
      return fallback ?? key;
    },
    [locale],
  );

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      // ignore dom update errors
    }
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Fallback t() used when no I18nProvider is mounted (e.g. in some unit tests):
// returns the English entry, then the fallback string, then the key itself.
function passthroughT(key: string, fallback?: string): string {
  const fromEnglish = resolveKey(dictionaries.en, key);
  if (fromEnglish !== undefined) {
    return fromEnglish;
  }
  return fallback ?? key;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      setLocale: () => {},
      t: passthroughT,
    };
  }
  return ctx;
}

// re-export for convenience; some code may want to import the type
export type { I18nContextValue as I18nContext };
