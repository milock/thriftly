import 'server-only';
import {locateBundledStores, nearestStore} from '@/lib/locate';
import {applyFilters} from '@/lib/filters';
import {parseInitialSearch, type InitialSearchQuery, type SearchParams} from '@/lib/search-query';
import {loadStoreGoogleDetails} from '@/lib/store-details-service';
import type {NearestHint, ScoredStore} from '@/lib/types';

export interface InitialSearch {
  initialQuery: InitialSearchQuery | null;
  initialStores: ScoredStore[];
  initialNearest: NearestHint | null;
}
const SSR_DEADLINE_MS = 2000;

/** A slow provider cannot hold the initial HTML beyond two seconds. The underlying
 * shared lookup remains bounded by five seconds and never caches a settled payload. */
async function initialDetails(storeId: string, request: Pick<Request, 'headers'>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loadStoreGoogleDetails(storeId, request),
      new Promise<undefined>(resolve => {timer = setTimeout(() => resolve(undefined), SSR_DEADLINE_MS);}),
    ]);
  } catch {return undefined;}
  finally {clearTimeout(timer);}
}

export async function prepareInitialSearch(params: SearchParams, request: Pick<Request, 'headers'>): Promise<InitialSearch> {
  const initialQuery = parseInitialSearch(params);
  if (!initialQuery) return {initialQuery: null, initialStores: [], initialNearest: null};
  const {center, filters, selectedId} = initialQuery;
  const stores = locateBundledStores(center, filters.radiusMiles, filters.brandIds);
  const first = applyFilters(stores, filters)[0];
  const selected = selectedId ? stores.find(store => store.id === selectedId) : undefined;
  const ids = [...new Set([first?.id, selected?.id].filter((id): id is string => !!id))];
  const live = new Map(await Promise.all(ids.map(async id => [id, await initialDetails(id, request)] as const)));
  return {
    initialQuery,
    // Preserve all independent source fields and Census inputs. Client session
    // applies the same scoring/display merge as every later live response.
    initialStores: stores.map(store => live.get(store.id) ? {...store, google: live.get(store.id)!} : store),
    initialNearest: stores.length ? null : nearestStore(center, filters.brandIds),
  };
}
