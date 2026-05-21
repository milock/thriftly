/**
 * Precompute store data for every city in `lib/cities.ts` into
 * `data/cities/<slug>.json`, so the city/state pages are statically pre-rendered
 * and served instantly. Neighborhoods resolve client-side via /api/enrich.
 *
 * Computes directly (Overpass + Census), so it does NOT load production. Runs on
 * a GitHub Actions runner (fresh IP, not rate-limited) on a weekly schedule, and
 * uses the .de Overpass mirror so its bulk traffic never throttles the .fr mirror
 * production depends on. Needs CENSUS_API_KEY in the environment (the workflow
 * passes it; locally it's read from .env.local). Resumable; skips empty results.
 *
 * Run:  npx tsx scripts/build-city-data.ts                 # all cities
 *       npx tsx scripts/build-city-data.ts san-diego-ca    # specific slugs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

// Load .env.local (CENSUS_API_KEY) for local runs; pick the .de mirror. lib reads
// these at call time, so setting them after the hoisted imports is fine.
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* env already provided (e.g. CI) */
}
process.env.OVERPASS_PRIMARY = process.env.OVERPASS_PRIMARY ?? "de";

import { CITIES } from "../lib/cities";
import { locateStores } from "../lib/locate";
import { geocodeAddress } from "../lib/geocode";

const OUT = join(process.cwd(), "data", "cities");
const STALE_DAYS = 6;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type City = (typeof CITIES)[number];

async function processCity(c: City): Promise<"done" | "skipped" | "empty" | "failed"> {
  const file = join(OUT, `${c.slug}.json`);
  if (existsSync(file)) {
    try {
      const j = JSON.parse(readFileSync(file, "utf8"));
      const ageDays = (Date.now() - new Date(j.generatedAt).getTime()) / 86_400_000;
      if (ageDays < STALE_DAYS && Array.isArray(j.stores) && j.stores.length) return "skipped";
    } catch {
      /* re-fetch */
    }
  }
  try {
    const coords = await geocodeAddress(`${c.city}, ${c.state}`);
    if (!coords) return "failed";
    const stores = await locateStores(coords, c.radiusMiles);
    if (stores.length === 0) {
      if (existsSync(file)) rmSync(file); // never persist/keep an empty result
      console.log(`${c.slug}: 0 stores (skipped)`);
      return "empty";
    }
    writeFileSync(
      file,
      JSON.stringify({
        slug: c.slug,
        city: c.city,
        state: c.state,
        lat: coords.lat,
        lon: coords.lon,
        generatedAt: new Date().toISOString(),
        stores,
      }),
    );
    console.log(`${c.slug}: ${stores.length} stores`);
    return "done";
  } catch (e) {
    console.error(`${c.slug} failed:`, (e as Error).message);
    return "failed";
  }
}

async function main() {
  const only = process.argv.slice(2);
  const queue = only.length ? CITIES.filter((c) => only.includes(c.slug)) : [...CITIES];
  const counts = { done: 0, skipped: 0, empty: 0, failed: 0 };
  const worker = async () => {
    for (;;) {
      const c = queue.shift();
      if (!c) return;
      counts[await processCity(c)]++;
      await sleep(250);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(
    `\nprecompute complete: done=${counts.done} skipped=${counts.skipped} empty=${counts.empty} failed=${counts.failed}`,
  );
}

main();
