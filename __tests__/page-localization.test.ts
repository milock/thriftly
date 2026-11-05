import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {IntlMessageFormat} from 'intl-messageformat';

const locales = ['en', 'es', 'zh-Hans', 'zh-Hant', 'tl', 'vi', 'ar'];
function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]] : Object.entries(leaves(child as Record<string, unknown>, path));
  }));
}
const catalogs = Object.fromEntries(locales.map(locale => [locale, leaves(JSON.parse(readFileSync(`messages/pages/${locale}.json`, 'utf8')))]));
const variables = (message: string) => [...new Set([...message.matchAll(/\{(\w+)(?=[},])/g)].map(match => match[1]))].sort();

describe('localized public-page messages', () => {
  for (const locale of locales) {
    it(`${locale} has every message and preserves interpolation variables`, () => {
      expect(Object.keys(catalogs[locale]).sort()).toEqual(Object.keys(catalogs.en).sort());
      for (const [key, message] of Object.entries(catalogs[locale])) {
        expect(message.trim(), key).not.toBe('');
        expect(variables(message), key).toEqual(variables(catalogs.en[key]));
      }
    });
    it(`${locale} renders counts including Arabic dual, few and many forms`, () => {
      for (const message of Object.values(catalogs[locale])) {
        const formatter = new IntlMessageFormat(message, locale);
        for (const count of [0, 1, 2, 3, 11, 100]) {
          expect(() => formatter.format({count, radius: 25, score: 80, value: 40, distance: 0.3, city: 'San Diego', place: 'San Diego'})).not.toThrow();
        }
      }
    });
  }
});
