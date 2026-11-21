import { allBundledStores } from '@/lib/locate';
import { cityCentroid } from '@/lib/city-data';
import { haversineMiles } from '@/lib/distance';
import type { ScoredStore } from '@/lib/types';

const LOS_ANGELES_OUTLET_IDS = new Set([
  'goodwill/49572e5e-32cf-e411-b4ab-0050568924e6',
  'node/12431931814',
]);

/** Operator-selected outlets, subject to the same public identity gate as search.
 * Exact source IDs keep neighboring regular retail stores out of this guide. */
export function losAngelesOutlets(): ScoredStore[] {
  const center = cityCentroid('los-angeles-ca');
  return allBundledStores()
    .filter(store => LOS_ANGELES_OUTLET_IDS.has(store.id) && store.facilityType === 'outlet' && !!store.googlePlaceId)
    .map(store => ({ ...store, distanceMiles: center ? haversineMiles(center, store.location) : store.distanceMiles }));
}
