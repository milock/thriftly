import type { ScoredStore } from "@/lib/types";
import { parseHours, isOpenNow } from "@/lib/hours";

export type SortKey = "score" | "distance" | "best-nearby";

export interface Filters {
  radiusMiles: number;
  minScore: number;
  openNowOnly: boolean;
  sort: SortKey;
}

/** Non-linear radius stops: fine control close in, coarse far out (0.5 → 100 mi). */
export const RADIUS_STOPS = [0.5, 1, 2, 3, 5, 10, 15, 25, 50, 75, 100];

export const DEFAULT_FILTERS: Filters = {
  radiusMiles: 15,
  minScore: 0,
  openNowOnly: false,
  sort: "score",
};

export const SORT_LABELS: Record<SortKey, string> = {
  score: "Goods Score",
  distance: "Distance",
  "best-nearby": "Best nearby",
};

// "Best nearby": score with a mild distance penalty (2 pts per mile).
function bestNearby(s: ScoredStore): number {
  return s.score.total - s.distanceMiles * 2;
}

export function applyFilters(stores: ScoredStore[], f: Filters): ScoredStore[] {
  const filtered = stores.filter((s) => {
    if (s.distanceMiles > f.radiusMiles) return false;
    if (s.score.total < f.minScore) return false;
    // Only hide stores we can confirm are closed; keep unknown-hours stores.
    if (f.openNowOnly && isOpenNow(parseHours(s.openingHours)) === false) return false;
    return true;
  });
  const sorted = [...filtered];
  if (f.sort === "score") sorted.sort((a, b) => b.score.total - a.score.total);
  else if (f.sort === "distance") sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
  else sorted.sort((a, b) => bestNearby(b) - bestNearby(a));
  return sorted;
}
