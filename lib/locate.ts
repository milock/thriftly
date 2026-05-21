import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScoredStore, TractDemographics, LatLng } from "@/lib/types";
import { fetchGoodwillStores } from "@/lib/overpass";
import { fetchCountyDemographics } from "@/lib/census";
import { getStateForPoint } from "@/lib/geocode";
import { loadStateCentroids } from "@/lib/gazetteer";
import { tractsWithinRadius, aggregateCatchment } from "@/lib/catchment";
import { computeGoodsScore } from "@/lib/scoring";
import { haversineMiles } from "@/lib/distance";
import { CATCHMENT_RADIUS_MILES } from "@/lib/reference-ranges";

// The bundled, pre-scored national Goodwill dataset (built by the weekly job from
// one Overpass query). Read once and memoized. This is the primary data source:
// no Overpass/Census/geocoding at request time, so search and city pages are
// instant and can't be rate-limited.
let nationalCache: ScoredStore[] | null = null;
function nationalDataset(): ScoredStore[] {
  if (nationalCache) return nationalCache;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "goodwill-us.json"), "utf8");
    nationalCache = (JSON.parse(raw).stores ?? []) as ScoredStore[];
  } catch {
    nationalCache = [];
  }
  return nationalCache;
}

/**
 * Find scored Goodwill stores around a point, sorted best-first. Filters the
 * bundled national dataset first (instant, network-free, throttle-proof); for
 * any area the dataset doesn't cover yet, falls back to a live lookup.
 *
 * Shared by the `/api/stores` route (client search) and the city landing pages.
 */
export async function locateStores(
  center: LatLng,
  radiusMiles: number,
): Promise<ScoredStore[]> {
  const hits = nationalDataset()
    .map((s) => ({ ...s, distanceMiles: haversineMiles(center, s.location) }))
    .filter((s) => s.distanceMiles <= radiusMiles)
    .sort((a, b) => b.score.total - a.score.total);
  if (hits.length > 0) return hits;
  // Dataset miss (an area not covered yet): try a live lookup, but degrade to an
  // empty result rather than an error if the live mirrors are unavailable — the
  // weekly national dataset is what gives full coverage.
  try {
    return await liveLocate(center, radiusMiles);
  } catch {
    return [];
  }
}

/**
 * Live lookup (Overpass + Census) for areas the bundled dataset doesn't cover.
 * Rare once the dataset is complete; kept resilient (multi-mirror, time-boxed).
 */
async function liveLocate(center: LatLng, radiusMiles: number): Promise<ScoredStore[]> {
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
