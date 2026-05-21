/**
 * Precompute store data for every city in `lib/cities.ts` into
 * `data/cities/<slug>.json`, so the city/state pages can be statically
 * pre-rendered and served instantly (no live Overpass/Census on the request
 * path). Neighborhoods are still resolved client-side via /api/enrich.
 *
 * Run:  BASE_URL=https://www.thriftly.xyz npx tsx scripts/build-city-data.ts
 *       (or BASE_URL=http://localhost:3000 against a local prod server)
 *
 * Resumable: skips cities whose JSON is fresh. Polite: geocodes via the public
 * Census geocoder (Nominatim fallback) and hits our own /api/stores (which
 * caches Overpass/Census server-side), with a delay between cities.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CITIES } from "../lib/cities";

const BASE = process.env.BASE_URL ?? "https://www.thriftly.xyz";
const OUT = join(process.cwd(), "data", "cities");
const RADIUS = 15;
const STALE_DAYS = 6;

mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(`${city}, ${state}`);
  try {
    const r = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${q}&benchmark=Public_AR_Current&format=json`,
    );
    if (r.ok) {
      const d = await r.json();
      const m = d?.result?.addressMatches?.[0];
      if (m) return { lat: m.coordinates.y, lon: m.coordinates.x };
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&countrycodes=us&limit=1`,
      { headers: { "User-Agent": "thriftly-precompute/1.0 (+https://thriftly.xyz)" } },
    );
    const a = await r.json();
    if (Array.isArray(a) && a[0]) return { lat: parseFloat(a[0].lat), lon: parseFloat(a[0].lon) };
  } catch {
    /* give up */
  }
  return null;
}

type City = (typeof CITIES)[number];

async function processCity(c: City): Promise<"done" | "skipped" | "failed"> {
  const file = join(OUT, `${c.slug}.json`);
  if (existsSync(file)) {
    try {
      const j = JSON.parse(readFileSync(file, "utf8"));
      const ageDays = (Date.now() - new Date(j.generatedAt).getTime()) / 86_400_000;
      if (ageDays < STALE_DAYS && Array.isArray(j.stores) && j.stores.length) return "skipped";
    } catch {
      /* re-fetch on parse error */
    }
  }
  const coords = await geocode(c.city, c.state);
  if (!coords) {
    console.error(`geocode failed: ${c.slug}`);
    return "failed";
  }
  try {
    const r = await fetch(`${BASE}/api/stores?lat=${coords.lat}&lon=${coords.lon}&radius=${RADIUS}`);
    if (!r.ok) throw new Error(`stores HTTP ${r.status}`);
    const { stores } = await r.json();
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
    console.error(`${c.slug} stores failed:`, (e as Error).message);
    return "failed";
  }
}

async function main() {
  const queue = [...CITIES];
  const counts = { done: 0, skipped: 0, failed: 0 };
  const CONCURRENCY = 4;
  const worker = async () => {
    for (;;) {
      const c = queue.shift();
      if (!c) return;
      counts[await processCity(c)]++;
      await sleep(150);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nprecompute complete: done=${counts.done} skipped=${counts.skipped} failed=${counts.failed}`);
}

main();
