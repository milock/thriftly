import type { Store } from '@/lib/types';

export type FacilityType = NonNullable<Store['facilityType']>;
export interface FacilityClassification { facilityType: FacilityType; basis: string; publicShopping: boolean }

/** Require affirmative shopping evidence; a Goodwill brand alone is not a store. */
export function classifyGoodwill(tags: Record<string, string | undefined>): FacilityClassification {
  const name = tags.name ?? tags.brand ?? '';
  const brand = tags.brand ?? '';
  const result = (facilityType: FacilityType, basis: string, publicShopping = false) => ({facilityType,basis,publicShopping});
  if (!/^goodwill\b/i.test(name) && !/^goodwill\b/i.test(brand) && tags['brand:wikidata'] !== 'Q5583655') return result('unknown','not-goodwill');
  if (tags.disused === 'yes' || tags.abandoned === 'yes' || ['vacant','no'].includes(tags.shop ?? '') ||
      tags['disused:shop'] || tags['abandoned:shop'] || tags['demolished:shop'] || tags['razed:shop'] ||
      /\b(?:permanently closed|closed permanently)\b/i.test(name)) return result('unknown','closed-or-disused');
  if (tags.amenity === 'parking' || /\bparking(?: lot| garage)?\b/i.test(name)) return result('unknown','parking-feature');
  const shop = tags.shop ?? '';
  const retailTag = ['charity','second_hand','clothes','books','department_store','furniture','general','variety_store'].includes(shop);
  // Outlets often share a warehouse address. Explicit outlet service wins over building form.
  if (/\b(outlet|bins|bargain barn)\b/i.test(name)) return result('outlet','explicit-outlet-name',true);
  if (/\b(store|retail|boutique|bookstore|shop)\b/i.test(name) && !/\b(?:no retail|not a store)\b/i.test(name)) return result('retail','explicit-retail-name',true);
  if (/\b(warehouse|distribution|logistics|processing)\b/i.test(name) || tags.building === 'warehouse' || tags.industrial === 'warehouse') return result('warehouse','warehouse-or-distribution');
  if (/\b(headquarters|corporate|offices?)\b/i.test(name) || tags.office) return result('office','office-or-headquarters');
  if (/\b(career|training|education|school|employment|job center|job centre)\b/i.test(name) || ['school','college','social_facility'].includes(tags.amenity ?? '')) return result('services','non-retail-services');
  if (/\b(donation|donations|drop.?off|drive.?up|donate)\b/i.test(name) || tags.amenity === 'recycling') return result('donation','donation-without-retail-evidence');
  if (retailTag) return result('retail',`shop=${shop}`,true);
  return result('unknown','no-positive-retail-evidence');
}

/** Collapse duplicated OSM point/building records only with a matching address. */
export function deduplicateStores(stores: Store[]): Store[] {
  const out: Store[]=[];
  const byAddress=new Map<string,Store[]>();
  for (const store of stores) {
    const key=(store.address ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const candidates=key ? byAddress.get(key) ?? [] : [];
    const duplicate=candidates.find(s=>s.facilityType===store.facilityType &&
      Math.abs(s.location.lat-store.location.lat)<0.0005 && Math.abs(s.location.lon-store.location.lon)<0.0007);
    if (duplicate) { duplicate.sourceAliases=[...new Set([...(duplicate.sourceAliases ?? []),store.id,...(store.sourceAliases ?? [])])]; continue; }
    out.push(store);
    if(key)byAddress.set(key,[...candidates,store]);
  }
  return out;
}
