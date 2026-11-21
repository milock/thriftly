import type { Store } from './types';
import type { ExpandedStore } from './expanded-store-sources';

function officialUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

/** An import timestamp is insufficient: require the separately recorded review. */
export function hasOnlineVerification(store: Pick<Store, 'verification' | 'provenance'>, now = Date.now()): boolean {
  const review = store.verification;
  return !!review && review.method === 'official-website-review' &&
    /^\d{4}-\d{2}-\d{2}T/.test(review.checkedAt) &&
    Number.isFinite(Date.parse(review.checkedAt)) && Date.parse(review.checkedAt) <= now &&
    Array.isArray(review.sourceUrls) && review.sourceUrls.length > 0 && review.sourceUrls.every(officialUrl) &&
    !!store.provenance?.sourceUrl && review.sourceUrls.includes(store.provenance.sourceUrl);
}

/** Curated pilot only. New cities or classification changes require a code review. */
export function parseIndependentStores(input: { stores: ExpandedStore[] }, now = Date.now()): ExpandedStore[] {
  if (!Array.isArray(input?.stores) || input.stores.length === 0) throw new Error('Independent pilot is empty');
  const ids = new Set<string>();
  for (const store of input.stores) {
    if (!/^independent\/[a-z0-9-]+$/.test(store.id) || ids.has(store.id) ||
        store.operatorType !== 'independent' || store.facilityType !== 'retail' ||
        !store.operator || !store.name || !store.brandId || store.brandId === 'goodwill' ||
        store.locality !== 'San Diego' || store.region !== 'CA' ||
        !store.street || !/^\d+\s/.test(store.street) || !store.address?.startsWith(store.street) ||
        !Number.isFinite(store.location?.lat) || !Number.isFinite(store.location?.lon) ||
        store.location.lat < 32.65 || store.location.lat > 32.85 ||
        store.location.lon < -117.3 || store.location.lon > -117 ||
        !officialUrl(store.website) || !hasOnlineVerification(store, now) ||
        store.provenance?.source !== 'official-independent-website' ||
        store.sourceTags?.coordinateMethod !== 'census-address-range-match') {
      throw new Error(`Independent store requires a complete retail, address and operator review: ${store.id}`);
    }
    ids.add(store.id);
  }
  return input.stores;
}
