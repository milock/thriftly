import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * City center coordinates bundled from the Census Gazetteer
 * (`data/city-centroids.json`, built by `scripts/build-city-centroids.ts`), so
 * city pages can locate stores against the national dataset without ever
 * live-geocoding the city name. Read once and memoized.
 */
let cache: Record<string, { lat: number; lon: number }> | null = null;

export function cityCentroid(slug: string): { lat: number; lon: number } | null {
  if (!cache) {
    try {
      cache = JSON.parse(
        readFileSync(join(process.cwd(), "data", "city-centroids.json"), "utf8"),
      ) as Record<string, { lat: number; lon: number }>;
    } catch {
      cache = {};
    }
  }
  return cache[slug] ?? null;
}
