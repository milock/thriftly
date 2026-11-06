import {describe, expect, it} from 'vitest';
import {formatSourceDate} from '@/lib/format';

describe('source dates across server and browser locales', () => {
  it('uses stable localized numeric orders instead of varying CLDR month names', () => {
    const date = '2026-11-06T00:01:00Z';
    expect(formatSourceDate(date, 'en')).toBe('11/06/2026');
    expect(formatSourceDate(date, 'tl')).toBe('11/06/2026');
    expect(formatSourceDate(date, 'vi')).toBe('06/11/2026');
    expect(formatSourceDate(date, 'es')).toBe('06/11/2026');
    expect(formatSourceDate(date, 'zh-Hans')).toBe('2026/11/06');
    expect(formatSourceDate(date, 'ar')).toBe('٠٦/١١/٢٠٢٦');
  });
  it('uses the UTC source day and leaves invalid or missing dates unknown', () => {
    expect(formatSourceDate('2026-11-05T19:00:00-08:00')).toBe('11/06/2026');
    expect(formatSourceDate('not-a-date')).toBeNull();
    expect(formatSourceDate(undefined)).toBeNull();
  });
});
