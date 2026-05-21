/**
 * Bundle city center coordinates from the US Census Gazetteer "Places" file
 * (public domain, static) into data/city-centroids.json, so city pages never
 * live-geocode (Nominatim is rate-limited and a scheduled/bulk lookup violates
 * its policy anyway). Cities don't move, so this is a one-time/occasional run.
 *
 * Needs the Gazetteer text file. Download + unzip first:
 *   curl -sL https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip -o /tmp/gaz.zip
 *   (cd /tmp && unzip -o gaz.zip)
 * Then:  npx tsx scripts/build-city-centroids.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CITIES } from "../lib/cities";

const GAZ = process.env.GAZ_FILE ?? "/tmp/2023_Gaz_place_national.txt";

function norm(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(city|town|cdp|village|borough|municipality)\b/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bst\.?\b/g, "st")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const map = new Map<string, { lat: number; lon: number; aland: number }>();
for (const line of readFileSync(GAZ, "utf8").split("\n").slice(1)) {
  const cols = line.split("\t");
  if (cols.length < 12) continue;
  const usps = cols[0].trim();
  const name = cols[3].trim();
  const aland = parseFloat(cols[6]) || 0;
  const lat = parseFloat(cols[10]);
  const lon = parseFloat(cols[11]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const key = `${usps}|${norm(name)}`;
  const prev = map.get(key);
  // Prefer the largest place by land area when names collide (real city > CDP).
  if (!prev || aland > prev.aland) map.set(key, { lat, lon, aland });
}

// Corrections that take precedence over the Gazetteer's internal point, which
// is wrong for a couple of places: San Francisco's lands in the Pacific (the
// Farallon Islands are part of the county), and "Kailua" matches Kailua-Kona on
// the Big Island instead of Oahu's Kailua near Honolulu's stores.
const OVERRIDE: Record<string, { lat: number; lon: number }> = {
  "san-francisco-ca": { lat: 37.7749, lon: -122.4194 },
  "kailua-hi": { lat: 21.3925, lon: -157.7401 },
};

// Consolidated city-counties / townships the Gazetteer names differently
// (Nashville-Davidson, Augusta-Richmond, Indianapolis balance, etc.).
const SUPPLEMENT: Record<string, { lat: number; lon: number }> = {
  "juneau-ak": { lat: 58.3019, lon: -134.4197 },
  "augusta-ga": { lat: 33.4735, lon: -82.0105 },
  "macon-ga": { lat: 32.8407, lon: -83.6324 },
  "athens-ga": { lat: 33.9519, lon: -83.3576 },
  "honolulu-hi": { lat: 21.3069, lon: -157.8583 },
  "indianapolis-in": { lat: 39.7684, lon: -86.1581 },
  "lexington-ky": { lat: 38.0406, lon: -84.5037 },
  "butte-mt": { lat: 46.0038, lon: -112.5348 },
  "salem-nh": { lat: 42.7884, lon: -71.2009 },
  "edison-nj": { lat: 40.5187, lon: -74.4121 },
  "nashville-tn": { lat: 36.1627, lon: -86.7816 },
  "essex-vt": { lat: 44.4906, lon: -73.1087 },
  "colchester-vt": { lat: 44.5436, lon: -73.1476 },
};

const out: Record<string, { lat: number; lon: number }> = {};
const unmatched: string[] = [];
for (const c of CITIES) {
  const hit = OVERRIDE[c.slug] ?? map.get(`${c.state}|${norm(c.city)}`) ?? SUPPLEMENT[c.slug];
  if (hit) out[c.slug] = { lat: hit.lat, lon: hit.lon };
  else unmatched.push(c.slug);
}

writeFileSync(join(process.cwd(), "data", "city-centroids.json"), JSON.stringify(out));
console.log(`matched ${Object.keys(out).length}/${CITIES.length} cities`);
if (unmatched.length) console.log(`unmatched (${unmatched.length}): ${unmatched.join(", ")}`);
