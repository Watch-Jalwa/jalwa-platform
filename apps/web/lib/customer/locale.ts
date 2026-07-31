export const LOCALE_COOKIE = "jalwa_locale";
export type JalwaLocale = "en" | "ur" | "roman_ur";

export function normalizeLocale(value: string | null | undefined): JalwaLocale {
  return value === "ur" || value === "roman_ur" ? value : "en";
}

export function documentLanguage(locale: JalwaLocale) {
  return locale === "ur" ? "ur" : "en";
}

export function documentDirection(locale: JalwaLocale): "rtl" | "ltr" {
  return locale === "ur" ? "rtl" : "ltr";
}

export function localeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
