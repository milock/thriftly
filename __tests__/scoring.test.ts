import { describe, it, expect } from "vitest";
import { normalize, computeGoodsScore } from "@/lib/scoring";
import { REFERENCE_RANGES } from "@/lib/reference-ranges";
import type { CatchmentDemographics } from "@/lib/types";

describe("normalize", () => {
  it("clamps below min to 0 and above max to 100", () => {
    expect(normalize(0, REFERENCE_RANGES.medianHouseholdIncome)).toBe(0);
    expect(normalize(500_000, REFERENCE_RANGES.medianHouseholdIncome)).toBe(100);
  });

  it("returns 0 for null", () => {
    expect(normalize(null, REFERENCE_RANGES.medianHouseholdIncome)).toBe(0);
  });

  it("is monotonic on a log-scaled range (home value)", () => {
    const lo = normalize(200_000, REFERENCE_RANGES.medianHomeValue);
    const hi = normalize(900_000, REFERENCE_RANGES.medianHomeValue);
    expect(hi).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(100);
  });
});

describe("computeGoodsScore", () => {
  const wealthy: CatchmentDemographics = {
    medianHomeValue: 1_300_000, medianHouseholdIncome: 180_000,
    medianGrossRent: 2_800, pctBachelorsPlus: 65, tractCount: 4, population: 18_000,
  };
  const poor: CatchmentDemographics = {
    medianHomeValue: 150_000, medianHouseholdIncome: 35_000,
    medianGrossRent: 900, pctBachelorsPlus: 12, tractCount: 3, population: 14_000,
  };

  it("scores a wealthy catchment higher than a poor one", () => {
    expect(computeGoodsScore(wealthy).total).toBeGreaterThan(computeGoodsScore(poor).total);
  });

  it("keeps total within 0..100 and equal to the sum of contributions", () => {
    const s = computeGoodsScore(wealthy);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    const sum =
      s.factors.medianHomeValue.contribution +
      s.factors.medianHouseholdIncome.contribution +
      s.factors.pctBachelorsPlus.contribution +
      s.factors.medianGrossRent.contribution;
    expect(s.total).toBeCloseTo(sum, 1);
  });

  it("treats a missing factor as a 0 contribution", () => {
    const s = computeGoodsScore({ ...wealthy, medianGrossRent: null });
    expect(s.factors.medianGrossRent.contribution).toBe(0);
    expect(s.factors.medianHomeValue.contribution).toBeGreaterThan(0);
  });

  it("passes catchment meta through", () => {
    const s = computeGoodsScore(wealthy);
    expect(s.catchment).toEqual({ tractCount: 4, population: 18_000 });
  });
});
