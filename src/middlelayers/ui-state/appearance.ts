export const THEME_VALUES = ["dark", "light", "system"] as const;
export type Theme = typeof THEME_VALUES[number];
export const QUOTE_COLOR_VALUES = ["green-up-red-down", "red-up-green-down"] as const;

export function readStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
}
export function writeStoredTheme(storageKey: string, theme: Theme): void {
  localStorage.setItem(storageKey, theme);
}
