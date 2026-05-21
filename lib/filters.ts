import type { ScoredStore } from "@/lib/types";

export type SortKey = "score" | "distance" | "best-nearby";

export interface Filters {
  radiusMiles: number;
  minScore: number;
  openNowOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  radiusMiles: 25,
  minScore: 0,
  openNowOnly: false,
  sort: "score",
};

// MVP "open now": OSM opening_hours are too varied to parse reliably, so we do not
// exclude on ambiguous hours. Future: integrate an opening_hours parser.
function looksOpen(_hours?: string): boolean {
  return true;
}

// "Best nearby": score with a mild distance penalty (2 pts per mile).
function bestNearby(s: ScoredStore): number {
  return s.score.total - s.distanceMiles * 2;
}

export function applyFilters(stores: ScoredStore[], f: Filters): ScoredStore[] {
  const filtered = stores.filter(
    (s) =>
      s.distanceMiles <= f.radiusMiles &&
      s.score.total >= f.minScore &&
      (!f.openNowOnly || looksOpen(s.openingHours)),
  );
  const sorted = [...filtered];
  if (f.sort === "score") sorted.sort((a, b) => b.score.total - a.score.total);
  else if (f.sort === "distance") sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
  else sorted.sort((a, b) => bestNearby(b) - bestNearby(a));
  return sorted;
}
