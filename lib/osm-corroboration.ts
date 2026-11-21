import type { LatLng, Store } from '@/lib/types';
import { haversineMiles } from '@/lib/distance';
import { listingIdentityFingerprint } from '@/lib/google-place-registry';

/**
 * Free, independent identity check for listings Google never confirmed.
 *
 * A listing is corroborated when an OpenStreetMap shop of the same brand sits at
 * the same place: within 60 m, or within 150 m with the same street number. OSM is
 * mapped by volunteers from the street, separately from the operator locators the
 * registry is built from, so agreement between the two is meaningful evidence that
 * a public shop exists there. OSM data stays a check only: no OSM-only records are
 * published, and only the OSM element id is kept (attributed on the site).
 */
export const NEAR_METERS = 60;
export const ADDRESS_METERS = 150;
/** Google decisions that are evidence against publishing, whatever OSM says. */
export const BLOCKING_GOOGLE_REASONS = new Set(['closed', 'facility-mismatch', 'duplicate-identity']);

export interface OsmShop { id: string; lat: number; lon: number; tags: Record<string, string> }
export interface OsmSnapshot { source: 'openstreetmap-overpass'; license: 'ODbL-1.0'; osmBase: string; fetchedAt: string; elements: OsmShop[] }
export interface StoreCorroboration {
  storeId: string; osmId: string; identityFingerprint: string;
  distanceMeters: number; basis: 'osm-brand-nearby' | 'osm-brand-and-street-number'; checkedAt: string;
}
export interface CorroborationRegistry { version: 1; osmBase?: string; records: StoreCorroboration[] }

const BRANDS: Record<string, RegExp> = {
  goodwill: /\bgoodwill\b/i,
  savers: /\b(savers|value village|village des valeurs|unique thrift|2nd ave(nue)?\.? thrift)\b/i,
  'buffalo-exchange': /\bbuffalo (exchange|outlet)\b/i,
  'salvation-army': /\bsalvation army\b/i,
  'out-of-the-closet': /\bout of the closet\b/i,
};
const WIKIDATA: Record<string, string> = {goodwill: 'Q5583655'};
/** The tags kept from Overpass. Everything else is dropped before caching. */
export const OSM_KEPT_TAGS = ['name', 'brand', 'brand:wikidata', 'operator', 'shop', 'second_hand', 'opening_hours', 'addr:housenumber', 'addr:street', 'addr:state'];

export function osmBrandMatches(tags: Record<string, string | undefined>, brandId: string | undefined): boolean {
  if (!brandId) return false;
  if (WIKIDATA[brandId] && tags['brand:wikidata'] === WIKIDATA[brandId]) return true;
  const pattern = BRANDS[brandId];
  return !!pattern && [tags.brand, tags.name, tags.operator].some(value => !!value && pattern.test(value));
}

/** A shop someone can walk into. Donation-only drop-offs, offices and closed shops never corroborate. */
export function isOsmPublicShop(tags: Record<string, string | undefined>): boolean {
  const shop = tags.shop ?? '';
  const secondHandShop = shop === 'charity' || shop === 'second_hand' || (['clothes', 'furniture', 'books', 'variety_store', 'department_store'].includes(shop) && ['only', 'yes'].includes(tags.second_hand ?? ''));
  if (!secondHandShop) return false;
  const name = `${tags.name ?? ''} ${tags.brand ?? ''}`;
  if (/\b(donation|donations|drop.?off|drive.?thru|attended donation|headquarters|offices?|warehouse|distribution|career|training)\b/i.test(name) && !/\b(store|thrift|outlet|shop|boutique|retail)\b/i.test(name)) return false;
  if (/\b(permanently closed|closed permanently)\b/i.test(name) || ['closed', 'off'].includes((tags.opening_hours ?? '').trim().toLowerCase())) return false;
  return true;
}

function streetNumber(value: string | undefined): string | undefined {
  return value?.trim().match(/^(\d+[a-z]?)\b/i)?.[1]?.toLowerCase();
}
const meters = (a: LatLng, b: LatLng) => haversineMiles(a, b) * 1609.344;

/** Grid index so the nationwide join stays linear. ~0.01° ≈ 1.1 km cells. */
function index(elements: readonly OsmShop[]) {
  const cells = new Map<string, OsmShop[]>();
  for (const element of elements) {
    const key = `${Math.floor(element.lat * 100)},${Math.floor(element.lon * 100)}`;
    cells.set(key, [...(cells.get(key) ?? []), element]);
  }
  return (point: LatLng) => {
    const lat = Math.floor(point.lat * 100), lon = Math.floor(point.lon * 100);
    const near: OsmShop[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.push(...(cells.get(`${lat + dy},${lon + dx}`) ?? []));
    return near;
  };
}

/**
 * One OSM shop may vouch for one listing, and a listing needs one unambiguous shop.
 * A node and its building outline for the same shop (within 50 m of each other)
 * count as one place. Anything else ambiguous stays unpublished.
 */
export function corroborateStores(stores: readonly Store[], elements: readonly OsmShop[], options: {blocked?: ReadonlySet<string>; now?: Date} = {}): StoreCorroboration[] {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const nearby = index(elements.filter(element => isOsmPublicShop(element.tags)));
  const proposals: StoreCorroboration[] = [];
  for (const store of stores) {
    if (options.blocked?.has(store.id) || !['retail', 'outlet'].includes(store.facilityType ?? 'retail')) continue;
    const number = streetNumber(store.street ?? store.address);
    const matches = nearby(store.location).filter(element => osmBrandMatches(element.tags, store.brandId)).flatMap((element): {element: OsmShop; distance: number; basis: StoreCorroboration['basis']}[] => {
      const distance = meters(store.location, element);
      if (distance <= NEAR_METERS) return [{element, distance, basis: 'osm-brand-nearby'}];
      if (distance <= ADDRESS_METERS && number && streetNumber(element.tags['addr:housenumber']) === number) return [{element, distance, basis: 'osm-brand-and-street-number'}];
      return [];
    }).sort((a, b) => a.distance - b.distance);
    if (!matches.length) continue;
    if (matches.some(match => meters(match.element, matches[0].element) > 50)) continue;
    const best = matches[0];
    proposals.push({storeId: store.id, osmId: best.element.id, identityFingerprint: listingIdentityFingerprint(store), distanceMeters: Math.round(best.distance), basis: best.basis, checkedAt});
  }
  const claims = new Map<string, number>();
  for (const proposal of proposals) claims.set(proposal.osmId, (claims.get(proposal.osmId) ?? 0) + 1);
  return proposals.filter(proposal => claims.get(proposal.osmId) === 1).sort((a, b) => a.storeId.localeCompare(b.storeId));
}

export function parseCorroborationRegistry(value: unknown): CorroborationRegistry {
  if (!value || typeof value !== 'object' || (value as CorroborationRegistry).version !== 1 || !Array.isArray((value as CorroborationRegistry).records)) return {version: 1, records: []};
  const records = (value as CorroborationRegistry).records.filter(row =>
    row && typeof row === 'object' && typeof row.storeId === 'string' && row.storeId.length > 0 && row.storeId.length <= 200 &&
    typeof row.osmId === 'string' && /^(node|way|relation)\/\d{1,15}$/.test(row.osmId) &&
    typeof row.identityFingerprint === 'string' && /^[a-f0-9]{64}$/.test(row.identityFingerprint) &&
    Number.isFinite(row.distanceMeters) && row.distanceMeters >= 0 && row.distanceMeters <= ADDRESS_METERS &&
    (row.basis === 'osm-brand-nearby' || row.basis === 'osm-brand-and-street-number') &&
    typeof row.checkedAt === 'string' && Number.isFinite(Date.parse(row.checkedAt)));
  return {version: 1, osmBase: typeof (value as CorroborationRegistry).osmBase === 'string' ? (value as CorroborationRegistry).osmBase : undefined, records};
}

/** Current listings whose identity is unchanged since OSM corroborated them. */
export function corroboratedStoreIds(stores: readonly Store[], registry: CorroborationRegistry): ReadonlySet<string> {
  const candidates = new Map(stores.map(store => [store.id, store]));
  const counts = new Map<string, number>();
  for (const row of registry.records) counts.set(row.storeId, (counts.get(row.storeId) ?? 0) + 1);
  return new Set(registry.records.filter(row => {
    const store = candidates.get(row.storeId);
    return store && counts.get(row.storeId) === 1 && row.identityFingerprint === listingIdentityFingerprint(store);
  }).map(row => row.storeId));
}
