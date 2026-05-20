import { describe, it, expect } from "vitest";
import { tractsWithinRadius, aggregateCatchment } from "@/lib/catchment";
import type { TractCentroid, TractDemographics } from "@/lib/types";

const store = { lat: 32.84, lon: -117.27 }; // La Jolla-ish

describe("tractsWithinRadius", () => {
  const centroids: TractCentroid[] = [
    { geoid: "06073008000", lat: 32.842, lon: -117.272 }, // ~0.2 mi
    { geoid: "06073008100", lat: 32.9, lon: -117.2 }, // ~6 mi
  ];

  it("keeps only tracts inside the radius and tags distance", () => {
    const out = tractsWithinRadius(store, centroids, 3);
    expect(out).toHaveLength(1);
    expect(out[0].centroid.geoid).toBe("06073008000");
    expect(out[0].distanceMiles).toBeGreaterThan(0);
    expect(out[0].distanceMiles).toBeLessThan(1);
  });
});

describe("aggregateCatchment", () => {
  const demoA: TractDemographics = {
    geoid: "A", medianHomeValue: 1_000_000, medianHouseholdIncome: 150_000,
    medianGrossRent: 2500, population: 5000, pctBachelorsPlus: 60,
  };
  const demoB: TractDemographics = {
    geoid: "B", medianHomeValue: 500_000, medianHouseholdIncome: 80_000,
    medianGrossRent: 1500, population: 5000, pctBachelorsPlus: 40,
  };

  it("blends within the value range and reports meta", () => {
    const result = aggregateCatchment([
      { demo: demoA, distanceMiles: 0.5 },
      { demo: demoB, distanceMiles: 0.5 },
    ]);
    expect(result.tractCount).toBe(2);
    expect(result.population).toBe(10_000);
    expect(result.medianHomeValue!).toBeGreaterThan(500_000);
    expect(result.medianHomeValue!).toBeLessThan(1_000_000);
  });

  it("weights closer tracts more heavily", () => {
    const near = aggregateCatchment([
      { demo: demoA, distanceMiles: 0.1 },
      { demo: demoB, distanceMiles: 5 },
    ]);
    expect(near.medianHomeValue!).toBeGreaterThan(750_000); // pulled toward demoA
  });

  it("ignores nulls per-metric", () => {
    const result = aggregateCatchment([
      { demo: { ...demoA, medianGrossRent: null }, distanceMiles: 0.5 },
      { demo: demoB, distanceMiles: 0.5 },
    ]);
    expect(result.medianGrossRent).toBe(1500); // only demoB contributed
  });

  it("returns nulls and zero meta for an empty catchment", () => {
    const result = aggregateCatchment([]);
    expect(result.tractCount).toBe(0);
    expect(result.medianHomeValue).toBeNull();
  });
});
