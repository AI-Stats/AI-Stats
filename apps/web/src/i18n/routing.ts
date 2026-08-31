export const publicLocales = ["en-GB", "de-DE"] as const;

export type PublicLocale = (typeof publicLocales)[number];
