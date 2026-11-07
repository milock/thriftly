import {afterEach, expect, it, vi} from 'vitest';
import * as locate from '@/lib/locate';
import {losAngelesOutlets} from '@/lib/outlets';

afterEach(() => vi.restoreAllMocks());

it('publishes exactly the confirmed operator-selected outlets with independent source coordinates', () => {
  const stores = losAngelesOutlets();
  expect(stores.map(store => store.id).sort()).toEqual([
    'goodwill/49572e5e-32cf-e411-b4ab-0050568924e6', 'node/12431931814',
  ]);
  expect(stores.every(store => store.googlePlaceId && store.facilityType === 'outlet' && store.distanceMiles > 0)).toBe(true);
  for (const store of stores) {
    const source = locate.allBundledStores().find(candidate => candidate.id === store.id)!;
    expect(store.location).toEqual(source.location);
    expect(store.score).toEqual(source.score);
    expect(source.distanceMiles).toBe(0);
  }
});

it('never substitutes nearby retail, other outlets, or an unconfirmed selected record', () => {
  const [outlet] = losAngelesOutlets();
  vi.spyOn(locate, 'allBundledStores').mockReturnValue([
    {...outlet, id: 'same-address-retail', facilityType: 'retail'},
    {...outlet, id: 'another-outlet'},
    {...outlet, googlePlaceId: undefined},
  ]);
  expect(losAngelesOutlets()).toEqual([]);
});

it('holds missing confirmations without restoring an editorial fallback', () => {
  const [outlet] = losAngelesOutlets();
  const published = vi.spyOn(locate, 'allBundledStores').mockReturnValue([outlet]);
  expect(losAngelesOutlets().map(store => store.id)).toEqual([outlet.id]);
  published.mockReturnValue([]);
  expect(losAngelesOutlets()).toEqual([]);
});
