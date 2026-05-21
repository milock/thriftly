/**
 * Precompute store data for every city in `lib/cities.ts` into
 * `data/cities/<slug>.json`, so the city/state pages are statically pre-rendered
 * and served instantly. Neighborhoods resolve client-side via /api/enrich.
 *
 * Hits the deployed site's APIs (which hold the Census key server-side and are
 * Overpass-resilient), at low concurrency so it never throttles production.
 * Resumable (skips fresh files) and skips empty results.
 *
 * Run:  npx tsx scripts/build-city-data.ts                 # all cities
 *       npx tsx scripts/build-city-data.ts san-diego-ca    # specific slugs
 *       BASE_URL=http://localhost:3000 npx tsx scripts/build-city-data.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CITIES } from "../lib/cities";

const BASE = process.env.BASE_URL ?? "https://www.thriftly.xyz";
const OUT = join(process.cwd(), "data", "cities");
const STALE_DAYS = 6;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 2);
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type City = (typeof CITIES)[number];

async function geocode(c: City): Promise<{ lat: number; lon: number } | null> {
  try {
    const r = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(`${c.city}, ${c.state}`)}`);
    if (!r.ok) return null;
    return (await r.json()).location ?? null;
  } catch {
    return null;
  }
}

async function fetchStores(lat: number, lon: number, radius: number) {
  const r = await fetch(`${BASE}/api/stores?lat=${lat}&lon=${lon}&radius=${radius}`);
  if (!r.ok) throw new Error(`stores HTTP ${r.status}`);
  return (await r.json()).stores ?? [];
}

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
    const coords = await geocode(c);
    if (!coords) return "failed";
    const stores = await fetchStores(coords.lat, coords.lon, c.radiusMiles);
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
