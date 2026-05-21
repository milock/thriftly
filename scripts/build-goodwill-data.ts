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

const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

async function fetchAllUSGoodwill(): Promise<Store[]> {
  const query = `[out:json][timeout:1200];
area["ISO3166-1"="US"][admin_level=2]->.us;
(
  nwr["brand"="Goodwill"](area.us);
  nwr["name"~"^Goodwill"]["shop"](area.us);
);
out center tags;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Descriptive UA with contact, per OSM policy.
      "User-Agent": "Thriftly/1.0 (+https://thriftly.xyz; michael@clarityrcm.com)",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return parseOverpass(await res.json());
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
