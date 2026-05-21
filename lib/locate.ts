import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScoredStore, TractDemographics, LatLng, NearestHint } from "@/lib/types";
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
interface Dataset {
  generatedAt?: string;
  stores: ScoredStore[];
}
let datasetCache: Dataset | null = null;
function dataset(): Dataset {
  if (datasetCache) return datasetCache;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "goodwill-us.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<Dataset>;
    datasetCache = { generatedAt: parsed.generatedAt, stores: parsed.stores ?? [] };
  } catch {
    datasetCache = { stores: [] };
  }
  return datasetCache;
}
function nationalDataset(): ScoredStore[] {
  return dataset().stores;
}

/** When the bundled dataset was last refreshed (ISO string), for "updated" UI. */
export function datasetGeneratedAt(): string | null {
  return dataset().generatedAt ?? null;
}

/**
 * Force a fresh live lookup (Overpass + Census) for an on-demand "Refresh" — used
 * by the city-page refresh button to pick up stores added to OSM since the last
 * weekly build. Falls back to the bundled dataset if the live mirrors are down or
 * return nothing, so refresh never makes the list worse.
 */
export async function locateStoresFresh(
  center: LatLng,
  radiusMiles: number,
): Promise<ScoredStore[]> {
  try {
    const live = await liveLocate(center, radiusMiles);
    if (live.length > 0) return live;
  } catch {
    /* fall through to the bundled dataset */
  }
  return locateStores(center, radiusMiles);
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
  const data = nationalDataset();
  const hits = data
    .map((s) => ({ ...s, distanceMiles: haversineMiles(center, s.location) }))
    .filter((s) => s.distanceMiles <= radiusMiles)
    .sort((a, b) => b.score.total - a.score.total);
  if (hits.length > 0) return hits;
  // Nothing in range. If the national dataset loaded fine, this is a genuinely
  // sparse area (rural county, remote region) — return instantly and let the
  // caller surface the nearest store. We do NOT hit live Overpass per request:
  // the dataset is the complete US source, so a live call would just add a
  // multi-second hang without finding anything the dataset doesn't already have.
  // Only fall back to live if the dataset itself failed to load (empty file).
  if (data.length === 0) {
    try {
      return await liveLocate(center, radiusMiles);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * The single nearest store in the bundled national dataset, regardless of
 * radius. Used to give a useful answer when a search center has no Goodwill in
 * range (rural counties, remote areas): "nearest is 89 mi away in Redding, CA."
 */
export function nearestStore(center: LatLng): NearestHint | null {
  let best: ScoredStore | null = null;
  let bestMiles = Infinity;
  for (const s of nationalDataset()) {
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
