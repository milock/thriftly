/**
 * Builds the bundled national Goodwill dataset (`data/goodwill-us.json`) that the
 * app serves at request time. Runs weekly on a GitHub runner.
 *
 * Per the OSM usage research: ONE nationwide Overpass query (a few thousand
 * features), then score every store OFFLINE against the bundled Census tract
 * centroids + Census ACS. No per-city queries, no Nominatim, no request-time
 * upstream calls. Needs CENSUS_API_KEY in the environment for scoring.
 *
 * Run:  CENSUS_API_KEY=... npx tsx scripts/build-goodwill-data.ts
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Load CENSUS_API_KEY from .env.local for local runs (CI passes it via env).
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* env already provided */
}

import type { Store, ScoredStore, TractCentroid, TractDemographics } from "../lib/types";
import { parseOverpass } from "../lib/overpass";
import { fetchCountyDemographics } from "../lib/census";
import { tractsWithinRadius, aggregateCatchment } from "../lib/catchment";
import { computeGoodsScore } from "../lib/scoring";
import { CATCHMENT_RADIUS_MILES } from "../lib/reference-ranges";
import { STATES } from "../lib/cities";

// Overpass mirrors, tried in turn on retry so one throttling/flaky endpoint
// doesn't leave a state empty. The primary can be overridden via OVERPASS_URL.
const MIRRORS = [
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (url: string) => new URL(url).host;

// Fetch one state's Goodwill stores. Every US state has multiple Goodwill
// locations, so a 0-result response almost always means a transient Overpass
// hiccup (throttle, partial response) rather than a real absence — so we retry,
// cycling mirrors and backing off, before accepting an empty result. This is
// what keeps states like ND/SD/MT from silently dropping out of the dataset.
async function fetchState(code: string): Promise<Store[]> {
  // Match the live query's breadth (lib/overpass.ts): prefix match on brand or
  // name catches "Goodwill", "Goodwill Store/Outlet", "Goodwill Industries", etc.
  const query = `[out:json][timeout:180];
area["ISO3166-2"="US-${code}"][admin_level=4]->.s;
(
  nwr["brand"~"^Goodwill"](area.s);
  nwr["name"~"^Goodwill"](area.s);
);
out center tags;`;
  const body = `data=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const endpoint = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Thriftly/1.0 (+https://thriftly.xyz; michael@clarityrcm.com)",
        },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        console.error(`  ${code} attempt ${attempt + 1} (${host(endpoint)}): HTTP ${res.status}`);
      } else {
        const stores = parseOverpass(await res.json());
        if (stores.length > 0) return stores;
        console.error(`  ${code} attempt ${attempt + 1} (${host(endpoint)}): 0 stores, retrying`);
      }
    } catch (e) {
      console.error(`  ${code} attempt ${attempt + 1} (${host(endpoint)}): ${(e as Error).message}`);
    }
    await sleep(10_000); // back off before retrying (gentle on the mirrors)
  }
  console.error(`  ${code}: still 0 after all retries`);
  return [];
}

// One small query PER STATE (sequential, gently paced), not one giant US query.
// A whole-US query trips undici's headers timeout and stresses Overpass; per-state
// queries each return fast and, spaced out, stay well within usage limits.
async function fetchAllUSGoodwill(): Promise<Store[]> {
  const seen = new Map<string, Store>();
  const empties: string[] = [];
  for (const st of STATES) {
    const stores = await fetchState(st.code);
    if (stores.length === 0) empties.push(st.code);
    for (const s of stores) if (!seen.has(s.id)) seen.set(s.id, s);
    console.log(`${st.code}: ${stores.length} stores (running total ${seen.size})`);
    await sleep(10_000); // gentle pause between states
  }
  if (empties.length) console.warn(`states still empty after retries: ${empties.join(", ")}`);
  return [...seen.values()];
}

function loadAllCentroids(): TractCentroid[] {
  const dir = join(process.cwd(), "data", "tract-centroids");
  const all: TractCentroid[] = [];
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".json")) all.push(...JSON.parse(readFileSync(join(dir, f), "utf8")));
  }
  return all;
}

async function main() {
  console.log("querying all US Goodwill stores (one Overpass query)...");
  const stores = await fetchAllUSGoodwill();
  console.log(`fetched ${stores.length} stores`);
  if (stores.length < 100) throw new Error(`suspiciously few stores (${stores.length}); aborting`);

  const centroids = loadAllCentroids();
  console.log(`loaded ${centroids.length} tract centroids; computing catchments...`);
  const perStoreTracts = stores.map((s) =>
    tractsWithinRadius(s.location, centroids, CATCHMENT_RADIUS_MILES),
  );

  const neededCounties = new Set<string>();
  for (const tracts of perStoreTracts) {
    for (const t of tracts) neededCounties.add(t.centroid.geoid.slice(0, 5));
  }
  const counties = [...neededCounties];
  console.log(`fetching Census ACS for ${counties.length} counties...`);

  const demoByGeoid = new Map<string, TractDemographics>();
  let idx = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const worker = async () => {
    while (idx < counties.length) {
      const sscc = counties[idx++];
      try {
        const list = await fetchCountyDemographics(sscc.slice(0, 2), sscc.slice(2, 5));
        for (const d of list) demoByGeoid.set(d.geoid, d);
      } catch {
        /* skip county on error */
      }
      await sleep(80);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  const scored: ScoredStore[] = stores.map((store, i) => {
    const weighted = perStoreTracts[i]
      .map((t) => {
        const demo = demoByGeoid.get(t.centroid.geoid);
        return demo ? { demo, distanceMiles: t.distanceMiles } : null;
      })
      .filter((x): x is { demo: TractDemographics; distanceMiles: number } => x !== null);
    return {
      ...store,
      distanceMiles: 0, // recomputed per search center at request time
      score: computeGoodsScore(aggregateCatchment(weighted)),
    };
  });

  const scoredCount = scored.filter((s) => s.score.total > 0).length;
  writeFileSync(
    join(process.cwd(), "data", "goodwill-us.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: scored.length, stores: scored }),
  );
  console.log(`wrote data/goodwill-us.json: ${scored.length} stores (${scoredCount} with a score)`);
}

main();
