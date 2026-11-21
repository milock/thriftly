import {describe, expect, it} from 'vitest';
import {parseBrandIds} from '@/lib/brands';
import {applyFilters, DEFAULT_FILTERS, parseDepartments} from '@/lib/filters';
import type {ScoredStore} from '@/lib/types';
const store = (id: string, brandId?: ScoredStore['brandId']): ScoredStore => ({id, brandId, name: id, location: {lat: 0, lon: 0}, distanceMiles: 1, score: {total: 70, factors: {} as ScoredStore['score']['factors'], catchment: {tractCount: 0, population: 0}}});
describe('brand and department search', () => {
  const stores = [store('savers/1191', 'savers'), store('savers/other', 'savers'), store('legacy')];
  it('selects brands and treats legacy records as Goodwill', () => {
    expect(applyFilters(stores, {...DEFAULT_FILTERS, brandIds: ['goodwill']}).map(s => s.id)).toEqual(['legacy']);
    expect(applyFilters(stores, {...DEFAULT_FILTERS, brandIds: ['savers']}).map(s => s.id)).toEqual(['savers/1191', 'savers/other']);
  });
  it('intersects brand and sourced department filters without guessing unknowns', () => {
    expect(applyFilters(stores, {...DEFAULT_FILTERS, brandIds: ['savers'], departments: ['books']}).map(s => s.id)).toEqual(['savers/1191']);
    expect(applyFilters(stores, {...DEFAULT_FILTERS, brandIds: ['goodwill'], departments: ['books']})).toEqual([]);
  });
  it('parses and deduplicates allowed URL filter values', () => {
    const params = new URLSearchParams('brands=savers,invalid,goodwill,savers&departments=books,invalid,books,clothing');
    expect(parseBrandIds(params.get('brands'))).toEqual(['goodwill', 'savers']);
    expect(parseDepartments(params.get('departments'))).toEqual(['books', 'clothing']);
    expect(parseBrandIds(null)).toEqual([]);
    expect(parseDepartments(null)).toEqual([]);
  });
});
