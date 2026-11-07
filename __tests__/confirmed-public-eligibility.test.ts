import {afterEach, describe, expect, it, vi} from 'vitest';
import {listingIdentityFingerprint} from '@/lib/google-place-registry';
import type {ScoredStore} from '@/lib/types';
import {computeGoodsScore} from '@/lib/scoring';
const mocks = vi.hoisted(() => ({read: vi.fn()}));
vi.mock('node:fs', () => ({readFileSync: mocks.read}));
const first: ScoredStore = {id: 'one', name: 'Goodwill', brandId: 'goodwill', street: '100 Main St', locality: 'San Diego', region: 'CA', facilityType: 'retail', location: {lat: 32.7, lon: -117.1}, distanceMiles: 0, score: computeGoodsScore({medianHomeValue: 500000, medianHouseholdIncome: 70000, medianGrossRent: 1700, pctBachelorsPlus: 50, tractCount: 2, population: 1000})};
const second = {...first, id: 'two', location: {lat: 32.71, lon: -117.1}};
function mockFiles(registry: unknown, stores: ScoredStore[] = [first, second]) {
  mocks.read.mockImplementation((path: string) => {
    if (path.endsWith('stores-us.json')) return JSON.stringify({stores});
    if (path.endsWith('store-access.json')) return '{"records":[]}';
    if (path.endsWith('google-place-ids.json')) {if (registry instanceof Error) throw registry; return JSON.stringify(registry);}
    throw new Error('Unexpected source');
  });
}
afterEach(() => {vi.restoreAllMocks(); vi.resetModules();});
describe('public registry gates', () => {
  it('filters directory, search, nearest and known points while preserving the private candidate catalog', async () => {
    mockFiles({version: 1, records: [{storeId: 'one', placeId: 'ChIJconfirmed', identityFingerprint: listingIdentityFingerprint(first), checkedAt: '2026-11-06'}]});
    const locate = await import('@/lib/locate');
    expect(locate.allCandidateStores()).toHaveLength(2);
    expect(locate.allBundledStores().map(store => store.id)).toEqual(['one']);
    expect(locate.allBundledStores()[0].googlePlaceId).toBe('ChIJconfirmed');
    expect(locate.allBundledStores()[0].score.visit?.coverage.googleRatingCount).toBeNull();
    expect((await locate.locateStores(second.location, 10)).map(store => store.id)).toEqual(['one']);
    expect(locate.locateBundledStores(second.location, 10).map(store => store.id)).toEqual(['one']);
    expect(locate.nearestStore(second.location)?.location).toEqual(first.location);
    expect(locate.isKnownStorePoint(second.location.lat, second.location.lon)).toBe(false);
  });
  it('does not call an all-missing Census catchment a usable neighborhood score', async () => {
    const missing = {...first, score: computeGoodsScore({medianHomeValue: null, medianHouseholdIncome: null, medianGrossRent: null, pctBachelorsPlus: null, tractCount: 2, population: 1000})};
    mockFiles({version: 1, records: [{storeId: 'one', placeId: 'ChIJconfirmed', identityFingerprint: listingIdentityFingerprint(first), checkedAt: '2026-11-06'}]}, [missing]);
    const locate = await import('@/lib/locate');
    expect(locate.allBundledStores()[0].score.visit?.total).toBeNull();
    expect(locate.allBundledStores()[0].score.visit?.coverage.kind).toBe('no-neighborhood');
  });
  it('fails closed without any network fallback when the registry is missing', async () => {
    mockFiles(new Error('missing'));
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const locate = await import('@/lib/locate');
    expect(locate.allBundledStores()).toEqual([]);
    expect(await locate.locateStores(first.location, 50)).toEqual([]);
    expect(locate.nearestStore(first.location)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
