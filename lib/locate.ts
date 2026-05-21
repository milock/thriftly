import type { ScoredStore, TractDemographics, LatLng } from "@/lib/types";
import { fetchGoodwillStores } from "@/lib/overpass";
import { fetchCountyDemographics } from "@/lib/census";
import { getStateForPoint, reverseAddress } from "@/lib/geocode";
import { loadStateCentroids } from "@/lib/gazetteer";
import { tractsWithinRadius, aggregateCatchment } from "@/lib/catchment";
import { computeGoodsScore } from "@/lib/scoring";
import { haversineMiles } from "@/lib/distance";
import { CATCHMENT_RADIUS_MILES } from "@/lib/reference-ranges";

/**
 * Core orchestration: find Goodwill stores around a point, blend each store's
 * surrounding census catchment, score it, and return the list sorted best-first.
 *
 * Shared by the `/api/stores` route (client search) and the server-rendered
 * city landing pages, so scoring stays identical everywhere. Pure I/O + scoring,
 * no framework coupling. Upstream fetches carry their own Next data-cache TTLs.
 */
export async function locateStores(
  center: LatLng,
  radiusMiles: number,
): Promise<ScoredStore[]> {
  const stores = await fetchGoodwillStores(center, radiusMiles);
  if (stores.length === 0) return [];

  const stateFips = await getStateForPoint(center);
  const centroids = stateFips ? loadStateCentroids(stateFips) : [];

  const perStoreTracts = stores.map((s) =>
    tractsWithinRadius(s.location, centroids, CATCHMENT_RADIUS_MILES),
  );

  const neededCounties = new Set<string>();
  for (const tracts of perStoreTracts) {
    for (const t of tracts) neededCounties.add(t.centroid.geoid.slice(0, 5)); // SSCCC
  }

  const demoByGeoid = new Map<string, TractDemographics>();
  await Promise.allSettled(
    [...neededCounties].map(async (sscc) => {
      const list = await fetchCountyDemographics(sscc.slice(0, 2), sscc.slice(2, 5));
      for (const d of list) demoByGeoid.set(d.geoid, d);
    }),
  );

  const scored: ScoredStore[] = stores.map((store, i) => {
    const weighted = perStoreTracts[i]
      .map((t) => {
        const demo = demoByGeoid.get(t.centroid.geoid);
        return demo ? { demo, distanceMiles: t.distanceMiles } : null;
      })
      .filter((x): x is { demo: TractDemographics; distanceMiles: number } => x !== null);
    const catchment = aggregateCatchment(weighted);
    return {
      ...store,
      distanceMiles: haversineMiles(center, store.location),
      score: computeGoodsScore(catchment),
    };
  });

  scored.sort((a, b) => b.score.total - a.score.total);
  return scored;
}

// How many top-ranked stores to reverse-geocode per request.
const ENRICH_LIMIT = 30;

/**
 * Reverse-geocode the top-ranked stores to add the neighborhood ("Westwood")
 * and backfill any street/city OpenStreetMap was missing. Mutates in place.
 *
 * Kept separate from {@link locateStores} so the ranked list renders
 * immediately and enrichment runs off the critical path: server-side for the
 * SEO city pages (where it must be in the HTML), and via `/api/enrich` for the
 * client search (where cards fill in progressively). Low concurrency plus a
 * per-coordinate weekly cache keep it polite; it soft-fails, so a card just
 * keeps its OSM data if a lookup misses.
 */
export async function enrichStores(stores: ScoredStore[]): Promise<void> {
  await mapWithConcurrency(stores.slice(0, ENRICH_LIMIT), 3, async (s) => {
    const rev = await reverseAddress(s.location.lat, s.location.lon);
    if (!rev) return;
    s.neighborhood = s.neighborhood ?? rev.neighborhood;
    s.street = s.street ?? rev.street;
    s.locality = s.locality ?? rev.locality;
    s.region = s.region ?? rev.region;
    s.address = [s.street, s.locality, s.region].filter(Boolean).join(", ") || s.address;
  });
}

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
