import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import kk from '@/locales/kk.json';
import world from '@/locales/world.json';
export const locales: Record<string, { name: string; dir: 'ltr' | 'rtl'; complete: boolean }> = {
  en: { name: 'English', dir: 'ltr', complete: true },
  ru: { name: 'Русский', dir: 'ltr', complete: true },
  kk: { name: 'Қазақша', dir: 'ltr', complete: true },
  es: { name: 'Español', dir: 'ltr', complete: false },
  fr: { name: 'Français', dir: 'ltr', complete: false },
  de: { name: 'Deutsch', dir: 'ltr', complete: false },
  pt: { name: 'Português', dir: 'ltr', complete: false },
  it: { name: 'Italiano', dir: 'ltr', complete: false },
  tr: { name: 'Türkçe', dir: 'ltr', complete: false },
  ar: { name: 'العربية', dir: 'rtl', complete: false },
  'zh-CN': { name: '简体中文', dir: 'ltr', complete: false },
  ja: { name: '日本語', dir: 'ltr', complete: false },
  ko: { name: '한국어', dir: 'ltr', complete: false },
  hi: { name: 'हिन्दी', dir: 'ltr', complete: false },
  uk: { name: 'Українська', dir: 'ltr', complete: false },
};
export type TranslationKey = keyof typeof en;
const dictionaries: Record<string, Partial<Record<TranslationKey, string>>> = {
  en,
  ru,
  kk,
  ...world,
};
export function translate(locale: string, key: string) {
  return (
    (dictionaries[locale] as Record<string, string> | undefined)?.[key] ||
    (en as Record<string, string>)[key] ||
    key
  );
}
export function coverage(locale: string) {
  return Math.round(
    (Object.keys(dictionaries[locale] || {}).length / Object.keys(en).length) * 100,
  );
}
export function formatMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
