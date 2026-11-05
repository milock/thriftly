import {defineRouting} from 'next-intl/routing';

export const locales = ['en', 'es', 'zh-Hans', 'zh-Hant', 'tl', 'vi', 'ar'] as const;
export type Locale = typeof locales[number];
export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false,
  // Metadata owns the complete, indexability-aware alternate set.
  alternateLinks: false,
});
export const localeNames: Record<Locale, string> = {
  en: 'English', es: 'Español', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文',
  tl: 'Filipino', vi: 'Tiếng Việt', ar: 'العربية',
};
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
export function localizedPath(path: string, locale: string = 'en'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return locale === 'en' ? normalized : `/${locale}${normalized === '/' ? '' : normalized}`;
}
