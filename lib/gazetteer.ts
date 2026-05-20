import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TractCentroid } from "@/lib/types";

const cache = new Map<string, TractCentroid[]>();
const DATA_DIR = join(process.cwd(), "data", "tract-centroids");

export function loadStateCentroids(stateFips: string): TractCentroid[] {
  if (cache.has(stateFips)) return cache.get(stateFips)!;
  const file = join(DATA_DIR, `${stateFips}.json`);
  const data: TractCentroid[] = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : [];
  cache.set(stateFips, data);
  return data;
}
