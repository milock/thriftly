import { describe, expect, it } from "vitest";
import { computeVisitScore, type VisitScoreInput } from "@/lib/visit-score";

const reviews = (rating: number | null, ratingCount: number | null) => ({ source: "google" as const, rating, ratingCount });
const base: VisitScoreInput = { neighborhood: 60, googleRatings: null, walkability: null };

describe("live Google visit score", () => {
  it("does not penalize missing signals or confuse a real zero with missing", () => {
    expect(computeVisitScore(base).total).toBe(60);
    expect(computeVisitScore({ ...base, neighborhood: 0 }).total).toBe(0);
    expect(computeVisitScore(base).coverage.kind).toBe("neighborhood-only");
    expect(computeVisitScore(base).components.googleRatings.contribution).toBeNull();
  });

  it("does not turn access or reviews alone into a full comparable composite", () => {
    const score = computeVisitScore({ neighborhood: null, googleRatings: reviews(5, 500), walkability: 20 });
    expect(score.total).toBeNull();
    expect(score.coverage.availableSignals).toBe(2);
    expect(score.components.walkability.normalized).toBe(100);
    for (const part of Object.values(score.components)) {
      expect(part.effectiveWeight).toBe(0);
      expect(part.contribution).toBeNull();
    }
  });

  it("uses the exact rating normalization and count attenuation", () => {
    for (const count of [1, 10, 50, 100, 500, 10000]) {
      const score = computeVisitScore({...base, googleRatings: reviews(4.2, count), walkability: 10.5});
      const weight = 0.5 * count / (count + 50);
      expect(score.components.googleRatings.normalized).toBeCloseTo(80);
      expect(score.components.googleRatings.effectiveWeight).toBeCloseTo(weight);
      expect(score.components.neighborhood.effectiveWeight).toBeCloseTo(1 - weight - 0.05);
      expect(score.total).toBeCloseTo(60 * (1 - weight - 0.05) + 80 * weight + 50 * 0.05);
    }
  });

  it("limits the full walkability range to a five-point difference", () => {
    for (const googleRatings of [null, reviews(4.5, 1), reviews(4.5, 500)]) {
      const low = computeVisitScore({ ...base, googleRatings, walkability: 1 });
      const high = computeVisitScore({ ...base, googleRatings, walkability: 20 });
      expect(high.total! - low.total!).toBeCloseTo(5);
      expect(high.components.walkability.effectiveWeight).toBe(0.05);
    }
  });

  it("gives an isolated perfect review less influence than sustained strong feedback", () => {
    const isolated = computeVisitScore({ ...base, googleRatings: reviews(5, 1) });
    const sustained = computeVisitScore({ ...base, googleRatings: reviews(4.5, 500) });
    expect(isolated.total! - 60).toBeLessThan(1);
    expect(sustained.total).toBeGreaterThan(isolated.total!);
    expect(sustained.components.googleRatings.effectiveWeight).toBeLessThan(0.50);
  });

  it("lets sustained poor reviews reduce the score, not merely add a bonus", () => {
    const poor = computeVisitScore({ ...base, googleRatings: reviews(1, 500) });
    expect(poor.total).toBeLessThan(50);
    expect(poor.components.googleRatings.contribution).toBe(0);
    expect(poor.coverage.kind).toBe("neighborhood-and-ratings");
  });

  it.each([
    reviews(0, 10), reviews(5.1, 10), reviews(NaN, 10), reviews(Infinity, 10),
    reviews(5, 0), reviews(5, -1), reviews(5, 1.5), reviews(5, Infinity),
    reviews(5, Number.MAX_SAFE_INTEGER + 1), reviews(5, null), reviews(null, 50),
  ])("does not manufacture a review signal from invalid data: %j", googleRatings => {
    const score = computeVisitScore({ ...base, googleRatings });
    expect(score.total).toBe(60);
    expect(score.coverage.googleRatingCount).toBeNull();
  });

  it("rejects first-party or other provider data even from an untyped caller", () => {
    const input = { ...base, googleRatings: { source: "thriftly", rating: 5, ratingCount: 500 } };
    const score = computeVisitScore(input as unknown as VisitScoreInput);
    expect(score.total).toBe(60);
    expect(score.coverage.kind).toBe("neighborhood-only");
  });

  it.each([NaN, Infinity, -1, 101])("rejects an invalid neighborhood baseline %s", neighborhood => {
    expect(computeVisitScore({ ...base, neighborhood, walkability: 20 }).total).toBeNull();
  });

  it.each([NaN, Infinity, 0, 20.1])("treats invalid access %s as unavailable without penalty", walkability => {
    expect(computeVisitScore({ ...base, walkability }).total).toBe(60);
  });

  it("keeps valid combinations bounded and component contributions reconcilable", () => {
    for (const neighborhood of [0, 60, 100]) for (const walkability of [null, 1, 10.5, 20]) for (const googleRatings of [null, reviews(1, 1), reviews(5, 50), reviews(4.1, 500)]) {
      const score = computeVisitScore({ neighborhood, googleRatings, walkability });
      const parts = Object.values(score.components);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(parts.reduce((sum, part) => sum + part.effectiveWeight, 0)).toBeCloseTo(1);
      expect(parts.reduce((sum, part) => sum + (part.contribution ?? 0), 0)).toBe(score.total);
    }
  });
});
