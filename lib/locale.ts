export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
