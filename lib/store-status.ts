import type {Store} from '@/lib/types';
import {isOpenNow, parseHours} from '@/lib/hours';

/** A successful Google response never falls back to stale source hours. */
export function storeOpenNow(store: Store, now = new Date()): boolean | null {
  if (store.google) {
    if (store.google.businessStatus === 'CLOSED_PERMANENTLY' || store.google.businessStatus === 'CLOSED_TEMPORARILY') return false;
    return store.google.currentOpeningHours?.openNow ?? null;
  }
  return isOpenNow(parseHours(store.openingHours), now, store.timezone);
}
