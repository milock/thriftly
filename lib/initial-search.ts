import 'server-only';
import {locateBundledStores, nearestStore} from '@/lib/locate';
import {parseInitialSearch, type InitialSearchQuery, type SearchParams} from '@/lib/search-query';
import type {NearestHint, ScoredStore} from '@/lib/types';

export interface InitialSearch {
  initialQuery: InitialSearchQuery | null;
  initialStores: ScoredStore[];
  initialNearest: NearestHint | null;
}

/** Bundled listings only. No third-party lookup runs while the HTML renders. */
export function prepareInitialSearch(params: SearchParams): InitialSearch {
  const initialQuery = parseInitialSearch(params);
  if (!initialQuery) return {initialQuery: null, initialStores: [], initialNearest: null};
  const {center, filters} = initialQuery;
  const stores = locateBundledStores(center, filters.radiusMiles, filters.brandIds);
  return {
    initialQuery,
    initialStores: stores,
    initialNearest: stores.length ? null : nearestStore(center, filters.brandIds),
  };
}
