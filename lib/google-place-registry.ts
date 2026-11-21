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

export interface CarriedConfirmation {storeId: string; placeId: string; previousFingerprint: string; identityFingerprint: string; movedMeters: number; basis: string}
const CARRY_METERS = 75;
const normalizeStreet = (value: string | undefined) => (value ?? '').toLowerCase()
  .replace(/\b(street|avenue|road|drive|boulevard|highway|suite|ste|north|south|east|west)\b/g, word => ({street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', highway: 'hwy', suite: '#', ste: '#', north: 'n', south: 's', east: 'e', west: 'w'}[word]!))
  .replace(/[^a-z0-9#]/g, '');
const streetNumber = (value: string | undefined) => value?.trim().match(/^(\d+)/)?.[1];
function metersBetween(a: Store['location'], b: Store['location']) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/**
 * Keep a confirmed Google identity through small source edits (a re-geocoded pin,
 * "Street" becoming "St", a banner tweak), so routine refreshes no longer drop
 * listings now that no paid re-match runs. Only the same directory ID, brand and
 * facility type within 75 m qualifies, with the same street number or the same
 * normalized street. Anything bigger stays unpublished until verified again.
 */
export function carryForwardConfirmations(registry: GooglePlaceRegistry, previous: readonly Store[], current: readonly Store[]): {registry: GooglePlaceRegistry; carried: CarriedConfirmation[]} {
  const before = new Map(previous.map(store => [store.id, store]));
  const after = new Map(current.map(store => [store.id, store]));
  const carried: CarriedConfirmation[] = [];
  const records = registry.records.map(row => {
    const old = before.get(row.storeId), next = after.get(row.storeId);
    if (!old || !next || row.identityFingerprint !== listingIdentityFingerprint(old)) return row;
    const identityFingerprint = listingIdentityFingerprint(next);
    if (identityFingerprint === row.identityFingerprint) return row;
    const movedMeters = metersBetween(old.location, next.location);
    if (old.brandId !== next.brandId || old.facilityType !== next.facilityType || movedMeters > CARRY_METERS) return row;
    const sameStreet = !!old.street && normalizeStreet(old.street) === normalizeStreet(next.street);
    const sameNumber = !!streetNumber(old.street ?? old.address) && streetNumber(old.street ?? old.address) === streetNumber(next.street ?? next.address);
    if (!sameStreet && !sameNumber) return row;
    carried.push({storeId: row.storeId, placeId: row.placeId, previousFingerprint: row.identityFingerprint, identityFingerprint, movedMeters: Math.round(movedMeters), basis: sameStreet ? 'same-street' : 'same-street-number'});
    return {...row, identityFingerprint};
  });
  return {registry: {version: 1, records}, carried};
}
