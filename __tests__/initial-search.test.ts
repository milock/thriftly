import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({locate: vi.fn(), nearest: vi.fn(), details: vi.fn()}));
vi.mock('@/lib/locate', () => ({locateBundledStores: mocks.locate, nearestStore: mocks.nearest}));
vi.mock('@/lib/store-details-service', () => ({loadStoreGoogleDetails: mocks.details}));
import {prepareInitialSearch} from '@/lib/initial-search';
import {parseInitialSearch, storeSearchKey} from '@/lib/search-query';
import {computeGoodsScore} from '@/lib/scoring';
import type {LiveGoogleDetails, ScoredStore} from '@/lib/types';
const store = (id: string): ScoredStore => ({id, name: 'Independent source name', brandId: 'goodwill', googlePlaceId: `ChIJ${id}`, location: {lat: 32.7, lon: -117.1}, address: '100 Source St', distanceMiles: 2, score: computeGoodsScore({medianHomeValue: 500000, medianHouseholdIncome: 70000, medianGrossRent: 1700, pctBachelorsPlus: 50, tractCount: 2, population: 1000})});
const details = (id: string): LiveGoogleDetails => ({placeId: `ChIJ${id}`, name: 'Google live name', address: '100 Live St', location: {lat: 32.7001, lon: -117.1}, businessStatus: 'OPERATIONAL', rating: 4.5, ratingCount: 100, currentOpeningHours: null, regularOpeningHours: null, phone: null, website: null, mapsUrl: null, attributions: []});
const query = {lat: '32.7157', lon: '-117.1611', radius: '15', label: 'San Diego'};
const request = {headers: new Headers({'x-vercel-forwarded-for': '192.0.2.10', Authorization: 'private-header'})};
beforeEach(() => {mocks.locate.mockReturnValue([store('first'), store('second'), store('third')]); mocks.nearest.mockReturnValue(null); mocks.details.mockImplementation(async id => details(id));});
afterEach(() => {vi.clearAllMocks(); vi.useRealTimers();});

describe('request-time search initialization', () => {
  it('seeds only the first visible store and selected store, preserving independent Census inputs', async () => {
    const sources = mocks.locate(); mocks.locate.mockClear();
    const result = await prepareInitialSearch({...query, sel: 'third'}, request);
    expect(mocks.details.mock.calls.map(call => call[0])).toEqual(['first','third']);
    expect(result.initialStores[0].google?.rating).toBe(4.5);
    expect(result.initialStores[1].google).toBeUndefined();
    expect(result.initialStores[0].location).toEqual(sources[0].location);
    expect(result.initialStores[0].score).toEqual(sources[0].score);
    expect(result.initialStores[0].name).toBe('Independent source name');
    expect(sources.every((item: ScoredStore) => !item.google)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private-header|192\.0\.2\.10|Authorization/);
    expect(result.initialQuery?.filters.radiusMiles).toBe(15);
  });
  it('never accepts a selected ID outside the known results and does not fetch the first seed twice', async () => {
    await prepareInitialSearch({...query, sel: 'arbitrary'}, request);
    expect(mocks.details).toHaveBeenCalledTimes(1);
    mocks.details.mockClear();
    await prepareInitialSearch({...query, sel: 'first'}, request);
    expect(mocks.details).toHaveBeenCalledTimes(1);
  });
  it('uses the first row after client filters and sort, rather than prefetching every result', async () => {
    mocks.locate.mockReturnValue([{...store('first'), distanceMiles: 4}, {...store('second'), distanceMiles: 1}]);
    await prepareInitialSearch({...query, sort: 'distance'}, request);
    expect(mocks.details.mock.calls.map(call => call[0])).toEqual(['second']);
  });
  it('does not perform a paid lookup for missing, malformed, duplicate, or unknown-brand coordinate links', async () => {
    for (const invalid of [{}, {...query, lat: ''}, {...query, lat: '32oops'}, {...query, lon: '181'}, {...query, lat: ['32','33']}, {...query, brands: 'unknown'}]) expect((await prepareInitialSearch(invalid, request)).initialQuery).toBeNull();
    expect(mocks.locate).not.toHaveBeenCalled(); expect(mocks.details).not.toHaveBeenCalled();
  });
  it('returns usable source results after a failed provider request or a two-second SSR deadline', async () => {
    mocks.details.mockRejectedValue(new Error('private upstream error'));
    expect((await prepareInitialSearch(query, request)).initialStores).toHaveLength(3);
    vi.useFakeTimers();
    mocks.details.mockImplementation(() => new Promise(() => {}));
    const result = prepareInitialSearch(query, request);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await result).initialStores.every(item => !item.google)).toBe(true);
  });
  it('preserves a nearest-store hint for a genuinely empty confirmed area', async () => {
    mocks.locate.mockReturnValue([]);
    mocks.nearest.mockReturnValue({name: 'Nearest', location: {lat: 33, lon: -117}, distanceMiles: 30});
    const result = await prepareInitialSearch(query, request);
    expect(result.initialNearest?.name).toBe('Nearest');
    expect(mocks.details).not.toHaveBeenCalled();
  });
  it('gives the hydration hook the same canonical query key despite brand order or duplicated brands', () => {
    const parsed = parseInitialSearch({...query, brands: 'savers,goodwill,goodwill'})!;
    expect(storeSearchKey(parsed.center, parsed.filters.radiusMiles, parsed.filters.brandIds)).toBe(storeSearchKey({lat: 32.7157, lon: -117.1611}, 15, ['goodwill','savers']));
  });
});
