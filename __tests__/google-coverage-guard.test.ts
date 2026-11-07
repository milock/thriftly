import {describe, expect, it} from 'vitest';
import {coverageRegression} from '../scripts/check-google-coverage';
import {shouldReviewGoogleIdentity, type Decision} from '../scripts/match-google-places';
import {listingIdentityFingerprint} from '@/lib/google-place-registry';
import type {Store} from '@/lib/types';
const store: Store = {id: 'one', name: 'Goodwill', street: '100 Main St', location: {lat: 32, lon: -117}};
const row = {storeId: store.id, placeId: 'ChIJconfirmed', identityFingerprint: listingIdentityFingerprint(store), checkedAt: '2026-11-06T00:00:00Z'};
const decision: Decision = {...row, reason: 'confirmed'};
const now = new Date('2026-11-06T00:00:00Z');
describe('weekly matching controls', () => {
  it('holds a drop greater than 15 percent and permits an exact 15 percent decline', () => {
    expect(coverageRegression(100, 85).allowed).toBe(true);
    expect(coverageRegression(100, 84).allowed).toBe(false);
    expect(coverageRegression(0, 0).allowed).toBe(true);
    expect(coverageRegression(100, 110).allowed).toBe(true);
    for (const value of [-1, NaN, Infinity, 1.5]) expect(() => coverageRegression(value, 1)).toThrow();
  });
  it('keeps fresh confirmations and unchanged holds without a weekly API call', () => {
    expect(shouldReviewGoogleIdentity(store, row, decision, now)).toBe(false);
    expect(shouldReviewGoogleIdentity(store, undefined, {...decision, reason: 'address-mismatch'}, now)).toBe(false);
    expect(shouldReviewGoogleIdentity(store, undefined, {...decision, reason: 'duplicate-identity'}, now)).toBe(false);
  });
  it('retries missing, changed, invalid, failed and twelve-month-stale identities', () => {
    expect(shouldReviewGoogleIdentity(store, undefined, undefined, now)).toBe(true);
    expect(shouldReviewGoogleIdentity(store, undefined, decision, now)).toBe(true);
    expect(shouldReviewGoogleIdentity({...store, name: 'Changed'}, row, decision, now)).toBe(true);
    expect(shouldReviewGoogleIdentity(store, undefined, {...decision, reason: 'lookup_http_429'}, now)).toBe(true);
    expect(shouldReviewGoogleIdentity(store, {...row, checkedAt: '2025-11-05T23:59:59Z'}, decision, now)).toBe(true);
    expect(shouldReviewGoogleIdentity(store, {...row, checkedAt: '2025-11-06T00:00:00Z'}, decision, now)).toBe(false);
  });
});
