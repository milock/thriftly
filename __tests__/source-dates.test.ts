import {describe,it,expect} from 'vitest';
import {formatSourceDate} from '@/lib/format';
describe('dated listing evidence',()=>{
 it('renders timestamped source checks in the store timezone across UTC midnight',()=>{
  expect(formatSourceDate('2026-11-06T03:14:50Z','en','America/Los_Angeles')).toBe('11/05/2026');
  expect(formatSourceDate('2026-11-06T03:14:50Z','ar','America/Los_Angeles')).toBe('٠٥/١١/٢٠٢٦');
  expect(formatSourceDate('2026-11-06T03:14:50Z','zh-Hans','America/Los_Angeles')).toBe('2026/11/05');
 });
 it('preserves date-only source claims without shifting their calendar date',()=>{
  expect(formatSourceDate('2026-11-06','en','America/Los_Angeles')).toBe('11/06/2026');
  expect(formatSourceDate('2026-11-06T03:14:50Z')).toBe('11/06/2026');
  expect(formatSourceDate('not-a-date')).toBeNull();
  expect(formatSourceDate('2026-11-06T03:14:50Z','en','invalid-zone')).toBeNull();
 });
});
