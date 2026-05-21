import { describe, it, expect } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import type { ScoredStore } from "@/lib/types";

function store(id: string, total: number, distanceMiles: number): ScoredStore {
  return {
    id, name: id, location: { lat: 0, lon: 0 }, distanceMiles,
    score: { total, factors: {} as ScoredStore["score"]["factors"], catchment: { tractCount: 0, population: 0 } },
  };
}

describe("applyFilters", () => {
  const stores = [store("a", 80, 2), store("b", 40, 1), store("c", 90, 30)];

  it("filters by radius and min score, sorts by score", () => {
    const out = applyFilters(stores, { ...DEFAULT_FILTERS, radiusMiles: 10, minScore: 50 });
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });

  it("sorts by distance", () => {
    const out = applyFilters(stores, { ...DEFAULT_FILTERS, radiusMiles: 50, sort: "distance" });
    expect(out.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });
});
