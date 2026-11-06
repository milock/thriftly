import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScoredStore, LatLng, NearestHint } from "@/lib/types";
import { haversineMiles } from "@/lib/distance";
import { computeVisitScore } from "@/lib/visit-score";
import { hasNeighborhoodBaseline } from "@/lib/scoring";
import { matchesBrands } from "@/lib/brands";
import { confirmedPlaceIds, parseGooglePlaceRegistry } from "@/lib/google-place-registry";

// The bundled, pre-scored national store dataset (built by the weekly job from
// classified source snapshots). Read once and memoized. This is the primary data source:
// no Overpass/Census/geocoding at request time, so search and city pages are
// instant and can't be rate-limited.
interface Dataset {
  generatedAt?: string;
  sourceUpdatedAt?: string;
  stores: ScoredStore[];
}
let datasetCache: Dataset | null = null;
function dataset(): Dataset {
  if (datasetCache) return datasetCache;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "stores-us.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<Dataset>;
    let access: {records?: {storeId: string; location: LatLng; score: number | null}[]} = {};
    try { access = JSON.parse(readFileSync(join(process.cwd(), "data", "store-access.json"), "utf8")); } catch { /* Missing evidence remains absent. */ }
    const walkability = new Map((access.records ?? []).map(record => [record.storeId, record]));
    const stores = (parsed.stores ?? []).map(store => {
      const record = walkability.get(store.id);
      const validLocation = record?.location.lat === store.location.lat && record?.location.lon === store.location.lon;
      const visit = computeVisitScore({neighborhood: hasNeighborhoodBaseline(store.score) ? store.score.total : null, googleRatings: null, walkability: validLocation ? record!.score : null});
      return {...store, score: {...store.score, baselineTotal: store.score.total, total: visit.total ?? store.score.total, visit}};
    });
    datasetCache = { generatedAt: parsed.generatedAt, sourceUpdatedAt: parsed.sourceUpdatedAt, stores };
  } catch {
    datasetCache = { stores: [] };
  }
  return datasetCache;
}
let publishedCache: ScoredStore[] | null = null;
function nationalDataset(): ScoredStore[] {
  if (publishedCache) return publishedCache;
  let registry = parseGooglePlaceRegistry(null);
  try { registry = parseGooglePlaceRegistry(JSON.parse(readFileSync(join(process.cwd(), 'data', 'google-place-ids.json'), 'utf8'))); } catch { /* No confirmed identities means no public stores. */ }
  const ids = confirmedPlaceIds(dataset().stores, registry);
  publishedCache = dataset().stores.flatMap(store => {
    const googlePlaceId = ids.get(store.id);
    return googlePlaceId ? [{...store, googlePlaceId}] : [];
  });
  return publishedCache;
}

/** Matching jobs only. Never use this unconfirmed catalog in a public route or page. */
export function allCandidateStores(): readonly ScoredStore[] { return dataset().stores; }

export function allBundledStores(): readonly ScoredStore[] { return nationalDataset(); }

/** When the bundled dataset was last refreshed (ISO string), for "updated" UI. */
export function datasetGeneratedAt(brandIds: readonly string[] = []): string | null {
  // Independent records currently carry review dates, not publisher update dates.
  if (brandIds.includes('independent') || (!brandIds.length && nationalDataset().some(store => store.operatorType === 'independent' && !store.provenance?.sourceUpdatedAt))) return null;
  if (brandIds.length) {
    const dates = nationalDataset().filter(s => matchesBrands(s, brandIds))
      .map(s => s.provenance?.sourceUpdatedAt).filter((date): date is string => !!date && Number.isFinite(Date.parse(date)));
    if (dates.length) return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  }
  return dataset().sourceUpdatedAt ?? dataset().generatedAt ?? null;
}

/** Reload the published operator snapshot without inventing a newer source date. */
export async function locateStoresFresh(
  center: LatLng,
  radiusMiles: number,
  brandIds: readonly string[] = [],
): Promise<{ stores: ScoredStore[]; generatedAt: string | null }> {
  // Reload the published, classified operator data. A Goodwill-only OSM lookup
  // must never replace a mixed-brand city list or claim a newer source date.
  return {stores: await locateStores(center, radiusMiles, brandIds), generatedAt: datasetGeneratedAt(brandIds)};
}

/** Deterministic local data only: safe for indexability checks and sitemaps. */
export function locateBundledStores(center: LatLng, radiusMiles: number, brandIds: readonly string[] = []): ScoredStore[] {
  return nationalDataset()
    .filter(s => matchesBrands(s, brandIds))
    .map(s => ({...s, distanceMiles:haversineMiles(center,s.location)}))
    .filter(s => s.distanceMiles <= radiusMiles)
    .sort((a,b) => b.score.total-a.score.total);
}

/** Only durable, fingerprint-matched identities may enter any public search. */
export async function locateStores(
  center: LatLng,
  radiusMiles: number,
  brandIds: readonly string[] = [],
): Promise<ScoredStore[]> {
  return locateBundledStores(center, radiusMiles, brandIds);
}

/**
 * The single nearest store in the bundled national dataset, regardless of
 * radius. Used to give a useful answer when a search center has no stores in
 * range (rural counties, remote areas): "nearest is 89 mi away in Redding, CA."
 */
export function nearestStore(center: LatLng, brandIds: readonly string[] = []): NearestHint | null {
  let best: ScoredStore | null = null;
  let bestMiles = Infinity;
  for (const s of nationalDataset()) {
    if (!matchesBrands(s, brandIds)) continue;
    const d = haversineMiles(center, s.location);
    if (d < bestMiles) {
      bestMiles = d;
      best = s;
    }
  }
  if (!best) return null;
  return {
    name: best.name,
    locality: best.locality,
    region: best.region,
    distanceMiles: bestMiles,
    location: best.location,
  };
}

/** Restrict enrichment to the finite set of published store coordinates. */
export function isKnownStorePoint(lat: number, lon: number): boolean {
  return nationalDataset().some(s => s.location.lat === lat && s.location.lon === lon);
}
