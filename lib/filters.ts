import type { ScoredStore } from "@/lib/types";
import { DEPARTMENTS, documentedDepartments, type Department } from "@/lib/store-evidence";
import { parseHours, isOpenNow } from "@/lib/hours";
import { matchesBrands, type BrandId } from "@/lib/brands";

export type SortKey = "score" | "distance" | "best-nearby";

export interface Filters {
  radiusMiles: number;
  minScore: number;
  openNowOnly: boolean;
  sort: SortKey;
  brandIds: BrandId[];
  departments: Department[];
}

/** Non-linear radius stops: fine control close in, coarse far out (0.5 → 100 mi). */
export const RADIUS_STOPS = [0.5, 1, 2, 3, 5, 10, 15, 25, 50, 75, 100];

export const DEFAULT_FILTERS: Filters = {
  radiusMiles: 15,
  minScore: 0,
  openNowOnly: false,
  sort: "score",
  brandIds: [],
  departments: [],
};

export const SORT_LABELS: Record<SortKey, string> = {
  score: "Goods Score",
  distance: "Distance",
  "best-nearby": "Score and distance",
};

// "Best nearby": score with a mild distance penalty (2 pts per mile).
function bestNearby(s: ScoredStore): number {
  return s.score.total - s.distanceMiles * 2;
}

export function applyFilters(stores: ScoredStore[], f: Filters): ScoredStore[] {
  const filtered = stores.filter((s) => {
    if (!matchesBrands(s, f.brandIds)) return false;
    if (f.departments?.length && !documentedDepartments(s).some(department => f.departments.includes(department))) return false;
    if (s.distanceMiles > f.radiusMiles) return false;
    if (s.score.total < f.minScore) return false;
    // A live-only filter must exclude unknown store-local hours.
    if (f.openNowOnly && isOpenNow(parseHours(s.openingHours), new Date(), s.timezone) !== true) return false;
    return true;
  });
  const sorted = [...filtered];
  if (f.sort === "score") sorted.sort((a, b) => b.score.total - a.score.total);
  else if (f.sort === "distance") sorted.sort((a, b) => a.distanceMiles - b.distanceMiles);
  else sorted.sort((a, b) => bestNearby(b) - bestNearby(a));
  return sorted;
}

export function parseDepartments(value: string | null): Department[] {
  const values = new Set((value ?? "").split(","));
  return DEPARTMENTS.filter(value => values.has(value));
}
