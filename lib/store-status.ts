import type {Store} from '@/lib/types';
import {isOpenNow, parseHours} from '@/lib/hours';

export function storeOpenNow(store: Store, now = new Date()): boolean | null {
  return isOpenNow(parseHours(store.openingHours), now, store.timezone);
}
