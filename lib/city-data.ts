import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ScoredStore } from "@/lib/types";

/**
 * Reads precomputed city store data from `data/cities/<slug>.json` (produced by
 * `scripts/build-city-data.ts`). Lets the city/state pages be statically
 * pre-rendered and served instantly, with no Overpass/Census on the request path.
 */
const DIR = join(process.cwd(), "data", "cities");

export interface CityData {
  slug: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  generatedAt: string;
  stores: ScoredStore[];
}

export function readCityData(slug: string): CityData | null {
  try {
    const file = join(DIR, `${slug}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as CityData;
  } catch {
    return null;
  }
}

/** Slugs that have precomputed data — used to pre-render only those at build. */
export function precomputedSlugs(): string[] {
  try {
    return readdirSync(DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
