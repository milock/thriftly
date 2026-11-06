import { createHash } from 'node:crypto';
import type { Store } from '@/lib/types';

export interface GooglePlaceConfirmation {
  storeId: string;
  placeId: string;
  identityFingerprint: string;
  checkedAt: string;
}
export interface GooglePlaceRegistry { version: 1; records: GooglePlaceConfirmation[] }

/** Uses independent directory identity only; scores and live Google content never enter it. */
export function listingIdentityFingerprint(store: Store): string {
  return createHash('sha256').update(JSON.stringify([
    store.id, store.name, store.brandId, store.brand, store.operatorType,
    store.facilityType, store.street, store.address, store.locality, store.region,
    store.location.lat, store.location.lon,
  ])).digest('hex');
}

export function parseGooglePlaceRegistry(value: unknown): GooglePlaceRegistry {
  if (!value || typeof value !== 'object' || (value as GooglePlaceRegistry).version !== 1 || !Array.isArray((value as GooglePlaceRegistry).records)) return {version: 1, records: []};
  const records = (value as GooglePlaceRegistry).records.filter(row =>
    row && typeof row === 'object' && typeof row.storeId === 'string' && row.storeId.length > 0 && row.storeId.length <= 200 &&
    typeof row.placeId === 'string' && /^[\w-]{6,512}$/.test(row.placeId) &&
    typeof row.identityFingerprint === 'string' && /^[a-f0-9]{64}$/.test(row.identityFingerprint) &&
    typeof row.checkedAt === 'string' && Number.isFinite(Date.parse(row.checkedAt)),
  ).map(({storeId, placeId, identityFingerprint, checkedAt}) => ({storeId, placeId, identityFingerprint, checkedAt}));
  return {version: 1, records};
}

/** Fail closed on changed identities, duplicate directory IDs, or shared Google IDs. */
export function confirmedPlaceIds(stores: readonly Store[], registry: GooglePlaceRegistry): ReadonlyMap<string, string> {
  const candidates = new Map(stores.map(store => [store.id, store]));
  const rows = registry.records.filter(row => {
    const store = candidates.get(row.storeId);
    return store && row.identityFingerprint === listingIdentityFingerprint(store);
  });
  const storeCounts = new Map<string, number>();
  const placeCounts = new Map<string, number>();
  for (const row of rows) {
    storeCounts.set(row.storeId, (storeCounts.get(row.storeId) ?? 0) + 1);
    placeCounts.set(row.placeId, (placeCounts.get(row.placeId) ?? 0) + 1);
  }
  return new Map(rows.filter(row => storeCounts.get(row.storeId) === 1 && placeCounts.get(row.placeId) === 1).map(row => [row.storeId, row.placeId]));
}
