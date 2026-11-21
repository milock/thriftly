import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({locate: vi.fn(), nearest: vi.fn()}));
vi.mock('@/lib/locate', () => ({locateBundledStores: mocks.locate, nearestStore: mocks.nearest}));
import {prepareInitialSearch} from '@/lib/initial-search';
import {parseInitialSearch, storeSearchKey} from '@/lib/search-query';
import {computeGoodsScore} from '@/lib/scoring';
import type {ScoredStore} from '@/lib/types';
const store = (id: string): ScoredStore => ({id, name: 'Independent source name', brandId: 'goodwill', googlePlaceId: `ChIJ${id}`, location: {lat: 32.7, lon: -117.1}, address: '100 Source St', distanceMiles: 2, score: computeGoodsScore({medianHomeValue: 500000, medianHouseholdIncome: 70000, medianGrossRent: 1700, pctBachelorsPlus: 50, tractCount: 2, population: 1000})});
const query = {lat: '32.7157', lon: '-117.1611', radius: '15', label: 'San Diego'};
beforeEach(() => {mocks.locate.mockReturnValue([store('first'), store('second'), store('third')]); mocks.nearest.mockReturnValue(null);});
afterEach(() => {vi.clearAllMocks();});

describe('request-time search initialization', () => {
  it('returns the bundled source listings unchanged', () => {
    const sources = mocks.locate(); mocks.locate.mockClear();
    const result = prepareInitialSearch({...query, sel: 'third'});
    expect(result.initialStores).toEqual(sources);
    expect(result.initialQuery?.filters.radiusMiles).toBe(15);
    expect(result.initialQuery?.selectedId).toBe('third');
  });
  it('does not locate stores for missing, malformed, duplicate, or unknown-brand coordinate links', () => {
    for (const invalid of [{}, {...query, lat: ''}, {...query, lat: '32oops'}, {...query, lon: '181'}, {...query, lat: ['32','33']}, {...query, brands: 'unknown'}]) expect(prepareInitialSearch(invalid).initialQuery).toBeNull();
    expect(mocks.locate).not.toHaveBeenCalled();
  });
  it('preserves a nearest-store hint for a genuinely empty confirmed area', () => {
    mocks.locate.mockReturnValue([]);
    mocks.nearest.mockReturnValue({name: 'Nearest', location: {lat: 33, lon: -117}, distanceMiles: 30});
    expect(prepareInitialSearch(query).initialNearest?.name).toBe('Nearest');
  });
  it('gives the hydration hook the same canonical query key despite brand order or duplicated brands', () => {
    const parsed = parseInitialSearch({...query, brands: 'savers,goodwill,goodwill'})!;
    expect(storeSearchKey(parsed.center, parsed.filters.radiusMiles, parsed.filters.brandIds)).toBe(storeSearchKey({lat: 32.7157, lon: -117.1611}, 15, ['goodwill','savers']));
  });
});
